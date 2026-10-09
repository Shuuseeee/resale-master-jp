// components/shell/SectionDrawer.tsx — 分区抽屉（Loop 工作区抽屉：浅色复刻 03-drawer.css、深色 design-spec/dark.css、
// 浮层样式 design-spec/components/09-overlay-drawer.css、行为 responsive.md #3、面板切换 js/sections/02-nav.js）
// 状态与各页的分区在 lib/section-drawer.ts
// - ≥1025 内嵌在左导航右侧（挤压内容）；768–1024 浮层（盖在内容上、毛玻璃、透明遮罩点外部关闭、Esc 关闭）；<768 不用抽屉
// - 进场 translate3d(-320px→0) + 淡入 250ms cubic-bezier(0,0,0,1)；退场反向 250ms cubic-bezier(0.8,0,0.78,1)；内容区宽度瞬间跳变
// - 抽屉开着时换成另一页的面板：opacity 200ms 线性 + translateX(-20px→0) 200ms cubic-bezier(0.33,0,0.1,1)
'use client';

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SECTION_DRAWER_INLINE_QUERY, closeSectionDrawer, useSectionDrawerState } from '@/lib/section-drawer';

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    callback => {
      const media = window.matchMedia(query);
      media.addEventListener('change', callback);
      return () => media.removeEventListener('change', callback);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

/** Loop 实测：系统「减少动态效果」时抽屉动画压到 1ms（design-spec/components/21-misc.css #29）；面板切换同样处理（待补测） */
function duration(ms: number) {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : ms;
}

const OFF: Keyframe = { opacity: 0, transform: 'translate3d(-320px, 0, 0)' };
const ON: Keyframe = { opacity: 1, transform: 'translate3d(0px, 0px, 0px)' };

export default function SectionDrawer() {
  const { open: wantOpen, panel } = useSectionDrawerState();
  const inline = useMediaQuery(SECTION_DRAWER_INLINE_QUERY);
  // 手机外壳（<768）不用抽屉，各页在页面里切换分区
  const desktopShell = useMediaQuery('(min-width: 768px)');
  const open = wantOpen && desktopShell && !!panel;
  const [rendered, setRendered] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inlineRef = useRef(inline);
  const shownPathRef = useRef<string | null>(null);

  // 浮层进场 / 退场时阴影也从无到 shadow64（实测）
  const keyframes = (from: Keyframe, to: Keyframe): Keyframe[] => {
    if (inline) return [from, to];
    const shadow = getComputedStyle(document.documentElement).getPropertyValue('--shadow64').trim();
    return [
      { ...from, boxShadow: from === OFF ? 'none' : shadow },
      { ...to, boxShadow: to === OFF ? 'none' : shadow },
    ];
  };

  // 关闭：先播退场动画，结束后再卸载
  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    const el = drawerRef.current;
    if (!el) {
      setRendered(false);
      return;
    }
    const animation = el.animate(keyframes(ON, OFF), { duration: duration(250), easing: 'cubic-bezier(0.8, 0, 0.78, 1)', fill: 'forwards' });
    animation.onfinish = () => setRendered(false);
    return () => animation.cancel();
    // keyframes 依赖 inline，开关期间不会变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 打开：挂载后播进场动画；浮层把焦点放到关闭按钮（实测）
  useLayoutEffect(() => {
    if (!open || !rendered) return;
    const el = drawerRef.current;
    if (!el) return;
    el.animate(keyframes(OFF, ON), { duration: duration(250), easing: 'cubic-bezier(0, 0, 0, 1)' });
    if (!inline) closeRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rendered]);

  // 抽屉开着时换成另一页的面板：播面板切换动画（刚打开时只有进场动画）
  const panelPath = panel?.path ?? null;
  useLayoutEffect(() => {
    if (!rendered) {
      shownPathRef.current = null;
      return;
    }
    if (!open) return;
    const prev = shownPathRef.current;
    shownPathRef.current = panelPath;
    const el = panelRef.current;
    if (!prev || prev === panelPath || !el) return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duration(200), easing: 'cubic-bezier(0, 0, 1, 1)' });
    el.animate([{ transform: 'translateX(-20px)' }, { transform: 'translateX(0px)' }], { duration: duration(200), easing: 'cubic-bezier(0.33, 0, 0.1, 1)' });
  }, [open, rendered, panelPath]);

  // 缩到 ≤1024（抽屉变浮层）时默认关闭（实测）
  useEffect(() => {
    if (inlineRef.current && !inline) closeSectionDrawer();
    inlineRef.current = inline;
  }, [inline]);

  // 浮层：Esc 关闭，焦点回到导航上对应的 Tab
  useEffect(() => {
    if (!open || inline || !panelPath) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeSectionDrawer();
      document.querySelector<HTMLElement>(`.nav-rail__tab[href="${panelPath}"]`)?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, inline, panelPath]);

  if (!rendered || !panel) return null;

  // 方向键在分区之间移动焦点（Fluent Tree：↑↓ / Home / End），Enter / 空格选中；只有选中项进 Tab 序列
  const handleTreeKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.section-tree__layout'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = Math.min(index + 1, items.length - 1);
    else if (e.key === 'ArrowUp') next = Math.max(index - 1, 0);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    items[next]?.focus();
  };

  const drawer = (
    <div
      ref={drawerRef}
      className={inline ? 'section-drawer' : 'section-drawer section-drawer--overlay'}
      role={inline ? undefined : 'dialog'}
      aria-label={panel.title}
    >
      <div ref={panelRef} className="section-drawer__panel">
        <div className="section-drawer__header">
          <div className="section-drawer__header-row">
            <h2 className="section-drawer__title">{panel.title}</h2>
            <button ref={closeRef} type="button" className="shell-icon-btn" aria-label="关闭侧栏" onClick={closeSectionDrawer}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="section-drawer__body">
          {panel.items && (
            <div className="section-tree" role="tablist" aria-orientation="vertical" aria-label={panel.title} onKeyDown={handleTreeKeyDown}>
              {panel.items.map((item, index) => {
                const selected = item.id === panel.selected;
                // 还没有选中项时让第一项进 Tab 序列
                const focusable = selected || (index === 0 && !panel.items?.some(i => i.id === panel.selected));
                return (
                  <div key={item.id} className="section-tree__item">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      data-selected={selected || undefined}
                      tabIndex={focusable ? 0 : -1}
                      className="section-tree__layout"
                      onClick={() => panel.onSelect(item.id)}
                    >
                      <span className="section-tree__icon">{item.icon}</span>
                      <span className="section-tree__label">{item.label}</span>
                      {!!item.count && <span className="section-tree__count">{item.count}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (inline) return drawer;

  return createPortal(
    <>
      {/* 浮层的遮罩是全透明的，只用于点外部关闭（实测） */}
      <div className="section-drawer-backdrop" onClick={closeSectionDrawer} aria-hidden="true" />
      {drawer}
    </>,
    document.body,
  );
}
