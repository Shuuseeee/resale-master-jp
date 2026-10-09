// components/settings/SettingsDrawer.tsx — 设置页的分区抽屉（Loop 工作区抽屉：浅色复刻 03-drawer.css、深色 design-spec/dark.css、
// 浮层样式 design-spec/components/09-overlay-drawer.css、行为 responsive.md #3）
// - ≥1025 内嵌在左导航右侧（挤压内容）；768–1024 浮层（盖在内容上、毛玻璃、透明遮罩点外部关闭、Esc 关闭）
// - 进场 translate3d(-320px→0) + 淡入 250ms cubic-bezier(0,0,0,1)；退场反向 250ms cubic-bezier(0.8,0,0.78,1)；内容区宽度瞬间跳变
'use client';

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { CreditCard, FileUp, Palette, ShoppingCart, Store, X } from 'lucide-react';
import {
  SETTINGS_DRAWER_INLINE_QUERY,
  SETTINGS_SECTIONS,
  closeSettingsDrawer,
  selectSettingsSection,
  useSettingsNav,
  type SettingsSectionId,
} from '@/lib/settings-nav';

export const SETTINGS_SECTION_ICONS: Record<SettingsSectionId, ReactNode> = {
  appearance: <Palette className="h-5 w-5" />,
  amazon: <ShoppingCart className="h-5 w-5" />,
  'payment-methods': <CreditCard className="h-5 w-5" />,
  kaitorix: <Store className="h-5 w-5" />,
  'csv-import': <FileUp className="h-5 w-5" />,
};

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

/** Loop 实测：系统「减少动态效果」时抽屉动画压到 1ms（design-spec/components/21-misc.css #29） */
function duration() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 250;
}

const OFF: Keyframe = { opacity: 0, transform: 'translate3d(-320px, 0, 0)' };
const ON: Keyframe = { opacity: 1, transform: 'translate3d(0px, 0px, 0px)' };

export default function SettingsDrawer() {
  const { drawer, section } = useSettingsNav();
  const pathname = usePathname();
  const inline = useMediaQuery(SETTINGS_DRAWER_INLINE_QUERY);
  // 手机外壳（<768）不用抽屉，分区在页面顶部的横向 Tab 里切换
  const desktopShell = useMediaQuery('(min-width: 768px)');
  // 离开设置页也按「关闭」处理：播完退场动画再卸载，与点 × 一致
  const open = drawer === 'open' && desktopShell && pathname === '/settings';
  const [rendered, setRendered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inlineRef = useRef(inline);

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
    const el = panelRef.current;
    if (!el) {
      setRendered(false);
      return;
    }
    const animation = el.animate(keyframes(ON, OFF), { duration: duration(), easing: 'cubic-bezier(0.8, 0, 0.78, 1)', fill: 'forwards' });
    animation.onfinish = () => setRendered(false);
    return () => animation.cancel();
    // keyframes 依赖 inline，开关期间不会变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 打开：挂载后播进场动画；浮层把焦点放到关闭按钮（实测）
  useLayoutEffect(() => {
    if (!open || !rendered) return;
    const el = panelRef.current;
    if (!el) return;
    el.animate(keyframes(OFF, ON), { duration: duration(), easing: 'cubic-bezier(0, 0, 0, 1)' });
    if (!inline) closeRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rendered]);

  // 缩到 ≤1024（抽屉变浮层）时默认关闭（实测）
  useEffect(() => {
    if (inlineRef.current && !inline) closeSettingsDrawer();
    inlineRef.current = inline;
  }, [inline]);

  // 浮层：Esc 关闭，焦点回到导航上的「设置」
  useEffect(() => {
    if (!open || inline) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeSettingsDrawer();
      document.querySelector<HTMLElement>('.nav-rail__tab[href="/settings"]')?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, inline]);

  if (!rendered) return null;

  // 方向键在分区之间移动焦点（Fluent Tree：↑↓ / Home / End），Enter / 空格选中；只有选中项进 Tab 序列
  const handleTreeKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.settings-tree__layout'));
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

  const panel = (
    <div
      ref={panelRef}
      className={inline ? 'settings-drawer' : 'settings-drawer settings-drawer--overlay'}
      role={inline ? undefined : 'dialog'}
      aria-label="设置分区"
    >
      <div className="settings-drawer__header">
        <div className="settings-drawer__header-row">
          <h2 className="settings-drawer__title">设置</h2>
          <button ref={closeRef} type="button" className="shell-icon-btn" aria-label="关闭侧栏" onClick={closeSettingsDrawer}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="settings-drawer__body">
        <div className="settings-tree" role="tablist" aria-orientation="vertical" aria-label="设置分区" onKeyDown={handleTreeKeyDown}>
          {SETTINGS_SECTIONS.map(item => {
            const selected = item.id === section;
            return (
              <div key={item.id} className="settings-tree__item">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  data-selected={selected || undefined}
                  tabIndex={selected ? 0 : -1}
                  className="settings-tree__layout"
                  onClick={() => selectSettingsSection(item.id)}
                >
                  <span className="settings-tree__icon">{SETTINGS_SECTION_ICONS[item.id]}</span>
                  <span className="settings-tree__label">{item.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (inline) return panel;

  return createPortal(
    <>
      {/* 浮层的遮罩是全透明的，只用于点外部关闭（实测） */}
      <div className="settings-drawer-backdrop" onClick={closeSettingsDrawer} aria-hidden="true" />
      {panel}
    </>,
    document.body,
  );
}
