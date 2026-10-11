// lib/section-drawer.ts — 分区抽屉（Loop 工作区抽屉）的全局状态
// Loop 的导航模型：导航 Tab 对应一个抽屉，抽屉列出这一块的分区，内容区只显示选中的那一个。
// 用在交易列表（状态）、税务申报（年度）、经费（分类）、设置（分区）；仪表盘不用。
// 页面用 useSectionDrawer 注册自己的分区，抽屉本体在外壳里（components/shell/SectionDrawer.tsx）。
// 这一块的子页面（交易详情 / 新增 / 编辑、经费新增 / 编辑）也显示同一个抽屉（Loop：在工作区里打开哪一页，抽屉都在），
// 由外壳按路径前缀处理（syncSectionRoute），子页面不用写任何代码；抽屉里没有选中项，点分区回到列表并选中它。
// 行为照搬 Loop（design-spec/responsive.md #3）：
// - 在这些页面上：抽屉打开 = 导航上对应的 Tab 选中；关掉后 Tab 取消选中，再点该 Tab 重新打开
// - 从导航点进来时打开；其它方式进入（网址、页面内链接、后退）时 ≥1025（内嵌）默认开、≤1024（浮层）默认关
// - 从导航点到另一个有抽屉的页面：抽屉不收起，点击当下就换成新页面的面板；新页面还没挂载时先用上次见过的分区，
//   本次会话第一次进入则只有标题，挂载后补上
// - 选了分区抽屉不自动关
'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { EXPENSE_SECTIONS, TRANSACTION_SECTIONS, isStatusFilterKey, storeStatusFilter } from '@/lib/section-items';

/** 有分区抽屉的页面 → 抽屉标题（与导航上的名称一致） */
export const SECTION_DRAWER_PAGES: Record<string, string> = {
  '/transactions': '交易列表',
  '/tax-report': '税务申报',
  '/supplies': '经费',
  '/settings': '设置',
};

/** 有子页面的抽屉：子页面上显示的分区（没先进过列表页时用，没有计数）、点分区回到列表的地址 */
const SECTION_CHILD_PAGES: Record<string, { items: SectionDrawerItem[]; href: (id: string) => string; onPick?: (id: string) => void }> = {
  '/transactions': {
    items: TRANSACTION_SECTIONS,
    href: id => `/transactions?tab=${id}`,
    // 在抽屉里点选 = 用户主动选择，和列表页一样记住（列表页只在点选时写入记忆）
    onPick: id => {
      if (isStatusFilterKey(id)) storeStatusFilter(id);
    },
  },
  '/supplies': { items: EXPENSE_SECTIONS, href: id => `/supplies?section=${id}` },
};

/** 路径所属的抽屉页面：列表页本身或它的子页面（/transactions/xxx → /transactions） */
export function sectionBaseOf(pathname: string | null): string | null {
  if (!pathname) return null;
  return Object.keys(SECTION_DRAWER_PAGES).find(base => pathname === base || pathname.startsWith(base + '/')) ?? null;
}

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
  /** 子页面上的面板（没有选中项，点分区跳回列表） */
  child?: boolean;
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
/** 当前路径所属的抽屉页面（外壳在路径变化时更新）；页面挂载时它还是上一个路径的值，用来判断是不是在同一块里切换 */
let activeBase: string | null = null;
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
  if (state.panel?.path === path && !state.panel.child) return state.panel;
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
  // 从同一块的子页面回来（详情 → 列表）：保持抽屉原来的开关
  const sameSection = activeBase === path && state.panel?.path === path;
  const open = requested || (sameSection ? state.open : window.matchMedia(SECTION_DRAWER_INLINE_QUERY).matches);
  setState({ open, panel: panelFor(path) });
}

function unmountPage(path: string) {
  if (mountedPath === path) mountedPath = null;
  pendingUnmount.set(
    path,
    window.setTimeout(() => {
      pendingUnmount.delete(path);
      // 从导航点到另一个有抽屉的页面时面板已经换掉，进了自己的子页面时面板已换成子页面的，都不动；否则按「关闭」处理（播退场动画）
      if (state.panel?.path === path && !state.panel.child) setState({ open: false });
    }, 0),
  );
}

/**
 * 外壳在路径变化时调用：进入有抽屉的列表页的子页面时显示该页的抽屉；离开这一块时收起子页面的抽屉。
 * 列表页本身由页面的 useSectionDrawer 处理。navigate = router.push（点分区回到列表）。
 */
export function syncSectionRoute(pathname: string | null, navigate: (href: string) => void) {
  const base = sectionBaseOf(pathname);
  const prev = activeBase;
  activeBase = base;
  if (!base) {
    if (state.panel?.child) setState({ open: false });
    return;
  }
  const def = SECTION_CHILD_PAGES[base];
  if (pathname === base || !def) return;
  // 在同一块里切换（列表 → 详情、详情 → 编辑）保持抽屉原来的开关；从别处进来按宽度默认（≥1025 开）
  const open = prev === base && state.panel?.path === base ? state.open : window.matchMedia(SECTION_DRAWER_INLINE_QUERY).matches;
  const items = lastContent.get(base)?.items ?? def.items;
  setState({
    open,
    panel: {
      path: base,
      title: SECTION_DRAWER_PAGES[base],
      items,
      selected: null,
      child: true,
      onSelect: id => {
        def.onPick?.(id);
        navigate(def.href(id));
      },
    },
  });
}

/** 本次会话这一页上次选中的分区（列表页重新挂载时恢复，如从编辑页返回经费列表） */
export function lastSectionSelected(path: string): string | null {
  return lastContent.get(path)?.selected ?? null;
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
