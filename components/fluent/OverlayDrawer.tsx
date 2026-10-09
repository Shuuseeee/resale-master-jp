// components/fluent/OverlayDrawer.tsx — 右侧覆盖式抽屉（Fluent OverlayDrawer，design-spec/components/09-overlay-drawer.css）
// 买取价格页的详情抽屉 = Loop 浮层抽屉的样式 + 版本历史抽屉的方向（从右侧进出），用户确认的映射
// - 桌面（≥768）：毛玻璃底、radius 12、shadow64；遮罩全透明，只用于点外部关闭；Esc 关闭
//   进场 translate3d(+宽度→0) + opacity + 阴影 250ms cubic-bezier(0,0,0,1)；退场反向 250ms cubic-bezier(0.8,0,0.78,1)
// - 手机（<768）：保持原来的整屏面板 + 半透明遮罩，无动画
'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

function duration() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 250;
}

function isDesktop() {
  return window.matchMedia('(min-width: 768px)').matches;
}

export default function OverlayDrawer({
  open,
  onClose,
  className = '',
  style,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [rendered, setRendered] = useState(open);
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const frames = (on: boolean): Keyframe => {
    const el = panelRef.current;
    const width = el ? el.getBoundingClientRect().width : 0;
    const shadow = getComputedStyle(document.documentElement).getPropertyValue('--shadow64').trim();
    return on
      ? { opacity: 1, transform: 'translate3d(0px, 0px, 0px)', boxShadow: shadow }
      : { opacity: 0, transform: `translate3d(${width}px, 0px, 0px)`, boxShadow: 'none' };
  };

  // 关闭：桌面先播退场再卸载，手机直接卸载
  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    const el = panelRef.current;
    if (!el || !isDesktop()) {
      setRendered(false);
      return;
    }
    const animation = el.animate([frames(true), frames(false)], { duration: duration(), easing: 'cubic-bezier(0.8, 0, 0.78, 1)', fill: 'forwards' });
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration(), easing: 'linear', fill: 'forwards' });
    animation.onfinish = () => setRendered(false);
    return () => animation.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 打开：挂载后播进场
  useLayoutEffect(() => {
    if (!open || !rendered || !isDesktop()) return;
    panelRef.current?.animate([frames(false), frames(true)], { duration: duration(), easing: 'cubic-bezier(0, 0, 0, 1)' });
    backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duration(), easing: 'linear' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!rendered) return null;

  return createPortal(
    <div className="overlay-drawer-layer">
      <div ref={backdropRef} className="overlay-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside ref={panelRef} role="dialog" aria-modal="true" className={`overlay-drawer ${className}`} style={style}>
        {children}
      </aside>
    </div>,
    document.body,
  );
}
