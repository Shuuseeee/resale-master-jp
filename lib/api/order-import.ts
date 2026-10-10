// lib/api/order-import.ts — 导入买取X 格式的数据（CSV 基本 / XLSX 导入模板 / XLSX 全部数据）
// 流程：读文件 → lib/order-data/parse.ts 解析并完整校验（有错整份不导入）→ 前端算好金额、积分平台、利润
//      → 一次 RPC import_order_data 在数据库事务里写入（去重、补建平台、写进货 / 出售 / 退货 / 经费；出错整份回滚）
// 金额口径（与买取X 一致）：
// - 采购总价 = 进货单价 × 数量 + 运费；「使用积分」= 积分抵扣，其余计为信用卡 / 其他支付
// - 买取X 的「优惠券」是已从单价里扣掉的折扣（不含在单价里、不影响原価），我们没有对应字段，写进备注
// - 退货的「损失额」我们没有对应字段，写进退货备注
// - 经费 → 耗材：分类对上 4 个固定分类就用，对不上归「其他」、原分类写进说明

import { supabase } from '@/lib/supabase/client';
import { computeSaleProfit, type SaleMathTxBasis } from '@/lib/api/sales-records';
import { SUPPLY_CATEGORIES } from '@/lib/order-data/columns';
import { parseCsvText, parseOrderData, type ParsedPurchase, type Table } from '@/lib/order-data/parse';

export interface OrderImportResult {
  purchases: number;
  /** 已存在、跳过的进货笔数（连同其出售 / 退货） */
  skipped: number;
  sales: number;
  returns: number;
  expenses: number;
  /** 文件里的「账号」在支付方式里找不到的名字（这些进货不挂支付方式） */
  unmatchedAccounts: string[];
}

/** 校验没通过：一条都没导入 */
export class OrderImportError extends Error {
  constructor(readonly errors: string[]) {
    super(errors[0] ?? '导入失败');
  }
}

interface PaymentMethodRef {
  id: string;
  name: string;
  card_points_platform_id: string | null;
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

export async function importOrderFile(file: File): Promise<OrderImportResult> {
  const parsed = parseOrderData(await readTables(file), file.name);
  if (parsed.errors.length > 0) throw new OrderImportError(parsed.errors);

  const [{ data: paymentMethods, error: pmError }, { data: pointsPlatforms, error: ppError }] = await Promise.all([
    supabase.from('payment_methods').select('id, name, card_points_platform_id'),
    supabase.from('points_platforms').select('id, display_name').eq('is_active', true),
  ]);
  if (pmError) throw new Error(`读取支付方式失败：${pmError.message}`);
  if (ppError) throw new Error(`读取积分平台失败：${ppError.message}`);
  const cards = new Map((paymentMethods as PaymentMethodRef[]).map(pm => [pm.name, pm]));
  const unmatched = new Set<string>();

  const purchases = parsed.purchases.map(p => {
    const card = p.account ? cards.get(p.account) : undefined;
    if (p.account && !card) unmatched.add(p.account);
    const total = p.unitPrice * p.quantity + p.shippingFee;
    const platformIds = inferPointsPlatforms(p, card, pointsPlatforms as PointsPlatformRef[]);
    const basis: SaleMathTxBasis = {
      purchase_price_total: total,
      quantity: p.quantity,
      expected_platform_points: p.pointsSite,
      expected_card_points: p.pointsCard,
      extra_platform_points: p.pointsOther,
      ...platformIds,
    };
    const sales = p.sales.map(s => ({
      sale_date: s.date,
      platform_name: s.target,
      quantity_sold: s.qty,
      selling_price_per_unit: s.price,
      platform_fee: s.deduction,
      sale_order_number: s.orderId,
      notes: s.memo,
      ...computeSaleProfit({ quantity_sold: s.qty, selling_price_per_unit: s.price, platform_fee: s.deduction, shipping_fee: 0 }, basis),
    }));
    // 交易上的利润 / ROI = 各次出售的合计（同 lib/api/sales-records.ts updateTransactionROI）
    const cashSpent = sales.reduce((sum, s) => sum + s.actual_cash_spent, 0);
    const totalProfit = sales.reduce((sum, s) => sum + s.total_profit, 0);
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
      ...platformIds,
      platform_name: p.source,
      order_number: p.orderId,
      notes: joinNotes(p.memo, p.coupon > 0 && `优惠券 ¥${p.coupon}（买取X 导入）`),
      arrived: p.received || p.sales.length > 0 || (p.arrivedQty > 0 && p.arrivedQty >= p.quantity),
      paid_all: p.sales.length > 0 && p.sales.every(s => s.paid),
      cash_profit: sales.length ? sales.reduce((sum, s) => sum + s.cash_profit, 0) : null,
      total_profit: sales.length ? totalProfit : null,
      roi: sales.length ? (cashSpent > 0 ? (totalProfit / cashSpent) * 100 : 0) : null,
      sales,
      returns: p.returns.map(r => ({
        return_date: r.date,
        quantity_returned: r.qty,
        return_amount: r.refund,
        notes: joinNotes(r.memo, r.loss > 0 && `损失额 ¥${r.loss}（买取X 导入）`),
      })),
    };
  });

  const expenses = parsed.expenses.map(e => {
    const known = (SUPPLY_CATEGORIES as readonly string[]).includes(e.category);
    return {
      category: known ? e.category : '其他',
      amount: e.amount,
      purchase_date: e.date,
      description: known ? e.memo : joinNotes(e.category, e.memo).replace('\n', ' · '),
      notes: '',
    };
  });

  const { data, error } = await supabase.rpc('import_order_data', { p_purchases: purchases, p_expenses: expenses });
  if (error) throw new OrderImportError([`写入数据库失败，没有导入任何数据：${error.message}`]);
  return { ...(data as Omit<OrderImportResult, 'unmatchedAccounts'>), unmatchedAccounts: [...unmatched] };
}
