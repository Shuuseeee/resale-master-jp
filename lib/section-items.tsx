// lib/section-items.tsx — 有分区抽屉的列表页的分区定义（交易列表的状态、经费的分类）
// 列表页与外壳共用：详情 / 新增 / 编辑等子页面也显示同一个抽屉（lib/section-drawer.ts 的 SECTION_CHILD_PAGES），
// 没先打开过列表页（如从仪表盘直接点进详情）时抽屉用这里的分区（没有计数）。
'use client';

import type { ReactNode } from 'react';
import { Archive20Filled, Archive20Regular } from '@fluentui/react-icons/headless/svg/archive';
import { ArrowRepeatAll20Filled, ArrowRepeatAll20Regular } from '@fluentui/react-icons/headless/svg/arrow-repeat-all';
import { ArrowUndo20Filled, ArrowUndo20Regular } from '@fluentui/react-icons/headless/svg/arrow-undo';
import { Box20Filled, Box20Regular } from '@fluentui/react-icons/headless/svg/box';
import { BoxMultiple20Filled, BoxMultiple20Regular } from '@fluentui/react-icons/headless/svg/box-multiple';
import { CheckmarkCircle20Filled, CheckmarkCircle20Regular } from '@fluentui/react-icons/headless/svg/checkmark-circle';
import { MoreHorizontal20Filled, MoreHorizontal20Regular } from '@fluentui/react-icons/headless/svg/more-horizontal';
import { TextBulletListLtr20Filled, TextBulletListLtr20Regular } from '@fluentui/react-icons/headless/svg/text-bullet-list-ltr';
import { Toolbox20Filled, Toolbox20Regular } from '@fluentui/react-icons/headless/svg/toolbox';
import { VehicleCar20Filled, VehicleCar20Regular } from '@fluentui/react-icons/headless/svg/vehicle-car';
import { VehicleTruckProfile20Filled, VehicleTruckProfile20Regular } from '@fluentui/react-icons/headless/svg/vehicle-truck-profile';
import { Wallet20Filled, Wallet20Regular } from '@fluentui/react-icons/headless/svg/wallet';
import DualIcon from '@/components/fluent/DualIcon';
import { EXPENSE_CATEGORIES } from '@/lib/expenses/categories';

export interface SectionDef {
  id: string;
  label: string;
  icon: ReactNode;
}

// ──── 交易列表：状态标签 ────
// active = 未售出（未到货 + 库存中），其余与 transactions.status 一一对应
export type StatusFilterKey = 'active' | 'all' | 'pending' | 'in_stock' | 'awaiting_payment' | 'sold' | 'returned';
const STATUS_FILTER_KEYS: StatusFilterKey[] = ['active', 'all', 'pending', 'in_stock', 'awaiting_payment', 'sold', 'returned'];
export const DEFAULT_STATUS_FILTER: StatusFilterKey = 'active';
const STATUS_FILTER_STORAGE_KEY = 'transactionListStatusFilter';

export function isStatusFilterKey(v: unknown): v is StatusFilterKey {
  return typeof v === 'string' && (STATUS_FILTER_KEYS as string[]).includes(v);
}

// 记住用户上次选的状态标签（仅本机；隐私模式/禁用存储时静默回落默认值）
export function readStoredStatusFilter(): StatusFilterKey | null {
  try {
    const v = window.localStorage.getItem(STATUS_FILTER_STORAGE_KEY);
    return isStatusFilterKey(v) ? v : null;
  } catch {
    return null;
  }
}

export function storeStatusFilter(key: StatusFilterKey) {
  try {
    window.localStorage.setItem(STATUS_FILTER_STORAGE_KEY, key);
  } catch {
    // 存储不可用时忽略，仅失去「记住选择」
  }
}

export const TRANSACTION_SECTIONS: (SectionDef & { id: StatusFilterKey })[] = [
  { id: 'active', label: '未售出', icon: <DualIcon regular={BoxMultiple20Regular} filled={BoxMultiple20Filled} /> },
  { id: 'all', label: '全部', icon: <DualIcon regular={TextBulletListLtr20Regular} filled={TextBulletListLtr20Filled} /> },
  { id: 'in_stock', label: '库存中', icon: <DualIcon regular={Box20Regular} filled={Box20Filled} /> },
  { id: 'pending', label: '未到货', icon: <DualIcon regular={VehicleTruckProfile20Regular} filled={VehicleTruckProfile20Filled} /> },
  { id: 'awaiting_payment', label: '待入账', icon: <DualIcon regular={Wallet20Regular} filled={Wallet20Filled} /> },
  { id: 'sold', label: '已售出', icon: <DualIcon regular={CheckmarkCircle20Regular} filled={CheckmarkCircle20Filled} /> },
  { id: 'returned', label: '已退货', icon: <DualIcon regular={ArrowUndo20Regular} filled={ArrowUndo20Filled} /> },
];

// ──── 经费：分类（与买取X 一致，见 lib/expenses/categories.ts）+「定期经费」规则管理视图 ────
export const EXPENSE_RECURRING = 'recurring';

const CATEGORY_ICONS: Record<string, ReactNode> = {
  送料: <DualIcon regular={VehicleTruckProfile20Regular} filled={VehicleTruckProfile20Filled} />,
  交通費: <DualIcon regular={VehicleCar20Regular} filled={VehicleCar20Filled} />,
  梱包材: <DualIcon regular={Box20Regular} filled={Box20Filled} />,
  保管費: <DualIcon regular={Archive20Regular} filled={Archive20Filled} />,
  消耗品: <DualIcon regular={Toolbox20Regular} filled={Toolbox20Filled} />,
  その他: <DualIcon regular={MoreHorizontal20Regular} filled={MoreHorizontal20Filled} />,
};

export const EXPENSE_SECTIONS: SectionDef[] = [
  { id: 'all', label: '全部', icon: <DualIcon regular={TextBulletListLtr20Regular} filled={TextBulletListLtr20Filled} /> },
  ...EXPENSE_CATEGORIES.map(c => ({ id: c.value, label: c.label, icon: CATEGORY_ICONS[c.value] })),
  { id: EXPENSE_RECURRING, label: '定期经费', icon: <DualIcon regular={ArrowRepeatAll20Regular} filled={ArrowRepeatAll20Filled} /> },
];

export function isExpenseSection(v: unknown): v is string {
  return typeof v === 'string' && EXPENSE_SECTIONS.some(s => s.id === v);
}
