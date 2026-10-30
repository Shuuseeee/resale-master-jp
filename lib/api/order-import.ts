// lib/api/order-import.ts — 导入买取X 格式的数据（CSV 基本 / XLSX 导入模板 / XLSX 全部数据）
// 流程：读文件 → lib/order-data/parse.ts 解析并完整校验（有错整份不导入）→（prepareOrderImport）
//      → 文件里有还认不出的卡 ID 时让用户选对应的支付方式 →（commitOrderImport）前端算好金额、积分平台
//      → 一次 RPC import_order_data 在数据库事务里写入（去重、补建平台、写进货 / 出售 / 退货 / 经费；出错整份回滚）
// 卡：按「クレジットカードID / 信用卡ID」认（买取X 内部的卡 ID；我们自己导出的是支付方式 id）。
//    「アカウント / 账号」是购买账号标签（多账号管理用），存进 transactions.purchase_account，不拿来匹配支付方式。
//    认卡顺序：支付方式 id → 支付方式记住的买取X 卡 ID（kaitorix_card_id）→ 本次用户选的（选了就记住）。
//    没有卡 ID 列的旧文件（我们 SQL 30 前的导出把卡名写在「账号」里）：账号与支付方式同名时当作卡。
// 金额口径（与买取X 一致）：
// - 采购总价 = 进货单价 × 数量 + 运费；「使用积分」= 积分抵扣，其余计为信用卡 / 其他支付
// - 买取X 的「优惠券」是已从单价里扣掉的折扣（不影响原価），存进 transactions.coupon_amount，只做记录
// - 退货的「损失额」写进 return_records.loss_amount；利润由数据库触发器按买取X 公式计算
// - 经费：分类与买取X 相同（送料 / 交通費 / 梱包材 / 保管費 / 消耗品 / その他），也认中文名；都对不上归「その他」、原分类写进说明

import { supabase } from '@/lib/supabase/client';
import { EXPENSE_CATEGORIES, isExpenseCategory } from '@/lib/expenses/categories';
import { parseCsvText, parseOrderData, type ParsedPurchase, type Table } from '@/lib/order-data/parse';

export interface OrderImportResult {
  purchases: number;
  /** 已存在、跳过的进货笔数（连同其出售 / 退货） */
  skipped: number;
  sales: number;
  returns: number;
  expenses: number;
  /** 到货明细条数（库没升级时 RPC 不返回） */
  arrivals?: number;
  /** 有卡 ID 但没选对应支付方式的进货笔数（这些进货不挂支付方式） */
  unassignedCards: number;
}

/** 文件里还认不出的买取X 卡 ID：让用户选对应的支付方式 */
export interface CardChoice {
  cardId: string;
  /** 用到这张卡的进货笔数 */
  count: number;
  /** 备注里的卡号后 4 位（买取X Chrome 扩展取込的会写「支払: Visa ****4005」） */
  last4: string | null;
  /** 按后 4 位预选的支付方式 */
  suggestedId: string | null;
}

export interface PreparedOrderImport {
  fileName: string;
  parsed: ReturnType<typeof parseOrderData>;
  paymentMethods: PaymentMethodRef[];
  pointsPlatforms: PointsPlatformRef[];
  unresolvedCards: CardChoice[];
}

/** 校验没通过：一条都没导入 */
export class OrderImportError extends Error {
  constructor(readonly errors: string[]) {
    super(errors[0] ?? '导入失败');
  }
}

export interface PaymentMethodRef {
  id: string;
  name: string;
  card_points_platform_id: string | null;
  card_last4?: string | null;
  kaitorix_card_id?: string | null;
  is_active?: boolean;
}

interface PointsPlatformRef {
  id: string;
  display_name: string;
}

async function readTables(file: File): Promise<Table[]> {
  if (/\.csv$/i.test(file.name)) {
    return [{ name: file.name, rows: parseCsvText(await file.text()) }];
  }
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  return workbook.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(workbook.Sheets[name], { header: 1, raw: true, defval: null }),
  }));
}

