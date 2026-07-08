// components/DataTable/types.ts
// 共用 DataTable 的类型定义：TanStack ColumnMeta 扩展 + Props + 样式查表

import '@tanstack/react-table';
import type {
  ColumnDef,
  ExpandedState,
  OnChangeFn,
  Row,
  RowData,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from '@tanstack/react-table';
import type { MouseEvent, ReactNode } from 'react';

export type CellAlign = 'left' | 'center' | 'right';

/** 响应式断点：列在 >= 该断点才显示（缺省 = 始终显示） */
export type TableBreakpoint = 'lg' | 'xl';

/** 通用移动卡片（MobileCardList）中该列的渲染角色 */
export type CardSlot = 'title' | 'subtitle' | 'field' | 'badge' | 'actions' | 'hidden';

export interface CardMeta {
  slot: CardSlot;
  /** field 槽位的标签；缺省用列 header（仅当 header 为字符串时） */
  label?: string;
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** 单元格水平对齐，默认 left */
    align?: CellAlign;
    /** th 附加类（如 'w-10'、'min-w-[90px]'） */
    thClassName?: string;
    /** td 附加类（如 'whitespace-nowrap'、'font-mono'） */
    tdClassName?: string;
    /** 中间宽度（md~lg）低优先级列的断点隐藏，用静态 CSS 类实现 */
    minBreakpoint?: TableBreakpoint;
    /** 表头附加控件（排序按钮旁，如日期/利润双模式切换） */
    headerExtra?: (table: Table<TData>) => ReactNode;
    /** 通用移动卡片的渲染角色（仅 mobile='cards' 且未提供 renderMobileItem 时消费） */
    card?: CardMeta;
  }
}

export interface DataTableProps<TData> {
  data: TData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  getRowId: (row: TData, index: number) => string;

  /* 排序：受控三件套；manualSorting=true 时只渲染箭头不排数据（数据在外部预排序） */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;

  /* 列可见性/顺序（受控；由 lib/table/columnPrefs.ts 从 ColumnConfig[] 换算） */
  columnVisibility?: VisibilityState;
  columnOrder?: string[];

  /* 行选择：传入即启用并自动注入 '_select' 选择列（钉在最前） */
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;

  /* 行展开（树形子行，交易 JAN 分组用） */
  getSubRows?: (row: TData) => TData[] | undefined;
  expanded?: ExpandedState;
  onExpandedChange?: OnChangeFn<ExpandedState>;

  /* 行为与外观 */
  onRowClick?: (row: Row<TData>, e: MouseEvent<HTMLTableRowElement>) => void;
  rowClassName?: (row: Row<TData>) => string;
  emptyState?: ReactNode;

  /* 响应式：'cards' = <md 渲染卡片分支；'none' = 移动端由调用方自渲染 */
  mobile?: 'cards' | 'none';
  renderMobileItem?: (row: Row<TData>) => ReactNode;
}

/** Tailwind 需要静态可提取的完整类名，断点类一律查表，禁止模板拼接 */
export const BREAKPOINT_CELL_CLASS: Record<TableBreakpoint, string> = {
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

export const ALIGN_TEXT_CLASS: Record<CellAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export const ALIGN_JUSTIFY_CLASS: Record<CellAlign, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
