// lib/order-data/parse.ts — 解析买取X 格式的导入文件（纯函数，不碰数据库）
// 支持：CSV（基本，一张表）、XLSX 导入模板（一张表，同 CSV 列）、XLSX 全部数据（仕入 / 売却 / 返品 / 着荷 / 経費）
// 规则（与买取X 一致）：
// - 一张表的格式里，进货列完全相同的连续 / 不连续行合并成一笔进货，各行的出售分别建记录
//   （买取X 导出时一笔多次出售会重复进货列；我们旧版导出把第 2 条以后的出售行的进货列留空，也兼容）
// - 有出售的进货自动视为已到货；「着荷」表到货数量合计 ≥ 数量也视为已到货（分批到货的明细暂不保存）
// - 校验出任何错误就整份不导入，错误全部列出

import { SHEETS, headerKey } from './columns';

export type Cell = string | number | boolean | Date | null | undefined;

export interface ParsedSale {
  date: string;
  target: string;
  price: number;
  qty: number;
  deduction: number;
  orderId: string;
  memo: string;
  paid: boolean;
}

export interface ParsedReturn {
  date: string;
  qty: number;
  refund: number;
  loss: number;
  memo: string;
}

export interface ParsedPurchase {
  /** 出错时指向原文件的位置 */
  where: string;
  date: string;
  productName: string;
  jan: string;
  unitPrice: number;
  quantity: number;
  source: string;
  orderId: string;
  account: string;
  shippingFee: number;
  pointsUsed: number;
  coupon: number;
  pointsSite: number;
  pointsCard: number;
  pointsOther: number;
  received: boolean;
  memo: string;
  arrivedQty: number;
  sales: ParsedSale[];
  returns: ParsedReturn[];
}

export interface ParsedExpense {
  where: string;
  category: string;
  amount: number;
  date: string;
  memo: string;
}

export interface ParsedImport {
  purchases: ParsedPurchase[];
  expenses: ParsedExpense[];
  errors: string[];
}

export interface Table {
  name: string;
  rows: Cell[][];
}

// ──── 单元格 ────

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function cellText(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  return String(v).trim();
}

