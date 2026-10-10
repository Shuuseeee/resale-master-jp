// lib/api/order-export.ts — 按买取X 的格式导出（与 lib/api/order-import.ts 往返一致）
// - CSV（基本）：一张表 26 列（中文表头），一笔进货有多次出售时每行重复完整的进货列；JAN 写成 ="…" 防止 Excel 转成科学计数法
// - XLSX（全部数据）：仕入 / 売却 / 返品 / 着荷 / 経費 / Guide，「仕入参照キー」= 交易 ID
// - 导入模板：26 列 + 示例行 + 说明
// 读取全表一律分页（lib/api/fetchAll.ts），指定 ID 时分块

import { supabase } from '@/lib/supabase/client';
import { fetchAllByIds, fetchAllRows } from '@/lib/api/fetchAll';
import { CSV_HEADERS, SHEETS, XLSX_HEADERS } from '@/lib/order-data/columns';

/* eslint-disable @typescript-eslint/no-explicit-any -- 读取带关联的行，按列名取值 */

type Row = (string | number)[];

const TX_SELECT = `
  *,
  payment_method:payment_methods(name),
  purchase_platform:purchase_platforms(name)
`;
const SALE_SELECT = `
  *,
  selling_platform:selling_platforms(name)
`;

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function fetchTransactions(ids?: string[]): Promise<any[]> {
  const rows =
    ids && ids.length > 0
      ? await fetchAllByIds<any>(ids, (chunk, from, to, opts) =>
          supabase.from('transactions').select(TX_SELECT, opts).in('id', chunk).order('date').order('id').range(from, to),
        )
      : await fetchAllRows<any>((from, to, opts) =>
          supabase.from('transactions').select(TX_SELECT, opts).order('date').order('id').range(from, to),
        );
  // 分块读取后合并重排：仕入日 → id
  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
}

/** 出售 / 退货：指定交易时分块按交易 ID 取，全量时直接取全部（RLS 只返回自己的） */
async function fetchChildren(table: 'sales_records' | 'return_records', select: string, order: string, ids?: string[]): Promise<any[]> {
  return ids && ids.length > 0
    ? fetchAllByIds<any>(ids, (chunk, from, to, opts) =>
        supabase.from(table).select(select, opts).in('transaction_id', chunk).order(order).order('id').range(from, to),
      )
    : fetchAllRows<any>((from, to, opts) => supabase.from(table).select(select, opts).order(order).order('id').range(from, to));
}

function groupBy<T extends { transaction_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.transaction_id) ?? [];
    list.push(row);
    map.set(row.transaction_id, list);
  }
  return map;
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const shippingOf = (tx: any) => num(tx.shipping_fee);
const unitPriceOf = (tx: any) =>
  tx.unit_price != null ? num(tx.unit_price) : Math.round((num(tx.purchase_price_total) - shippingOf(tx)) / (tx.quantity || 1));
const arrived = (tx: any) => tx.status !== 'pending';

// ──── CSV（基本） ────

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function exportOrdersCsv(transactionIds?: string[]): Promise<string> {
  const transactions = await fetchTransactions(transactionIds);
  if (transactions.length === 0) throw new Error('没有可导出的交易');
  const sales = groupBy(await fetchChildren('sales_records', SALE_SELECT, 'sale_date', transactions.map(t => t.id)));

  const lines = [CSV_HEADERS.join(',')];
  for (const tx of transactions) {
    const purchase: (string | number)[] = [
      tx.date,
      tx.product_name,
      tx.jan_code ? `="${tx.jan_code}"` : '',
      unitPriceOf(tx),
      tx.quantity || 1,
      tx.purchase_platform?.name ?? '',
      tx.order_number ?? '',
      tx.payment_method?.name ?? '',
      shippingOf(tx),
      num(tx.point_paid),
      0,
      num(tx.expected_platform_points),
      num(tx.expected_card_points),
      num(tx.extra_platform_points),
      arrived(tx) ? 1 : '',
      tx.notes ?? '',
      '',
      'manual',
    ];
    const paid = tx.status === 'sold' ? 1 : '';
    const txSales = sales.get(tx.id) ?? [];
    const rows: Row[] = txSales.length
      ? txSales.map(s => [
          ...purchase,
          s.sale_date,
          s.selling_platform?.name ?? '',
          num(s.selling_price_per_unit),
          s.quantity_sold,
          num(s.platform_fee) + num(s.shipping_fee),
          s.sale_order_number ?? '',
          s.notes ?? '',
          paid,
        ])
      : [[...purchase, '', '', '', '', '', '', '', '']];
    for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  }
  return '﻿' + lines.join('\n');
}

export function downloadCsv(content: string, filename = `purchases_${today().replace(/-/g, '')}.csv`) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ──── XLSX（全部数据） ────

const GUIDE_ROWS: Row[] = [
  ['■ 本文件'],
  ['全部数据（进货・出售・退货・经费）。与买取X「数据导出 → XLSX（全部数据）」同一格式，可在本应用或买取X 的「数据导入」里导入。'],
  ['■ 表名（导入时按表名判断数据种类，不需要的表可以删掉）'],
  ['仕入', '进货'],
  ['売却', '出售（用「仕入参照キー」对应进货）'],
  ['返品', '退货（用「仕入参照キー」对应进货）'],
  ['着荷', '分批到货明细（本应用暂不记录，导出为空）'],
  ['経費', '经费（本应用的耗材）'],
  ['■ 规则'],
  ['仕入参照キー', '进货与出售 / 退货的关联键，请勿修改'],
  ['原価 / 確定利益 / 利益率', '计算列，导入时忽略。原価 =（仕入単価×数量 + 送料 − ポイント使用）÷ 数量'],
  ['着荷', '1 = 已到货，空 = 未到货'],
  ['入金済み', '1 = 已入账，空 = 未入账'],
  ['日期', 'YYYY-MM-DD 或 YYYY/MM/DD'],
  ['导入', '只追加；与已有进货的「日期 + 商品名 + 数量 + 单价 + 订单ID（为空时用 JAN）」相同的跳过。有一条出错整份不导入。'],
];