/** 积分平台：网站积分按进货来源推测，信用卡积分取支付方式的积分平台，其他积分按 d 积分 */
function inferPointsPlatforms(p: ParsedPurchase, card: PaymentMethodRef | undefined, platforms: PointsPlatformRef[]) {
  const find = (word: string) => platforms.find(x => x.display_name.includes(word))?.id ?? null;
  const source = p.source.toLowerCase();
  let site: string | null = null;
  if (p.pointsSite > 0) {
    if (source.includes('amazon')) site = find('Amazon');
    else if (source.includes('楽天') || source.includes('rakuten')) site = find('楽天');
    else if (source.includes('yahoo')) site = find('Yahoo');
  }
  return {
    platform_points_platform_id: site,
    card_points_platform_id: p.pointsCard > 0 ? card?.card_points_platform_id ?? null : null,
    extra_platform_points_platform_id: p.pointsOther > 0 ? find('d') : null,
  };
}

function joinNotes(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join('\n');
}

const LAST4 = /\*{2,}\s*(\d{4})/;

/** 文件里的卡 → 我们的支付方式（choices = 本次用户选的：买取X 卡 ID → 支付方式 id，null = 不设置） */
function resolveCard(p: ParsedPurchase, methods: PaymentMethodRef[], choices: Record<string, string | null>) {
  if (p.cardId) {
    const id = methods.find(m => m.id === p.cardId)?.id
      ?? methods.find(m => m.kaitorix_card_id === p.cardId)?.id
      ?? choices[p.cardId] ?? null;
    return { card: methods.find(m => m.id === id), account: p.account };
  }
  // 没有卡 ID：旧版导出把卡名写在「账号」里
  const byName = p.account ? methods.find(m => m.name === p.account) : undefined;
  return byName ? { card: byName, account: '' } : { card: undefined, account: p.account };
}

/** 第一步：解析、校验，找出还认不出的卡 ID（有错抛 OrderImportError，什么都不写） */
export async function prepareOrderImport(file: File): Promise<PreparedOrderImport> {
  const parsed = parseOrderData(await readTables(file), file.name);
  if (parsed.errors.length > 0) throw new OrderImportError(parsed.errors);

  const [{ data: paymentMethods, error: pmError }, { data: pointsPlatforms, error: ppError }] = await Promise.all([
    // '*'：kaitorix_card_id / card_last4 是后加的列，库没升级时不能点名
    supabase.from('payment_methods').select('*').order('name'),
    supabase.from('points_platforms').select('id, display_name').eq('is_active', true),
  ]);
  if (pmError) throw new Error(`读取支付方式失败：${pmError.message}`);
  if (ppError) throw new Error(`读取积分平台失败：${ppError.message}`);
  const methods = (paymentMethods ?? []) as PaymentMethodRef[];

  const unresolved = new Map<string, CardChoice>();
  for (const p of parsed.purchases) {
    if (!p.cardId || resolveCard(p, methods, {}).card) continue;
    const choice = unresolved.get(p.cardId) ?? { cardId: p.cardId, count: 0, last4: null, suggestedId: null };
    choice.count += 1;
    if (!choice.last4) {
      const last4 = p.memo.match(LAST4)?.[1] ?? null;
      if (last4) {
        choice.last4 = last4;
        choice.suggestedId = methods.find(m => m.card_last4 === last4)?.id ?? null;
      }
    }
    unresolved.set(p.cardId, choice);
  }
  return {
    fileName: file.name,
    parsed,
    paymentMethods: methods,
    pointsPlatforms: (pointsPlatforms ?? []) as PointsPlatformRef[],
    unresolvedCards: [...unresolved.values()],
  };
}

