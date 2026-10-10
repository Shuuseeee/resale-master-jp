// lib/order-data/columns.ts — 与买取X（kaitorix.app「売買管理」）一致的导入导出格式
// 2026-10-10 实测买取X 的导出文件与导入模板：
// - CSV（基本）：一张表 26 列 = 进货 + 出售；一笔进货有多次出售时每行重复完整的进货列；表头跟界面语言（我们导出用中文）
// - XLSX（全部数据）：仕入 / 売却 / 返品 / 着荷 / 経費 / Guide 六张表，用「仕入参照キー」把出售 / 退货 / 到货挂到进货上
// - 导入模板（purchase_template.xlsx）：第一张表与 CSV 相同的 26 列
// 导入时表头日文 / 中文 / 英文都认（买取X 的表头随界面语言变化，我们旧版导出是日文）

/** 字段的规范名 → 各语言表头 */
const ALIASES: Record<string, string[]> = {
  ref: ['仕入参照キー', '进货参照键', 'Purchase Ref'],
  purchaseDate: ['仕入日', '进货日期', 'Purchase Date'],
  productName: ['商品名', 'Product', 'Product Name'],
  jan: ['JAN'],
  unitPrice: ['仕入単価', '进货单价', 'Unit Price'],
  quantity: ['数量', 'Qty', 'Quantity'],
  source: ['仕入先', '进货来源', 'Source', 'Purchase Source'],
  orderId: ['注文ID', '订单ID', 'Order ID'],
  account: ['アカウント', '账号', 'Account'],
  shippingFee: ['送料', '运费', 'Shipping', 'Shipping Fee'],
  pointsUsed: ['ポイント使用', '使用积分', 'Points Used'],
  coupon: ['クーポン', '优惠券', 'Coupon'],
  pointsSite: ['P(サイト)', '积分(网站)', 'Points (Site)'],
  pointsCard: ['P(カード)', '积分(信用卡)', 'Points (Card)'],
  pointsOther: ['P(他)', '积分(其他)', 'Points (Other)'],
  received: ['着荷', '到货', 'Received'],
  memo: ['メモ', '备注', 'Memo'],
  saleDate: ['売却日', '出售日期', 'Sale Date'],
  saleTarget: ['売却先', '出售对象', 'Sold To'],
  salePrice: ['売却単価', '出售单价', 'Sale Price'],
  saleQty: ['売却数量', '出售数量', 'Sale Qty'],
  deduction: ['控除額', '扣除额', 'Deduction'],
  saleOrderId: ['売却注文ID', '出售订单ID', 'Sale Order ID'],
  saleMemo: ['売却メモ', '出售备注', 'Sale Memo'],
  paid: ['入金済み', '已入账', 'Paid', 'Payment Received'],
  returnQty: ['返品数量', '退货数量', 'Return Qty'],
  returnDate: ['返品日', '退货日期', 'Return Date'],
  refundAmount: ['返金額', '退款金额', 'Refund Amount'],
  lossAmount: ['損失額', '损失额', 'Loss Amount'],
  returnMemo: ['返品メモ', '退货备注', 'Return Memo'],
  arrivalDate: ['着荷日', '到货日期', 'Arrival Date'],
  arrivalQty: ['着荷数量', '到货数量', 'Arrived Qty'],
  arrivalMemo: ['着荷メモ', '到货备注', 'Arrival Memo'],
  expenseCategory: ['カテゴリ', '分类', 'Category'],
  expenseAmount: ['金額', '金额', 'Amount'],
  expenseDate: ['経費日', '经费日期', 'Expense Date'],
  expenseMemo: ['経費メモ', '经费备注', 'Expense Memo'],
};

const HEADER_TO_KEY = new Map<string, string>();
for (const [key, names] of Object.entries(ALIASES)) {
  for (const name of names) HEADER_TO_KEY.set(name.toLowerCase(), key);
}

/** 表头 → 规范名（不认识的列返回 null，导入时忽略：计算列、仕入ID、クレジットカードID、取込方法 等） */
export function headerKey(header: string): string | null {
  return HEADER_TO_KEY.get(header.trim().toLowerCase()) ?? null;
}

/** XLSX（全部数据）的表名：按表名判断数据种类（买取X 规则） */
export const SHEETS = {
  purchases: '仕入',
  sales: '売却',
  returns: '返品',
  arrivals: '着荷',
  expenses: '経費',
  guide: 'Guide',
} as const;

/** CSV（基本）/ 导入模板的 26 列（中文表头，与买取X 中文界面导出一致） */
export const CSV_HEADERS = [
  '进货日期', '商品名', 'JAN', '进货单价', '数量', '进货来源', '订单ID', '账号', '运费', '使用积分', '优惠券',
  '积分(网站)', '积分(信用卡)', '积分(其他)', '到货', '备注', '信用卡ID', '导入方式',
  '出售日期', '出售对象', '出售单价', '出售数量', '扣除额', '出售订单ID', '出售备注', '已入账',
] as const;

/** XLSX（全部数据）各表的列（日文表头，与买取X 的 XLSX 导出一致） */
export const XLSX_HEADERS = {
  purchases: [
    '仕入参照キー', '仕入日', '商品名', 'JAN', '仕入単価', '数量', '仕入先', '注文ID', '送料', 'ポイント使用', 'クーポン',
    'P(サイト)', 'P(カード)', 'P(他)', '着荷', 'メモ', '仕入ID', 'アカウント', 'クレジットカードID', '取込方法', '着荷数量',
    '原価', '確定利益', '利益率',
  ],
  sales: ['仕入参照キー', '売却日', '売却先', '売却注文ID', '売却単価', '売却数量', '控除額', '売却メモ', '入金済み'],
  returns: ['仕入参照キー', '返品数量', '返品日', '返金額', '損失額', '返品メモ'],
  arrivals: ['仕入参照キー', '着荷日', '着荷数量', '着荷メモ'],
  expenses: ['カテゴリ', '金額', '経費日', '経費メモ'],
} as const;

/** 耗材分类（app/supplies 的固定 4 类）；经费导入时对不上的分类归「其他」，原分类写进说明 */
export const SUPPLY_CATEGORIES = ['包装材料', '运输耗材', '标签打印', '其他'] as const;
