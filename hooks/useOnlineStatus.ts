'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * 浏览器当前是否在线（navigator.onLine）。
 * 注意：它只能识别「完全断网 / 飞行模式」，识别不了信号很差但仍显示已连接的状态；
 * 此类情况请求会正常超时失败，由各处的错误处理兜底。
 * 服务端渲染与首次 hydration 一律按在线处理，避免 hydration 不一致。
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
