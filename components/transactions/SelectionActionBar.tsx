// components/transactions/SelectionActionBar.tsx — 交易页多选后的操作栏
// 手机（<md）：选择模式工具栏盖住底部导航（参照 iOS 照片 / 邮件）：上行「已选 N 件 · 清空 · 完成」，
//   下行图标 + 文字的操作，最多 4 格，放不下的进「更多」底部弹层（与筛选弹层同一组件）。
// 桌面（≥md）：底部居中浮动的 Fluent 工具栏，一般操作为 subtle 图标按钮，危险操作（删除）放最右并用分隔线隔开。
'use client';

import type { ComponentType, SVGProps } from 'react';
import { useState } from 'react';
import { Dismiss20Regular } from '@fluentui/react-icons/headless/svg/dismiss';
import { MoreHorizontal24Regular } from '@fluentui/react-icons/headless/svg/more-horizontal';
import { FilterSheet } from '@/components/mobile-filter';

type Icon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export interface SelectionAction {
  id: string;
  label: string;
  icon: Icon;
  onClick: () => void;
  disabled?: boolean;
  /** 禁用时的原因（手机「更多」里显示、桌面 title） */
  hint?: string;
  danger?: boolean;
}

interface Props {
  count: number;
  actions: SelectionAction[];
  onClear: () => void;
  onExit: () => void;
}

const MOBILE_SLOTS = 4;

export default function SelectionActionBar({ count, actions, onClear, onExit }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const normal = actions.filter(a => !a.danger);
  const danger = actions.filter(a => a.danger);
  const ordered = [...normal, ...danger];
  const overflow = ordered.length > MOBILE_SLOTS;
  const inline = overflow ? ordered.slice(0, MOBILE_SLOTS - 1) : ordered;
  const rest = overflow ? ordered.slice(MOBILE_SLOTS - 1) : [];

  const countText = count === 0 ? '请选择交易' : `已选 ${count} 件`;

  return (
    <>
      {/* 手机：盖住底部导航的选择工具栏 */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-[10000] border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex h-11 items-center gap-2 px-4">
          <span className={`flex-1 text-sm ${count ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>{countText}</span>
          {count > 0 && (
            <button type="button" onClick={onClear} className="px-2 py-1 text-sm text-[var(--color-text-secondary)] active:text-[var(--color-text)]">
              清空
            </button>
          )}
          <button type="button" onClick={onExit} className="px-2 py-1 text-sm font-semibold text-[var(--color-primary)]">
            完成
          </button>
        </div>
        <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${Math.max(inline.length + (overflow ? 1 : 0), 1)}, minmax(0, 1fr))` }}>
          {inline.map(a => (
            <MobileAction key={a.id} action={a} disabled={a.disabled || count === 0} />
          ))}
          {overflow && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              disabled={count === 0}
              className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[var(--color-text)] disabled:text-[var(--color-text-disabled)] active:bg-[var(--color-bg-pressed)]"
            >
              <MoreHorizontal24Regular />
              更多
            </button>
          )}
        </div>
      </div>
      {/* 工具栏盖住了底部导航，列表底部留出同样高度，最后一张卡片不被挡住 */}
      <div className="md:hidden h-[calc(6.25rem+env(safe-area-inset-bottom,0px))]" aria-hidden="true" />

      {moreOpen && (
        <FilterSheet title="更多操作" onClose={() => setMoreOpen(false)}>
          {rest.map(a => (
            <button
              key={a.id}
              type="button"
              disabled={a.disabled}
              onClick={() => {
                setMoreOpen(false);
                a.onClick();
              }}
              className={`flex min-h-[48px] w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-left text-sm active:bg-[var(--color-bg-pressed)] disabled:text-[var(--color-text-disabled)] ${
                a.danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'
              }`}
            >
              <a.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{a.label}</span>
              {a.disabled && a.hint && <span className="text-xs text-[var(--color-text-muted)]">{a.hint}</span>}
            </button>
          ))}
        </FilterSheet>
      )}

      {/* 桌面：底部浮动工具栏 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[9998] hidden justify-center px-3 md:flex">
        <div className="pointer-events-auto flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1.5 shadow-[var(--shadow-lg)]">
          <span className={`px-2 text-sm ${count ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>{countText}</span>
          <span className="mx-1 h-5 w-px bg-[var(--color-border)]" />
          {normal.map(a => (
            <DesktopAction key={a.id} action={a} disabled={a.disabled || count === 0} />
          ))}
          {danger.length > 0 && <span className="mx-1 h-5 w-px bg-[var(--color-border)]" />}
          {danger.map(a => (
            <DesktopAction key={a.id} action={a} disabled={a.disabled || count === 0} />
          ))}
          <span className="mx-1 h-5 w-px bg-[var(--color-border)]" />
          {count > 0 && (
            <button type="button" onClick={onClear} className="fluent-btn fluent-btn--subtle">
              清空
            </button>
          )}
          <button type="button" onClick={onExit} className="fluent-btn fluent-btn--subtle fluent-btn--icon" aria-label="取消选择" title="取消选择">
            <Dismiss20Regular />
          </button>
        </div>
      </div>
    </>
  );
}

function MobileAction({ action: a, disabled }: { action: SelectionAction; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={a.onClick}
      disabled={disabled}
      className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium active:bg-[var(--color-bg-pressed)] disabled:text-[var(--color-text-disabled)] ${
        a.danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'
      }`}
    >
      <a.icon className="h-6 w-6 shrink-0" />
      <span className="max-w-full truncate">{a.label}</span>
    </button>
  );
}

function DesktopAction({ action: a, disabled }: { action: SelectionAction; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={a.onClick}
      disabled={disabled}
      title={disabled && a.hint ? a.hint : undefined}
      className={`fluent-btn fluent-btn--subtle gap-1.5 ${a.danger ? 'text-[var(--color-danger)]' : ''}`}
    >
      <a.icon className="h-5 w-5" />
      {a.label}
    </button>
  );
}
