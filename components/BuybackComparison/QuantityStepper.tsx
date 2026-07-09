'use client';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** 上下文标签（如商品名），拼进 aria-label 便于区分多个步进器 */
  label?: string;
}

export default function QuantityStepper({ value, onChange, min = 0, label }: QuantityStepperProps) {
  return (
    <div className="flex h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] md:h-8">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className="h-11 w-11 text-base font-bold text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)] disabled:opacity-40 md:h-8 md:w-8 md:text-sm"
        aria-label={label ? `减少数量 ${label}` : '减少数量'}
      >
        -
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          onChange(Number.isNaN(parsed) ? min : Math.max(min, parsed));
        }}
        className="h-11 w-14 border-x border-[var(--color-border)] bg-transparent text-center text-sm font-semibold text-[var(--color-text)] outline-none md:h-8 md:w-12"
        aria-label={label ? `比较数量 ${label}` : '比较数量'}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="h-11 w-11 text-base font-bold text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)] md:h-8 md:w-8 md:text-sm"
        aria-label={label ? `增加数量 ${label}` : '增加数量'}
      >
        +
      </button>
    </div>
  );
}
