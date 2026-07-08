// components/DataTable/DataTable.tsx
// 项目级共用表格：headless（@tanstack/react-table）+ lib/theme.ts table.* 片段
// 桌面 <table> 形态 + 可选移动卡片分支；状态受控为主（简单场景排序可非受控）

'use client';

import { memo, useMemo, type MouseEvent } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type Row,
} from '@tanstack/react-table';
import { card, table as tableStyles } from '@/lib/theme';
import { HeaderCell } from './HeaderCell';
import { MobileCardList } from './MobileCardList';
import { createSelectionColumn, SELECT_COLUMN_ID } from './SelectionColumn';
import {
  ALIGN_TEXT_CLASS,
  BREAKPOINT_CELL_CLASS,
  cx,
  type DataTableProps,
} from './types';

function DataTableImpl<TData>({
  data,
  columns,
  getRowId,
  sorting,
  onSortingChange,
  manualSorting = false,
  columnVisibility,
  columnOrder,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  getSubRows,
  expanded,
  onExpandedChange,
  onRowClick,
  rowClassName,
  emptyState,
  bare = false,
  mobile = 'none',
  renderMobileItem,
}: DataTableProps<TData>) {
  const selectionEnabled = enableRowSelection !== undefined && enableRowSelection !== false;

  // 选择列自动注入并钉在最前，与用户列定制（columnOrder 持久化）解耦
  const allColumns = useMemo(
    () => (selectionEnabled ? [createSelectionColumn<TData>(), ...columns] : columns),
    [selectionEnabled, columns],
  );

  const effectiveColumnOrder = useMemo(() => {
    if (!columnOrder) return undefined;
    return selectionEnabled
      ? [SELECT_COLUMN_ID, ...columnOrder.filter(id => id !== SELECT_COLUMN_ID)]
      : columnOrder;
  }, [columnOrder, selectionEnabled]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: {
      ...(sorting !== undefined ? { sorting } : {}),
      ...(columnVisibility !== undefined ? { columnVisibility } : {}),
      ...(effectiveColumnOrder !== undefined ? { columnOrder: effectiveColumnOrder } : {}),
      ...(rowSelection !== undefined ? { rowSelection } : {}),
      ...(expanded !== undefined ? { expanded } : {}),
    },
    onSortingChange,
    onRowSelectionChange,
    onExpandedChange,
    enableRowSelection: enableRowSelection ?? false,
    manualSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    ...(getSubRows ? { getSubRows, getExpandedRowModel: getExpandedRowModel() } : {}),
  });

  const rows = table.getRowModel().rows;

  const handleRowClick = (row: Row<TData>, e: MouseEvent<HTMLTableRowElement>) => {
    if (!onRowClick) return;
    // 点击行内链接/按钮/输入控件时不触发行点击（沿用 TransactionRow 守卫）
    if ((e.target as HTMLElement).closest('a, button, input')) return;
    onRowClick(row, e);
  };

  const tableInner = (
    <div className={tableStyles.wrapper}>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className={tableStyles.theadTr}>
                {headerGroup.headers.map(header => (
                  <HeaderCell key={header.id} header={header} table={table} />
                ))}
              </tr>
            ))}
          </thead>
          <tbody className={tableStyles.tbody}>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-4 py-12 text-center text-[var(--color-text-muted)]"
                >
                  {emptyState ?? '暂无数据'}
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={row.id}
                  onClick={e => handleRowClick(row, e)}
                  className={cx(
                    tableStyles.tr,
                    row.depth > 0 && tableStyles.trChild,
                    row.getIsSelected() && tableStyles.trSelected,
                    // cursor 交给 rowClassName 控制（如仅多选模式下 pointer）
                    rowClassName?.(row),
                  )}
                >
                  {row.getVisibleCells().map(cell => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        className={cx(
                          tableStyles.td,
                          ALIGN_TEXT_CLASS[meta?.align ?? 'left'],
                          meta?.minBreakpoint && BREAKPOINT_CELL_CLASS[meta.minBreakpoint],
                          meta?.tdClassName,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
    </div>
  );

  const desktopTable = bare ? (
    tableInner
  ) : (
    <div className={cx(card.primary, 'overflow-hidden')}>{tableInner}</div>
  );

  if (mobile === 'cards') {
    return (
      <>
        <div className="md:hidden">
          {renderMobileItem ? (
            <div className="space-y-3">
              {rows.map(row => (
                <div key={row.id}>{renderMobileItem(row)}</div>
              ))}
            </div>
          ) : (
            <MobileCardList rows={rows} emptyState={emptyState} />
          )}
        </div>
        <div className="hidden md:block">{desktopTable}</div>
      </>
    );
  }

  return desktopTable;
}

// memo 并保留泛型签名：props 未变的页面重渲染（如搜索输入 debounce 生效前）跳过整表渲染，
// 替代迁移前 TransactionRow 的行级 memo。调用方需保证 getRowId/getSubRows 等函数 props 引用稳定
export const DataTable = memo(DataTableImpl) as typeof DataTableImpl;