/** 第二步：记住用户选的卡对应关系，写入数据库 */
export async function commitOrderImport(
  prepared: PreparedOrderImport,
  choices: Record<string, string | null> = {},
): Promise<OrderImportResult> {
  const { parsed, pointsPlatforms } = prepared;
  // 选了对应支付方式的卡记住（同一个买取X 卡 ID 只挂一个支付方式）；库没升级（没有这一列）时只是不记住
  const methods = prepared.paymentMethods.map(m => ({ ...m }));
  for (const [cardId, methodId] of Object.entries(choices)) {
    if (!methodId) continue;
    const { error } = await supabase.from('payment_methods').update({ kaitorix_card_id: null }).eq('kaitorix_card_id', cardId).neq('id', methodId);
    if (!error) await supabase.from('payment_methods').update({ kaitorix_card_id: cardId }).eq('id', methodId);
    methods.forEach(m => { if (m.id === methodId) m.kaitorix_card_id = cardId; });
  }
  let unassignedCards = 0;

  const purchases = parsed.purchases.map(p => {
    const { card, account } = resolveCard(p, methods, choices);
    if (p.cardId && !card) unassignedCards += 1;
    const total = p.unitPrice * p.quantity + p.shippingFee;
    return {
      date: p.date,
      product_name: p.productName,
      jan_code: p.jan,
      unit_price: p.unitPrice,
      quantity: p.quantity,
      shipping_fee: p.shippingFee,
      purchase_price_total: total,
      point_paid: p.pointsUsed,
      card_paid: Math.max(total - p.pointsUsed, 0),
      card_id: card?.id ?? null,
      expected_platform_points: p.pointsSite,
      expected_card_points: p.pointsCard,
      extra_platform_points: p.pointsOther,
      ...inferPointsPlatforms(p, card, pointsPlatforms),
      platform_name: p.source,
      order_number: p.orderId,
      purchase_account: account,
      coupon_amount: p.coupon,
      notes: p.memo,
      // 有着荷明细时按明细写（数据库触发器据此定状态）；没有时，有出售或「着荷」= 1 视为全部到货
      arrived: p.arrivals.length === 0 && (p.received || p.sales.length > 0),
      arrivals: p.arrivals.map(a => ({ arrived_date: a.date || null, quantity: a.qty, notes: a.memo })),
      // 库没升级（SQL 29 前）的 RPC 只认整笔的 paid_all；升级后按每次出售的 paid 写入、状态交给出售触发器
      paid_all: p.sales.length > 0 && p.sales.every(s => s.paid),
      sales: p.sales.map(s => ({
        sale_date: s.date,
        platform_name: s.target,
        quantity_sold: s.qty,
        selling_price_per_unit: s.price,
        platform_fee: s.deduction,
        sale_order_number: s.orderId,
        notes: s.memo,
        paid: s.paid,
      })),
      returns: p.returns.map(r => ({
        return_date: r.date,
        quantity_returned: r.qty,
        return_amount: r.refund,
        loss_amount: r.loss,
        notes: r.memo,
      })),
    };
  });

  const expenses = parsed.expenses.map(e => {
    const category = isExpenseCategory(e.category) ? e.category : EXPENSE_CATEGORIES.find(c => c.label === e.category)?.value;
    const known = !!category;
    return {
      category: category ?? 'その他',
      amount: e.amount,
      purchase_date: e.date,
      description: known ? e.memo : joinNotes(e.category, e.memo).replace('\n', ' · '),
      notes: '',
    };
  });

  const { data, error } = await supabase.rpc('import_order_data', { p_purchases: purchases, p_expenses: expenses });
  if (error) throw new OrderImportError([`写入数据库失败，没有导入任何数据：${error.message}`]);

  // 商品缩略图：已有图由 RPC 跳过；重复导入也补入队。每批不超过接口的 500 个上限。
  // 等入队响应再报告导入完成，取图仍在服务端 after() 后台执行；入队失败不影响已提交的交易，Cron 会补扫。
  const jans = [...new Set(parsed.purchases.map(p => p.jan.trim()).filter(j => /^\d{8,13}$/.test(j)))];
  for (let i = 0; i < jans.length; i += 500) {
    try {
      const response = await fetch('/api/thumbnail/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jans: jans.slice(i, i + 500) }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error('导入后缩略图入队失败，等待每日补扫:', error);
    }
  }
  return { ...(data as Omit<OrderImportResult, 'unassignedCards'>), unassignedCards };
}
