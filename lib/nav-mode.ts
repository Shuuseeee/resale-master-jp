// lib/nav-mode.ts — 桌面左导航的展开 / 折叠（Loop 实测，design-spec/responsive.md #1–2）
// - 没有保存过手动状态：视口 ≤1365px 自动折叠，≥1366px 展开，随窗口宽度实时变化
// - 用户点过展开 / 折叠后存进 localStorage，之后始终以存储值为准（覆盖自动折叠）
// 生效状态写在 <html data-nav>；首屏前由 app/layout.tsx 的 theme-init 脚本写入（逻辑相同，改动需同步）
'use client';

export const NAV_STORAGE_KEY = 'snutils-nav';
export const NAV_AUTO_COLLAPSE_QUERY = '(max-width: 1365px)';

export function isNavCollapsed() {
  return document.documentElement.getAttribute('data-nav') === 'collapsed';
}

export function hasStoredNavMode() {
  try {
    const stored = window.localStorage.getItem(NAV_STORAGE_KEY);
    return stored === 'expanded' || stored === 'collapsed';
  } catch {
    return false;
  }
}

export function applyNavCollapsed(collapsed: boolean) {
  document.documentElement.setAttribute('data-nav', collapsed ? 'collapsed' : 'expanded');
}

/** 手动展开 / 折叠：立即生效并记住 */
export function setNavCollapsed(collapsed: boolean) {
  applyNavCollapsed(collapsed);
  try {
    window.localStorage.setItem(NAV_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // 存不进去时本次页面仍然生效
  }
}
