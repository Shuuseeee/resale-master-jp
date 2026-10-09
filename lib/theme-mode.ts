// lib/theme-mode.ts — 深浅色：用户偏好（浅色 / 深色 / 跟随系统）与生效主题
// 首屏前的初始化在 app/layout.tsx 的 theme-init 脚本（不能 import，THEME_COLORS 在那里有一份副本，改动需同步）。
'use client';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'snutils-theme';

/** <meta name="theme-color">：Loop 实测（浅色 #F7F9FC，深色 #1E2022），由 JS 随主题改写 */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  'light': '#F7F9FC',
  'dark': '#1E2022',
};

/** 本机保存的偏好；没有保存过（或旧版本留下的其它值）一律视为跟随系统 */
export function getThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // 读不到存储时按跟随系统处理
  }
  return 'system';
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

export function getResolvedTheme(): ResolvedTheme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** 换肤：Loop 实测没有过渡动画，直接切属性 */
export function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/** 偏好在页面内被改动时广播，供设置页等界面同步显示 */
export const THEME_PREFERENCE_EVENT = 'theme-preference-change';

export function setThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // 存不进去时本次页面仍然立即生效
  }
  applyResolvedTheme(resolveTheme(preference));
  window.dispatchEvent(new CustomEvent(THEME_PREFERENCE_EVENT, { detail: preference }));
}
