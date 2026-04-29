// lib/transactions/columns.ts — 桌面表格列定义的唯一真相源
// TransactionRow、TransactionGroupRow、thead 都依赖此处的顺序和 key

export type TransactionColumnKey =
  | 'date'
  | 'product'
  | 'price'
  | 'channel'
  | 'order'
  | 'account'
  | 'status'
  | 'arrived'
  | 'profit'
  | 'buyback'
  | 'actions';

export interface ColumnConfig {
  key: TransactionColumnKey;
  visible: boolean;
}

export const COLUMN_LABELS: Record<TransactionColumnKey, string> = {
  date: '日期',
  product: '商品名',
  price: '进货单价',
  channel: '来源渠道',
  order: '订单号',
  account: '账号',
  status: '状态',
  arrived: '着荷',
  profit: '利润',
  buyback: '最高买取价',
  actions: '操作',
};

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'date',    visible: true },
  { key: 'product', visible: true },
  { key: 'price',   visible: true },
  { key: 'channel', visible: true },
  { key: 'order',   visible: true },
  { key: 'account', visible: true },
  { key: 'status',  visible: true },
  { key: 'arrived', visible: true },
  { key: 'profit',  visible: true },
  { key: 'buyback', visible: true },
  { key: 'actions', visible: true },
];

/** 全部隐藏时强制显示 product 列，避免空白表格 */
export function effectiveColumns(cfg: ColumnConfig[]): ColumnConfig[] {
  const hasVisible = cfg.some(c => c.visible);
  if (!hasVisible) {
    return cfg.map(c => ({ ...c, visible: c.key === 'product' }));
  }
  return cfg;
}

export function visibleColumnKeys(cfg: ColumnConfig[]): TransactionColumnKey[] {
  return effectiveColumns(cfg)
    .filter(c => c.visible)
    .map(c => c.key);
}
