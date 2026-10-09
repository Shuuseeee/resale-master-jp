// lib/settings-nav.ts — 设置页的分区与分区抽屉状态（左导航「设置」Tab、抽屉、设置页三处共用）
// 照搬 Loop 的抽屉行为（design-spec/responsive.md #3）：
// - 抽屉对应导航上的「设置」Tab：抽屉打开时 Tab 选中；关掉抽屉 Tab 取消选中，再点「设置」重新打开
// - 从导航点「设置」进来时打开；直接打开网址时，宽屏（≥1025，内嵌）默认打开，窄屏（≤1024，浮层）默认关闭
// - 选了分区抽屉不自动关
'use client';

import { useSyncExternalStore } from 'react';

export const SETTINGS_SECTIONS = [
  { id: 'appearance', label: '外观' },
  { id: 'amazon', label: 'Amazon 积分' },
  { id: 'payment-methods', label: '支付方式' },
  { id: 'kaitorix', label: '买取价格检查' },
  { id: 'csv-import', label: 'CSV 导入' },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

/** ≥1025 内嵌抽屉（挤压内容），≤1024 浮层抽屉（盖在内容上） */
export const SETTINGS_DRAWER_INLINE_QUERY = '(min-width: 1025px)';

/** 抽屉：unset = 还没决定（进入设置页时按宽度给默认值） */
export type SettingsDrawerState = 'open' | 'closed' | 'unset';

interface State {
  drawer: SettingsDrawerState;
  section: SettingsSectionId;
}

const INITIAL: State = { drawer: 'unset', section: 'appearance' };
let state: State = INITIAL;
const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettingsNav(): State {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some(s => s.id === value);
}

export function openSettingsDrawer() {
  setState({ drawer: 'open' });
}

export function closeSettingsDrawer() {
  setState({ drawer: 'closed' });
}

/** 离开设置页时调用：下次进来重新按入口与宽度决定 */
export function resetSettingsDrawer() {
  setState({ drawer: 'unset' });
}

/** 切换分区：写进地址的 hash（replace，不额外占用后退历史），旧链接 /settings#payment-methods 仍可直达 */
export function selectSettingsSection(section: SettingsSectionId) {
  setState({ section });
  window.history.replaceState(window.history.state, '', `#${section}`);
}

/** 进入设置页：按 hash 定分区，抽屉没有明确状态时按宽度给默认值 */
export function initSettingsNav() {
  const hash = window.location.hash.slice(1);
  setState({
    section: isSettingsSectionId(hash) ? hash : state.section,
    drawer: state.drawer === 'unset' ? (window.matchMedia(SETTINGS_DRAWER_INLINE_QUERY).matches ? 'open' : 'closed') : state.drawer,
  });
}
