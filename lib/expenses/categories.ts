// lib/expenses/categories.ts — 经费分类（与买取X 一致，2026-10-11）
// 数据库存买取X 的日文值（导入导出原样对应），界面显示中文。表仍是 supplies_costs（原生 App 在用）。
// 原生 App 的分类枚举还是旧的 4 类（包装材料 / 运输耗材 / 标签打印 / 其他），需要原生跟着改。

export const EXPENSE_CATEGORIES = [
  { value: '送料', label: '运费' },
  { value: '交通費', label: '交通费' },
  { value: '梱包材', label: '包装材料' },
  { value: '保管費', label: '保管费' },
  { value: '消耗品', label: '消耗品' },
  { value: 'その他', label: '其他' },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['value'];

export const DEFAULT_EXPENSE_CATEGORY: ExpenseCategory = '梱包材';

const LABELS = new Map<string, string>(EXPENSE_CATEGORIES.map(c => [c.value, c.label]));

/** 分类的中文显示名；不认识的（如旧数据）原样显示 */
export function expenseCategoryLabel(value: string | null | undefined): string {
  return value ? LABELS.get(value) ?? value : '';
}

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return LABELS.has(value);
}