export async function exportOrdersXlsx(): Promise<void> {
  const transactions = await fetchTransactions();
  const [sales, returns, supplies] = await Promise.all([
    fetchChildren('sales_records', SALE_SELECT, 'sale_date'),
    fetchChildren('return_records', '*', 'return_date'),
    fetchAllRows<any>((from, to, opts) =>
      supabase.from('supplies_costs').select('*', opts).order('purchase_date').order('id').range(from, to),
    ),
  ]);
  if (transactions.length === 0 && supplies.length === 0) throw new Error('没有可导出的数据');
  const statusById = new Map(transactions.map(t => [t.id, t.status]));

  const purchaseRows: Row[] = transactions.map(tx => {
    const qty = tx.quantity || 1;
    const cost = (unitPriceOf(tx) * qty + shippingOf(tx) - num(tx.point_paid)) / qty;
    return [
      tx.id, tx.date, tx.product_name, tx.jan_code ?? '', unitPriceOf(tx), qty,
      tx.purchase_platform?.name ?? '', tx.order_number ?? '', shippingOf(tx), num(tx.point_paid), 0,
      num(tx.expected_platform_points), num(tx.expected_card_points), num(tx.extra_platform_points),
      arrived(tx) ? 1 : '', tx.notes ?? '', tx.id, tx.payment_method?.name ?? '', '', 'manual', arrived(tx) ? qty : 0,
      Math.round(cost), Math.round(num(tx.total_profit)), `${num(tx.roi).toFixed(1)}%`,
    ];
  });
  const saleRows: Row[] = sales.map(s => [
    s.transaction_id, s.sale_date, s.selling_platform?.name ?? '', s.sale_order_number ?? '',
    num(s.selling_price_per_unit), s.quantity_sold, num(s.platform_fee) + num(s.shipping_fee), s.notes ?? '',
    statusById.get(s.transaction_id) === 'sold' ? 1 : '',
  ]);
  const returnRows: Row[] = returns.map(r => [
    r.transaction_id, r.quantity_returned, r.return_date, num(r.return_amount), 0,
    [r.return_reason, r.notes].filter(Boolean).join('\n'),
  ]);
  const expenseRows: Row[] = supplies.map(s => [
    s.category, num(s.amount), s.purchase_date, [s.description, s.notes].filter(Boolean).join(' / '),
  ]);

  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const add = (name: string, header: readonly string[] | null, rows: Row[]) =>
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(header ? [[...header], ...rows] : rows), name);
  add(SHEETS.purchases, XLSX_HEADERS.purchases, purchaseRows);
  add(SHEETS.sales, XLSX_HEADERS.sales, saleRows);
  add(SHEETS.returns, XLSX_HEADERS.returns, returnRows);
  add(SHEETS.arrivals, XLSX_HEADERS.arrivals, []);
  add(SHEETS.expenses, XLSX_HEADERS.expenses, expenseRows);
  add(SHEETS.guide, null, GUIDE_ROWS);
  XLSX.writeFile(workbook, `order_manager_all_${today()}.xlsx`);
}

// ──── 导入模板 ────

export async function downloadImportTemplate(): Promise<void> {
  const example: Row[] = [
    ['2026-01-01', '商品A', '4549576247038', 5000, 2, 'Amazon', 'A001', '', 0, 0, 0, 0, 0, 0, '', '', '', 'manual', '2026-01-05', 'メルカリ', 6000, 1, 200, 'S001', '', ''],
    ['2026-01-01', '商品A', '4549576247038', 5000, 2, 'Amazon', 'A001', '', 0, 0, 0, 0, 0, 0, '', '', '', 'manual', '2026-01-06', '買取一丁目', 5800, 1, 0, 'S002', '', 1],
    ['2026-01-02', '商品B', '4902370550757', 3000, 1, '楽天市場', '', '', 500, 500, 0, 100, 50, 0, '', '', '', 'manual', '', '', '', '', '', '', '', ''],
  ];
  const guide: Row[] = [
    ['列', '说明'],
    ['进货日期', 'YYYY-MM-DD 或 YYYY/MM/DD'],
    ['进货单价 / 数量', '日元 / 整数（1 以上）'],
    ['进货来源 / 出售对象', '平台名，没有的会自动新建'],
    ['账号', '支付方式名称（与设置里的支付方式一致才会关联）'],
    ['运费', '计入采购总价'],
    ['使用积分', '积分抵扣的金额'],
    ['优惠券', '已从单价扣掉的折扣，只记入备注'],
    ['到货 / 已入账', '1 / true / 是'],
    ['扣除额', '出售时的手续费等'],
    ['规则', '进货列完全相同的多行合并为一笔进货、各行出售分别记录；出售列留空只导入进货；有出售的自动视为已到货'],
    ['去重', '与已有进货的「日期 + 商品名 + 数量 + 单价 + 订单ID（为空时用 JAN）」相同的跳过'],
    ['出错', '有一条出错整份不导入'],
  ];
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[...CSV_HEADERS], ...example]), 'テンプレート');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(guide), '説明・说明');
  XLSX.writeFile(workbook, 'purchase_template.xlsx');
}
