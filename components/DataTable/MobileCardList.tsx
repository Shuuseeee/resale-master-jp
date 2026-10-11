// components/DataTable/MobileCardList.tsx
// 通用移动卡片列表：由列 meta.card 槽位驱动，供 supplies / 销售记录等简单表使用
// 交易列表移动端保留自有 TransactionCard，不走此组件

'use client';

import { flexRender, type Cell, type Row } from '@tanstack/react-table';
import { card, empty } from '@/lib/theme';
import type { CardSlot } from './types';
import { SELECT_COLUMN_ID } from './SelectionColumn';
import { cx } from './types';
import type { ReactNode } from 'react';

interface MobileCardListProps<TData> {
  rows: Row<TData>[];
  emptyState?: ReactNode;
}

type SlotGroups<TData> = Record<Exclude<CardSlot, 'hidden'>, Cell<TData, unknown>[]> & { select: Cell<TData, unknown> | null };

const isEmptyValue = (v: unknown) => v === null || v === undefined || v === '';

function groupCells<TData>(row: Row<TData>): SlotGroups<TData> {
  const groups: SlotGroups<TData> = { title: [], subtitle: [], badge: [], field: [], actions: [], select: null };
  for (const cell of row.getVisibleCells()) {
    // 多选列放在卡片标题左边，不当作普通字段
    if (cell.column.id === SELECT_COLUMN_ID) {
      groups.select = cell;
      continue;
    }
    const slot = cell.column.columnDef.meta?.card?.slot ?? 'field';
    if (slot === 'hidden') continue;
    // 没有值的字段不占格子（如未设置的账号）
    if (slot === 'field' && isEmptyValue(cell.getValue())) continue;
    groups[slot].push(cell);
  }
  return groups;
}

function fieldLabel<TData>(cell: Cell<TData, unknown>): string {
  const def = cell.column.columnDef;
  return def.meta?.card?.label ?? (typeof def.header === 'string' ? def.header : '');
}

function MobileCard<TData>({ row }: { row: Row<TData> }) {
  const groups = groupCells(row);
  const hasHeader = groups.title.length > 0 || groups.badge.length > 0 || !!groups.select;

  return (
    <div className={cx(card.primary, 'p-4')}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-2">
          {groups.select && (
            <span className="shrink-0 pt-0.5">{flexRender(groups.select.column.columnDef.cell, groups.select.getContext())}</span>
          )}
          <div className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--color-text)]">
            {groups.title.map(cell => (
              <span key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
            ))}
          </div>
          {groups.badge.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {groups.badge.map(cell => (
                <span key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {groups.subtitle.length > 0 && (
        <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {groups.subtitle.map(cell => (
            <span key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
          ))}
        </div>
      )}
      {groups.field.length > 0 && (
        <div className={cx('grid grid-cols-2 gap-x-4 gap-y-2', hasHeader && 'mt-3')}>
          {groups.field.map(cell => (
            <div key={cell.id}>
              <div className="text-xs text-[var(--color-text-muted)]">{fieldLabel(cell)}</div>
              <div className="text-sm text-[var(--color-text)]">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            </div>
          ))}
        </div>
      )}
      {groups.actions.length > 0 && (
        <div className="mt-3 flex items-center justify-end gap-1 border-t border-[var(--color-border)] pt-2">
          {groups.actions.map(cell => (
            <span key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MobileCardList<TData>({ rows, emptyState }: MobileCardListProps<TData>) {
  if (rows.length === 0) {
    return (
      <div className={empty.container}>
        {emptyState ?? <p className={empty.text}>暂无数据</p>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map(row => (
        <MobileCard key={row.id} row={row} />
      ))}
    </div>
  );
}
