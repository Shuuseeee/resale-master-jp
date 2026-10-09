// lib/settings-nav.ts — 设置页当前显示的分区（桌面在分区抽屉里切换，手机在页面顶部的横向 Tab 里切换）
// 放在模块里而不是页面 state：本次会话里离开设置页再回来，仍停在上次的分区
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

const INITIAL: SettingsSectionId = 'appearance';
let section: SettingsSectionId = INITIAL;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettingsSection(): SettingsSectionId {
  return useSyncExternalStore(subscribe, () => section, () => INITIAL);
}

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some(s => s.id === value);
}

function setSection(next: SettingsSectionId) {
  section = next;
  listeners.forEach(listener => listener());
}

/** 切换分区：写进地址的 hash（replace，不额外占用后退历史），旧链接 /settings#payment-methods 仍可直达 */
export function selectSettingsSection(next: string) {
  if (!isSettingsSectionId(next)) return;
  setSection(next);
  window.history.replaceState(window.history.state, '', `#${next}`);
}

/** 进入设置页：地址带分区 hash 时按 hash 显示 */
export function initSettingsSection() {
  const hash = window.location.hash.slice(1);
  if (isSettingsSectionId(hash)) setSection(hash);
}
