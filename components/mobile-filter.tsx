// components/mobile-filter.tsx — 手机端筛选的共用部件（交易页、仪表盘统一）：横向 chip 栏里的 Chip、底部弹层 FilterSheet、
// 弹层内的勾选列表 SheetCheckList（多选）/ SheetOptionList（单选，即点即生效）。chip 栏容器用 CHIP_BAR 类。
'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Checkmark16Regular } from '@fluentui/react-icons/headless/svg/checkmark';
import { ChevronDown16Regular } from '@fluentui/react-icons/headless/svg/chevron-down';
import { Dismiss16Regular } from '@fluentui/react-icons/headless/svg/dismiss';

/** 横向 chip 栏（lg 以下显示，可横向滑动、隐藏滚动条） */
export const CHIP_BAR = 'flex gap-2 overflow-x-auto lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** chip 栏最前的「清除」 */
export function ClearChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 flex-shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-text-muted)] active:text-[var(--color-danger)]"
    >
      <Dismiss16Regular className="h-3.5 w-3.5" />
      清除
    </button>
  );
}

// ── 移动端筛选 chip ──────────────────────────────────────
export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 flex-shrink-0 items-center gap-1 rounded-full border px-3 text-sm transition-colors ${
        active
          ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-light)] font-semibold text-[var(--color-primary)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)]'
      }`}
    >
      <span className="max-w-[40vw] truncate">{label}</span>
      <ChevronDown16Regular className={`h-3.5 w-3.5 flex-shrink-0 ${active ? '' : 'text-[var(--color-text-muted)]'}`} />
    </button>
  );
}

// ── 移动端筛选底部弹层 ──────────────────────────────────
export interface FilterSheetProps {
  title: string;
  onClose: () => void;
  onReset?: () => void;
  showReset?: boolean;
  children: React.ReactNode;
}

export function FilterSheet({ title, onClose, onReset, showReset = false, children }: FilterSheetProps) {
  // 锁定背景滚动（与 Modal 相同策略）
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[10010] lg:hidden">
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[70vh] flex-col rounded-t-[20px] border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] animate-slide-up">
        <div className="mx-auto mt-2 h-1 w-12 flex-shrink-0 rounded-full bg-[var(--color-border)]" />
        <div className="flex flex-shrink-0 items-center justify-between px-4 pb-1 pt-1.5">
          <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
          <div className="flex items-center">
            {showReset && onReset && (
              <button type="button" onClick={onReset} className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] active:text-[var(--color-danger)]">
                重置
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)]">
              完成
            </button>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── 弹层内多选列表（即点即生效）──────────────────────────
export function SheetCheckList({
  options,
  selected,
  onToggle,
  mono = false,
}: {
  options: { value: string; label: string; hint?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  mono?: boolean;
}) {
  if (options.length === 0) {
    return <div className="px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">无可选项</div>;
  }
  return (
    <div>
      {options.map(opt => {
        const checked = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] px-3 text-left text-sm transition-colors active:bg-[var(--color-bg-pressed)] ${mono ? 'font-mono' : ''} ${
              checked ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text)]'
            }`}
          >
            <span className="truncate">{opt.label}</span>
            <span className="ml-auto flex flex-shrink-0 items-center gap-2 pl-2">
              {opt.hint && <span className="text-xs font-normal text-[var(--color-text-muted)]">{opt.hint}</span>}
              {checked && <Checkmark16Regular className="text-[var(--color-primary)]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 弹层内单选列表（即点即生效；再点已选项不取消，清除用「重置」或「全部」项） */
export function SheetOptionList({
  options,
  value,
  onSelect,
  mono = false,
}: {
  options: { value: string; label: string; hint?: string }[];
  value: string;
  onSelect: (value: string) => void;
  mono?: boolean;
}) {
  return <SheetCheckList options={options} selected={[value]} onToggle={onSelect} mono={mono} />;
}
