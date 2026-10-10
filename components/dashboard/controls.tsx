// components/dashboard/controls.tsx — 仪表盘共用的小控件：小号切换按钮、带说明的「?」图标
'use client';

import type { ReactNode } from 'react';
import { useTooltip } from '@/components/fluent/Tooltip';

/** 小号 subtle 切换按钮（design-spec 07 .btn--sm + toggle 选中态） */
export function ToggleButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className="fluent-btn fluent-btn--subtle fluent-btn--sm shrink-0 whitespace-nowrap">
      {children}
    </button>
  );
}

/** 悬停显示说明的「?」 */
export function InfoTip({ text }: { text: string }) {
  const tip = useTooltip(text);
  return (
    <span
      {...tip}
      tabIndex={0}
      aria-label={text}
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]"
    >
      ?
    </span>
  );
}
