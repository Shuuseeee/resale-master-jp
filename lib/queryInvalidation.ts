// lib/queryInvalidation.ts
// 「哪张表被写入 → 哪些查询缓存要失效」的映射。新增 useQuery 页面时，在这里登记它依赖的表。
//
// 键为 queryKey 的第一段（['dashboard', ...] 的 'dashboard'）。派生数据（仪表盘 / 分析 / 税务）
// 依赖交易、销售、退货，所以这些表的写入会让它们全部失效。

const FINANCIAL = ['transactions', 'dashboard', 'analytics', 'tax-report', 'kaitorix-prices'] as const;

const KEYS_BY_TABLE: Record<string, readonly string[]> = {
  transactions: FINANCIAL,
  sales_records: FINANCIAL,
  return_records: FINANCIAL,
  sale_orders: FINANCIAL,
  // 积分率 / 平台配置会影响利润与积分的换算
  points_platforms: [...FINANCIAL, 'platforms'],
  purchase_platforms: ['platforms', 'analytics', 'transactions', 'dashboard'],
  selling_platforms: ['platforms', 'analytics', 'transactions', 'dashboard'],
  payment_methods: ['analytics', 'transactions', 'payment-methods', 'dashboard'],
  supplies_costs: ['supplies', 'analytics', 'tax-report', 'dashboard'],
  fixed_costs: ['supplies', 'analytics', 'tax-report'],
};

/** 所有已登记的根键：RPC 等无法判断影响范围的写入，保守地让它们全部失效 */
const ALL_KEYS = [...new Set(Object.values(KEYS_BY_TABLE).flat())];

export function queryKeysForTable(table: string): readonly string[] {
  if (table.startsWith('rpc/')) return ALL_KEYS;
  return KEYS_BY_TABLE[table] ?? [];
}
