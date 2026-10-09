// lib/app-scroll.ts — 页面的滚动容器
// 桌面外壳（≥768）里页面在内容卡片内部滚动（#app-scroll），窗口本身不滚；手机外壳仍是窗口滚动。

export const APP_SCROLL_ID = 'app-scroll';

/** 当前页面的滚动位置：卡片可滚动时取卡片的，否则取窗口的 */
export function getAppScrollTop(): number {
  const el = document.getElementById(APP_SCROLL_ID);
  if (el && el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'visible') {
    return el.scrollTop;
  }
  return window.scrollY;
}
