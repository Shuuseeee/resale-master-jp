// components/fluent/Menu.tsx — Fluent MenuPopover（规格见 design-spec/components/04-menu.css，Loop 实测）
// - 弹层 portal + fixed 定位，紧贴锚点下方（偏移 0）；进场 400ms opacity + 从弹出方向滑入 10px，退场无动画（直接卸载）
// - 打开后焦点落在第一项；↑↓ / Home / End 移动，Esc 关闭并把焦点还给锚点，Tab 关闭
// - variant：shell = 外壳菜单（文档头「…」、头像），glass = 「新建」胶囊的毛玻璃菜单
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Checkmark16Regular } from '@fluentui/react-icons/headless/svg/checkmark';

type Placement = 'bottom-start' | 'bottom-end';

interface MenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  placement?: Placement;
  variant?: 'shell' | 'glass';
  ariaLabel?: string;
  /** 固定宽度（文档头「…」菜单实测 240）；不传时按内容，最小 200 */
  width?: number;
  children: ReactNode;
}

interface Position {
  top: number;
  left?: number;
  right?: number;
}

function computePosition(anchor: HTMLElement, placement: Placement): Position {
  const rect = anchor.getBoundingClientRect();
  return placement === 'bottom-start'
    ? { top: rect.bottom, left: rect.left }
    : { top: rect.bottom, right: window.innerWidth - rect.right };
}

export function Menu({ open, onClose, anchorRef, placement = 'bottom-start', variant = 'shell', ariaLabel, width, children }: MenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const items = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? []),
    [],
  );

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null);
      return;
    }
    setPosition(computePosition(anchorRef.current, placement));
  }, [open, anchorRef, placement]);

  useEffect(() => {
    if (!open || !position) return;
    items()[0]?.focus();
  }, [open, position, items]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (anchorRef.current) setPosition(computePosition(anchorRef.current, placement));
    };
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open, anchorRef, placement, onClose]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      list[(index + step + list.length) % list.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      (e.key === 'Home' ? list[0] : list[list.length - 1])?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      anchorRef.current?.focus();
    } else if (e.key === 'Tab') {
      onClose();
    }
  };

  if (!open || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={ariaLabel}
      className={variant === 'glass' ? 'fluent-menu fluent-menu--glass' : 'fluent-menu fluent-menu--shell'}
      style={{ top: position.top, left: position.left, right: position.right, width }}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>,
    document.body,
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  onSelect: () => void;
  /** 禁用：不可选、跳过键盘焦点，文字用禁用色（Fluent 规则；Loop 现有菜单里未见） */
  disabled?: boolean;
  /** 切换型菜单项（menuitemcheckbox）：选中时行尾显示 16px 勾选图标 */
  checked?: boolean;
  children: ReactNode;
}

export function MenuItem({ icon, onSelect, disabled, checked, children }: MenuItemProps) {
  const select = () => {
    if (!disabled) onSelect();
  };
  return (
    <div
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      className="fluent-menu-item"
      onClick={select}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      }}
    >
      {icon && <span className="fluent-menu-item__icon">{icon}</span>}
      <span className="fluent-menu-item__text">{children}</span>
      {checked && <Checkmark16Regular className="fluent-menu-item__check" />}
    </div>
  );
}

/** 不可操作的信息行（如账户菜单里的邮箱）：尺寸、字色同菜单项，没有交互态 */
export function MenuInfo({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="fluent-menu-item fluent-menu-item--static">
      {icon && <span className="fluent-menu-item__icon">{icon}</span>}
      <span className="fluent-menu-item__text">{children}</span>
    </div>
  );
}

export function MenuDivider() {
  return <div role="separator" className="fluent-menu-divider" />;
}
