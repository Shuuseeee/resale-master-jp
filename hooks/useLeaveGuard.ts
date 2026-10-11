'use client';

// 整页表单的「离开前提示未保存」：
//  - 关闭 / 刷新标签页：beforeunload（浏览器自带提示，文案不可改）
//  - 点站内链接（左导航、面包屑、底栏等 <a>）：在 document 捕获阶段拦下，弹确认后再跳转
//  - 页面自己的「返回 / 取消」按钮：调用 requestLeave(继续的动作)
// 不拦浏览器后退 / 侧滑返回（Next 自己处理 popstate，硬拦会和它的历史记录打架）。

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useLeaveGuard(isDirty: boolean) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 新标签页打开，不离开当前页
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      pendingRef.current = () => router.push(url.pathname + url.search + url.hash);
      setShowConfirm(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  /** 页面里的「返回 / 取消」：有未保存的修改时先确认 */
  const requestLeave = useCallback((leave: () => void) => {
    if (!dirtyRef.current) {
      leave();
      return;
    }
    pendingRef.current = leave;
    setShowConfirm(true);
  }, []);

  const confirmLeave = useCallback(() => {
    setShowConfirm(false);
    dirtyRef.current = false;
    const leave = pendingRef.current;
    pendingRef.current = null;
    leave?.();
  }, []);

  const cancelLeave = useCallback(() => {
    setShowConfirm(false);
    pendingRef.current = null;
  }, []);

  return { showConfirm, requestLeave, confirmLeave, cancelLeave };
}
