// components/DataTable/HeaderCell.tsx
// th 渲染：排序按钮 + 方向箭头、headerExtra、对齐、断点隐藏

'use client';

import { flexRender, type Header, type Table } from '@tanstack/react-table';
import { ArrowDown12Regular } from '@fluentui/react-icons/headless/svg/arrow-down';
import { ArrowUp12Regular } from '@fluentui/react-icons/headless/svg/arrow-up';
import { table as tableStyles } from '@/lib/theme';
import {
  ALIGN_JUSTIFY_CLASS,
  ALIGN_TEXT_CLASS,
  BREAKPOINT_CELL_CLASS,
  cx,
} from './types';

interface HeaderCellProps<TData> {
  header: Header<TData, unknown>;
  table: Table<TData>;
}

export function HeaderCell<TData>({ header, table }: HeaderCellProps<TData>) {
  const { column } = header;
  const meta = column.columnDef.meta;
  const align = meta?.align ?? 'left';
  const canSort = column.getCanSort();
  const sorted = column.getIsSorted();

  const content = header.isPlaceholder
    ? null
    : flexRender(column.columnDef.header, header.getContext());

  return (
    <th
      className={cx(
        tableStyles.th,
        ALIGN_TEXT_CLASS[align],
        meta?.minBreakpoint && BREAKPOINT_CELL_CLASS[meta.minBreakpoint],
        meta?.thClassName,
      )}
    >
      <div className={cx('flex items-center gap-1', ALIGN_JUSTIFY_CLASS[align])}>
        {canSort ? (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className={tableStyles.sortBtn}
          >
            {content}
            {/* Fluent 可排序表头：排序后文字右侧 12px 箭头（未排序时不显示），与文字间距 4（10-table.css） */}
            {sorted === 'asc' ? (
              <ArrowUp12Regular className="shrink-0 text-[var(--color-text-secondary)]" />
            ) : sorted === 'desc' ? (
              <ArrowDown12Regular className="shrink-0 text-[var(--color-text-secondary)]" />
            ) : null}
          </button>
        ) : (
          content
        )}
        {meta?.headerExtra?.(table)}
      </div>
    </th>
  );
}
