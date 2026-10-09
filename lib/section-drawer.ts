// lib/section-drawer.ts — 分区抽屉（Loop 工作区抽屉）的全局状态
// Loop 的导航模型：导航 Tab 对应一个抽屉，抽屉列出这一块的分区，内容区只显示选中的那一个。
// 用在交易列表（状态）、买取价格（视图）、税务申报（年度）、耗材管理（分类）、设置（分区）；数据分析、仪表盘、详情 / 表单页不用。
// 页面用 useSectionDrawer 注册自己的分区，抽屉本体在外壳里（components/shell/SectionDrawer.tsx）。
// 行为照搬 Loop（design-spec/responsive.md #3）：
// - 在这些页面上：抽屉打开 = 导航上对应的 Tab 选中；关掉后 Tab 取消选中，再点该 Tab 重新打开
// - 从导航点进来时打开；其它方式进入（网址、页面内链接、后退）时 ≥1025（内嵌）默认开、≤1024（浮层）默认关
// - 从导航点到另一个有抽屉的页面：抽屉不收起，点击当下就换成新页面的面板；新页面还没挂载时先用上次见过的分区，
//   本次会话第一次进入则只有标题，挂载后补上
// - 选了分区抽屉不自动关
'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

/** 有分区抽屉的页面 → 抽屉标题（与导航上的名称一致） */
export const SECTION_DRAWER_PAGES: Record<string, string> = {
  '/transactions': '交易列表',
  '/kaitorix-prices': '买取价格',
  '/tax-report': '税务申报',
  '/supplies': '耗材管理',
  '/settings': '设置',
};

/** ≥1025 内嵌抽屉（挤压内容），≤1024 浮层抽屉（盖在内容上） */
export const SECTION_DRAWER_INLINE_QUERY = '(min-width: 1025px)';

export interface SectionDrawerItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** 计数徽章（不传或为 0 时不显示） */
  count?: number;
}

export interface SectionDrawerPanel {
  path: string;
  title: string;
  /** null = 页面还没挂载、也没有上次的记录，只显示标题 */
  items: SectionDrawerItem[] | null;
  selected: string | null;
  onSelect: (id: string) => void;
}

interface State {
  open: boolean;
  /** 离开页面后保留最后一个面板，供退场动画显示 */
  panel: SectionDrawerPanel | null;
}

const INITIAL: State = { open: false, panel: null };
let state: State = INITIAL;
const listeners = new Set<() => void>();

/** 当前挂载着的有抽屉的页面 */
let mountedPath: string | null = null;
/** 从导航点进来、等待页面挂载的路径（挂载时据此打开） */
let openRequest: string | null = null;
/** 卸载延后一拍处理：开发模式 StrictMode 会立刻卸载再挂载，不能因此丢掉「从导航点进来」的状态 */
const pendingUnmount = new Map<string, number>();
const lastContent = new Map<string, Pick<SectionDrawerPanel, 'items' | 'selected'>>();

const noop = () => {};

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSectionDrawerState(): State {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

export function hasSectionDrawer(path: string | null): path is string {
  return !!path && path in SECTION_DRAWER_PAGES;
}

function panelFor(path: string): SectionDrawerPanel {
  if (state.panel?.path === path) return state.panel;
  const last = lastContent.get(path);
  return { path, title: SECTION_DRAWER_PAGES[path], items: last?.items ?? null, selected: last?.selected ?? null, onSelect: noop };
}

/** 导航 Tab 被点击：已在该页时重新打开抽屉；去另一个有抽屉的页面时立刻换成该页的面板 */
export function requestSectionDrawer(path: string) {
  if (!hasSectionDrawer(path)) return;
  if (mountedPath === path) {
    setState({ open: true });
    return;
  }
  openRequest = path;
  setState({ open: true, panel: panelFor(path) });
}

export function closeSectionDrawer() {
  setState({ open: false });
}

function mountPage(path: string) {
  const timer = pendingUnmount.get(path);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    pendingUnmount.delete(path);
    mountedPath = path;
    return;
  }
  mountedPath = path;
  const requested = openRequest === path;
  openRequest = null;
  setState({ open: requested || window.matchMedia(SECTION_DRAWER_INLINE_QUERY).matches, panel: panelFor(path) });
}

function unmountPage(path: string) {
  if (mountedPath === path) mountedPath = null;
  pendingUnmount.set(
    path,
    window.setTimeout(() => {
      pendingUnmount.delete(path);
      // 从导航点到另一个有抽屉的页面时面板已经换掉，不动；否则按「关闭」处理（播退场动画）
      if (state.panel?.path === path) setState({ open: false });
    }, 0),
  );
}

function updatePage(path: string, items: SectionDrawerItem[], selected: string, onSelect: (id: string) => void) {
  lastContent.set(path, { items, selected });
  if (state.panel?.path !== path) return;
  setState({ panel: { ...state.panel, items, selected, onSelect } });
}

/** 页面注册自己的分区抽屉。items 里的图标每次渲染都是新对象，按 id / 文字 / 计数判断是否需要更新 */
export function useSectionDrawer({
  path,
  items,
  selected,
  onSelect,
}: {
  path: string;
  items: SectionDrawerItem[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const itemsKey = items.map(item => `${item.id}\u0000${item.label}\u0000${item.count ?? ''}`).join('\u0001');

  useEffect(() => {
    mountPage(path);
    return () => unmountPage(path);
  }, [path]);

  useEffect(() => {
    updatePage(path, itemsRef.current, selected, id => onSelectRef.current(id));
  }, [path, itemsKey, selected]);
}
