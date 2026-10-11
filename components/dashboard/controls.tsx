// components/dashboard/controls.tsx — 仪表盘共用的小控件：小号切换按钮、带说明的「?」图标
'use client';

import type { ReactNode } from 'react';
import { toggleTooltipNow, useTooltip } from '@/components/fluent/Tooltip';

/** 小号 subtle 切换按钮（design-spec 07 .btn--sm + toggle 选中态） */
export function ToggleButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className="fluent-btn fluent-btn--subtle fluent-btn--sm shrink-0 whitespace-nowrap">
      {children}
    </button>
  );
}

/** 显示说明的「?」：桌面悬停，手机点按（再点或点别处收起） */
export function InfoTip({ text }: { text: string }) {
  const tip = useTooltip(text);
  return (
    <span
      {...tip}
      role="button"
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        toggleTooltipNow(e.currentTarget, text);
      }}
      tabIndex={0}
      aria-label={text}
      className="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] lg:h-4 lg:w-4 lg:text-[10px]"
    >
      ?
    </span>
  );
}
