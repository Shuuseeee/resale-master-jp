// lib/table/columnPrefs.ts
// ColumnConfig[]（user_preferences 持久化形态）→ TanStack 列状态的换算
// 持久化格式与 TransactionColumnPicker 均不变，仅消费端换算

import type { VisibilityState } from '@tanstack/react-table';
import { effectiveColumns, type ColumnConfig } from '@/lib/transactions/columns';

export interface TableColumnState {
  columnVisibility: VisibilityState;
  columnOrder: string[];
}

/** 含 effectiveColumns 兜底：全部隐藏时强制显示 product 列 */
export function columnPrefsToTableState(cfg: ColumnConfig[]): TableColumnState {
  const effective = effectiveColumns(cfg);
  return {
    columnVisibility: Object.fromEntries(effective.map(c => [c.key, c.visible])),
    columnOrder: effective.map(c => c.key),
  };
}
