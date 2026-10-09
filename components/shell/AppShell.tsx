// components/shell/AppShell.tsx — Loop 应用外壳（浅色复刻 base.css .app）
// 桌面（≥768）：grid 两列（导航 / 内容）两行（顶栏 60 / 主体），间距 1px 8px，外边距 0 8 8 0，整屏高；
// 页面放在内容卡片里（Loop 的文档卡片：白底 + 实测阴影），卡片内部滚动。手机（<768）：顶栏 + 底部标签栏，窗口滚动，不加卡片。
'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { APP_SCROLL_ID } from '@/lib/app-scroll';

/** 恢复滚动位置；内容还没长到足够高（如图表挂载后才撑开）时，随内容变化继续补位，最多等 1 秒，用户一滚动就停 */
function restoreScroll(el: HTMLElement, target: number) {
  el.scrollTop = target;
  if (el.scrollTop >= target - 1) return;
  const observer = new ResizeObserver(() => {
    el.scrollTop = target;
    if (el.scrollTop >= target - 1) stop();
  });
  const timer = setTimeout(() => stop(), 1000);
  function stop() {
    observer.disconnect();
    clearTimeout(timer);
    el.removeEventListener('wheel', stop);
    el.removeEventListener('touchstart', stop);
    el.removeEventListener('keydown', stop);
  }
  Array.from(el.children).forEach(child => observer.observe(child));
  el.addEventListener('wheel', stop, { passive: true });
  el.addEventListener('touchstart', stop, { passive: true });
  el.addEventListener('keydown', stop);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth') ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  // 卡片内滚动不会被浏览器的后退恢复覆盖：自己按路径记住位置，后退 / 前进时恢复，其它跳转回到顶部
  const positionsRef = useRef(new Map<string, number>());
  const pathRef = useRef(pathname);
  const traversingRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    // 后退 / 前进：Next 可能已在它自己的 popstate 处理里同步渲染好新页面（实测如此），这时直接恢复；
    // 若还没渲染，先打标记，由下面的 useLayoutEffect 在新页面渲染后恢复
    const handlePopState = () => {
      if (pathRef.current === window.location.pathname) {
        if (el) restoreScroll(el, positionsRef.current.get(window.location.pathname) ?? 0);
      } else {
        traversingRef.current = true;
      }
    };
    window.addEventListener('popstate', handlePopState, { capture: true });
    const handleScroll = () => {
      if (el && pathRef.current) positionsRef.current.set(pathRef.current, el.scrollTop);
    };
    el?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('popstate', handlePopState, { capture: true });
      el?.removeEventListener('scroll', handleScroll);
    };
    // 登录页没有外壳，进入业务页后外壳才出现，需要重新挂监听
  }, [isAuthPage]);

  useLayoutEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    const el = scrollRef.current;
    if (!el) return;
    if (traversingRef.current) restoreScroll(el, positionsRef.current.get(pathname) ?? 0);
    else el.scrollTop = 0;
    traversingRef.current = false;
  }, [pathname]);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="app-shell text-[var(--color-text)]">
      <Navigation />
      <main className="app-main mobile-bottom-pad md:pb-0">
        <div className="app-card">
          <div ref={scrollRef} id={APP_SCROLL_ID} className="app-scroll">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