/** JAN：去掉 Excel 文本公式 ="…"、引号与撇号 */
function cleanJan(raw: string): string {
  return raw.replace(/^="?/, '').replace(/"$/, '').replace(/^'/, '').trim();
}

/** 是 / 否：1 / true / yes / はい / 是 */
function truthy(raw: string): boolean {
  return ['1', 'true', 'yes', 'y', 'はい', '是', 'o', '○'].includes(raw.trim().toLowerCase());
}

/** 日期：YYYY-MM-DD 或 YYYY/MM/DD（月日可一位）；返回 YYYY-MM-DD，非法返回 null */
function parseDate(raw: string): string | null {
  const m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

class RowReader {
  constructor(
    private readonly row: Record<string, string>,
    readonly where: string,
    private readonly errors: string[],
  ) {}

  text(key: string): string {
    return this.row[key] ?? '';
  }

  has(key: string): boolean {
    return this.text(key) !== '';
  }

  /** 金额 / 数量：空 → 默认值；允许千位逗号与 ¥ */
  num(key: string, label: string, { min = 0, integer = false, fallback = 0 } = {}): number {
    const raw = this.text(key).replace(/[,¥￥円\s]/g, '');
    if (raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || (integer && !Number.isInteger(n))) {
      this.errors.push(`${this.where}：「${label}」不是有效的${integer ? '整数' : '数字'}（${this.text(key)}）`);
      return fallback;
    }
    return n;
  }

  date(key: string, label: string, required = true): string {
    const raw = this.text(key);
    if (raw === '') {
      if (required) this.errors.push(`${this.where}：缺少「${label}」`);
      return '';
    }
    const d = parseDate(raw);
    if (!d) this.errors.push(`${this.where}：「${label}」日期格式不对（${raw}），应为 YYYY-MM-DD 或 YYYY/MM/DD`);
    return d ?? '';
  }
}

/** 表 → 带规范名的行（表头在第一个非空行） */
function readTable(table: Table): { cols: Set<string>; rows: { line: number; data: Record<string, string> }[] } {
  const headerIndex = table.rows.findIndex(r => r.some(c => cellText(c) !== ''));
  if (headerIndex < 0) return { cols: new Set(), rows: [] };
  const keys = table.rows[headerIndex].map(c => headerKey(cellText(c)));
  const rows: { line: number; data: Record<string, string> }[] = [];
  for (let i = headerIndex + 1; i < table.rows.length; i++) {
    const data: Record<string, string> = {};
    let empty = true;
    table.rows[i].forEach((c, idx) => {
      const key = keys[idx];
      if (!key) return;
      const text = key === 'jan' ? cleanJan(cellText(c)) : cellText(c);
      if (text !== '') empty = false;
      if (!(key in data) || data[key] === '') data[key] = text;
    });
    if (!empty) rows.push({ line: i + 1, data });
  }
  return { cols: new Set(keys.filter((k): k is string => !!k)), rows };
}

// ──── 字段读取 ────

/** 进货字段（「商品名」缺失由调用方报错） */
function readPurchase(r: RowReader): ParsedPurchase {
  return {
    where: r.where,
    date: r.date('purchaseDate', '进货日期'),
    productName: r.text('productName'),
    jan: r.text('jan'),
    unitPrice: r.num('unitPrice', '进货单价'),
    quantity: r.num('quantity', '数量', { min: 1, integer: true, fallback: 1 }),
    source: r.text('source'),
    orderId: r.text('orderId'),
    account: r.text('account'),
    shippingFee: r.num('shippingFee', '运费'),
    pointsUsed: r.num('pointsUsed', '使用积分'),
    coupon: r.num('coupon', '优惠券'),
    pointsSite: r.num('pointsSite', '积分(网站)'),
    pointsCard: r.num('pointsCard', '积分(信用卡)'),
    pointsOther: r.num('pointsOther', '积分(其他)'),
    received: truthy(r.text('received')),
    memo: r.text('memo'),
    arrivedQty: 0,
    sales: [],
    returns: [],
  };
}

function hasSaleData(r: RowReader): boolean {
  return ['saleDate', 'saleTarget', 'salePrice', 'saleQty', 'saleOrderId'].some(k => r.has(k));
}

function readSale(r: RowReader): ParsedSale {
  return {
    date: r.date('saleDate', '出售日期'),
    target: r.text('saleTarget'),
    price: r.num('salePrice', '出售单价'),
    qty: r.num('saleQty', '出售数量', { min: 1, integer: true, fallback: 1 }),
    deduction: r.num('deduction', '扣除额'),
    orderId: r.text('saleOrderId'),
    memo: r.text('saleMemo'),
    paid: truthy(r.text('paid')),
  };
}

/** 进货列（用来判断几行是不是同一笔进货） */
const PURCHASE_KEYS = [
  'purchaseDate', 'productName', 'jan', 'unitPrice', 'quantity', 'source', 'orderId', 'account',
  'shippingFee', 'pointsUsed', 'coupon', 'pointsSite', 'pointsCard', 'pointsOther', 'memo',
];

// ──── 两种格式 ────

/** 一张表（CSV / 导入模板）：进货列相同的行合并为一笔进货 */
function parseSingleTable(table: Table, label: string, errors: string[]): ParsedPurchase[] {
  const { cols, rows } = readTable(table);
  if (!cols.has('purchaseDate') || !cols.has('productName')) {
    errors.push(`${label}：找不到「进货日期」「商品名」列，不是可导入的格式`);
    return [];
  }
  const byKey = new Map<string, ParsedPurchase>();
  const purchases: ParsedPurchase[] = [];
  let last: ParsedPurchase | null = null;
  for (const { line, data } of rows) {
    const r = new RowReader(data, `${label} 第 ${line} 行`, errors);
    const purchaseEmpty = !r.has('purchaseDate') && !r.has('productName');
    let purchase: ParsedPurchase;
    if (purchaseEmpty) {
      // 旧版导出：同一笔进货的第 2 条以后的出售，进货列留空
      if (!last || !hasSaleData(r)) {
        errors.push(`${r.where}：缺少「进货日期」「商品名」`);
        continue;
      }
      purchase = last;
    } else {
      if (!r.has('productName')) errors.push(`${r.where}：缺少「商品名」`);
      const key = PURCHASE_KEYS.map(k => r.text(k)).join('\u0001');
      const existing = byKey.get(key);
      if (existing) {
        purchase = existing;
        if (truthy(r.text('received'))) purchase.received = true;
      } else {
        purchase = readPurchase(r);
        byKey.set(key, purchase);
        purchases.push(purchase);
      }
    }
    last = purchase;
    if (hasSaleData(r)) purchase.sales.push(readSale(r));
  }
  return purchases;
}

/** XLSX 全部数据：按表名取各类数据，用「仕入参照キー」关联 */
function parseWorkbook(tables: Table[], errors: string[]): { purchases: ParsedPurchase[]; expenses: ParsedExpense[] } {
  const find = (name: string) => tables.find(t => t.name.trim() === name);
  const purchases: ParsedPurchase[] = [];
  const byRef = new Map<string, ParsedPurchase>();

  const purchaseTable = find(SHEETS.purchases);
  if (purchaseTable) {
    for (const { line, data } of readTable(purchaseTable).rows) {
      const r = new RowReader(data, `「${SHEETS.purchases}」第 ${line} 行`, errors);
      const ref = r.text('ref');
      if (!ref) {
        errors.push(`${r.where}：缺少「仕入参照キー」`);
        continue;
      }
      if (byRef.has(ref)) {
        errors.push(`${r.where}：「仕入参照キー」重复（${ref}）`);
        continue;
      }
      if (!r.has('productName')) errors.push(`${r.where}：缺少「商品名」`);
      const purchase = readPurchase(r);
      byRef.set(ref, purchase);
      purchases.push(purchase);
    }
  }

  const attach = (sheet: string, fn: (p: ParsedPurchase, r: RowReader) => void) => {
    const table = find(sheet);
    if (!table) return;
    for (const { line, data } of readTable(table).rows) {
      const r = new RowReader(data, `「${sheet}」第 ${line} 行`, errors);
      const ref = r.text('ref');
      const purchase = byRef.get(ref);
      if (!purchase) {
        errors.push(`${r.where}：「仕入参照キー」在「${SHEETS.purchases}」表里找不到（${ref || '空'}）`);
        continue;
      }
      fn(purchase, r);
    }
  };
  attach(SHEETS.sales, (p, r) => p.sales.push(readSale(r)));
  attach(SHEETS.returns, (p, r) =>
    p.returns.push({
      date: r.date('returnDate', '返品日'),
      qty: r.num('returnQty', '返品数量', { min: 1, integer: true, fallback: 1 }),
      refund: r.num('refundAmount', '返金額'),
      loss: r.num('lossAmount', '損失額'),
      memo: r.text('returnMemo'),
    }),
  );
  attach(SHEETS.arrivals, (p, r) => {
    r.date('arrivalDate', '着荷日', false);
    p.arrivedQty += r.num('arrivalQty', '着荷数量', { min: 1, integer: true, fallback: 0 });
  });

  const expenses: ParsedExpense[] = [];
  const expenseTable = find(SHEETS.expenses);
  if (expenseTable) {
    for (const { line, data } of readTable(expenseTable).rows) {
      const r = new RowReader(data, `「${SHEETS.expenses}」第 ${line} 行`, errors);
      if (!r.has('expenseCategory')) errors.push(`${r.where}：缺少「カテゴリ」`);
      expenses.push({
        where: r.where,
        category: r.text('expenseCategory'),
        amount: r.num('expenseAmount', '金額', { min: 1 }),
        date: r.date('expenseDate', '経費日'),
        memo: r.text('expenseMemo'),
      });
    }
  }
  return { purchases, expenses };
}

/** 数量关系：出售 + 退货不能超过进货数量 */
function checkQuantities(purchases: ParsedPurchase[], errors: string[]) {
  for (const p of purchases) {
    const sold = p.sales.reduce((s, x) => s + x.qty, 0);
    const returned = p.returns.reduce((s, x) => s + x.qty, 0);
    if (sold + returned > p.quantity) {
      errors.push(`${p.where}：出售 ${sold} + 退货 ${returned} 超过进货数量 ${p.quantity}（${p.productName}）`);
    }
  }
}

/** 解析整个文件：tables 来自 CSV（一张）或 XLSX（各工作表） */
export function parseOrderData(tables: Table[], fileLabel: string): ParsedImport {
  const errors: string[] = [];
  let purchases: ParsedPurchase[];
  let expenses: ParsedExpense[] = [];
  const isWorkbook = tables.some(t => [SHEETS.purchases, SHEETS.sales, SHEETS.returns, SHEETS.expenses].includes(t.name.trim() as never));
  if (isWorkbook) {
    ({ purchases, expenses } = parseWorkbook(tables, errors));
  } else {
    // 一张表的格式（CSV、导入模板）：取第一张不是说明的表
    const table = tables.find(t => !/guide|説明|说明/i.test(t.name)) ?? tables[0];
    purchases = table ? parseSingleTable(table, tables.length > 1 ? `「${table.name}」` : fileLabel, errors) : [];
  }
  checkQuantities(purchases, errors);
  if (purchases.length === 0 && expenses.length === 0 && errors.length === 0) {
    errors.push('文件里没有可导入的数据');
  }
  return { purchases, expenses, errors };
}

// ──── CSV 文本 ────

/** RFC 4180：引号内可含逗号、换行、两个引号表示一个引号；去掉 BOM */
export function parseCsvText(text: string): Cell[][] {
  const src = text.replace(/^﻿/, '');
  const rows: Cell[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
