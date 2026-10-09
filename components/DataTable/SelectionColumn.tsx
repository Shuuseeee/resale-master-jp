// components/DataTable/SelectionColumn.tsx
// 内置选择列：th 三态全选 + 行 checkbox。列 id 固定 '_select'，由 DataTable 钉在最前

'use client';

import type { ColumnDef } from '@tanstack/react-table';

export const SELECT_COLUMN_ID = '_select';

// Fluent 方形复选框（globals.css .fluent-checkbox，design-spec/components/06-checkbox.css B）
const checkboxClass = 'fluent-checkbox';

export function createSelectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: SELECT_COLUMN_ID,
    enableSorting: false,
    header: ({ table }) => (
      <input
        type="checkbox"
        aria-label="全选"
        className={checkboxClass}
        checked={table.getIsAllRowsSelected()}
        ref={el => {
          if (el) el.indeterminate = !table.getIsAllRowsSelected() && table.getIsSomeRowsSelected();
        }}
        onChange={table.getToggleAllRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) =>
      row.getCanSelect() ? (
        <input
          type="checkbox"
          aria-label="选择此行"
          className={checkboxClass}
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ) : null,
    meta: { align: 'center', thClassName: 'w-10', tdClassName: 'w-10' },
  };
}
