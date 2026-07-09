// components/Select.tsx
// 共用单选下拉组件 — 替代原生 <select>，闭合态与弹层均走主题 token
// 弹层用 createPortal + fixed 定位（getBoundingClientRect），避免被 Modal 的 overflow 裁剪

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';
import { input } from '@/lib/theme';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** trigger 覆盖样式，默认 input.base */
  className?: string;
  /** 选中时在 chevron 前显示内联清除按钮（清除后回到 placeholder 态） */
  clearable?: boolean;
}

interface PopupPos {
  top: number;
  left: number;
  width: number;
  up: boolean;
  maxHeight: number;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  className,
  clearable = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopupPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value && o.value !== '');

  const openPopup = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    // 下方空间不足时向上翻转
    const up = spaceBelow < 180 && spaceAbove > spaceBelow;
    setPos({
      top: up ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      up,
      maxHeight: Math.max(120, Math.min(280, up ? spaceAbove : spaceBelow)),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popupRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onScroll = (e: Event) => {
      // 弹层内部滚动不关闭
      if (popupRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPopup())}
        className={`${className || input.base} flex items-center gap-1 text-left disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className={`flex-1 min-w-0 truncate ${selected ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {clearable && selected && !disabled && (
          <span
            role="button"
            aria-label="清除"
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
            className="flex-shrink-0 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: pos.width,
            transform: pos.up ? 'translateY(-100%)' : undefined,
          }}
          className="z-[10020] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-lg)]"
        >
          <div className="overflow-y-auto py-1" style={{ maxHeight: pos.maxHeight }}>
            {options.filter(o => o.value !== '').map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`flex min-h-[40px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[var(--color-primary-light)] font-medium text-[var(--color-primary)]'
                      : 'text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
