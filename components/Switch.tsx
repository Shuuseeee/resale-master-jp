// 开关（role="switch"）。比复选框更醒目，用于「启用 / 未到货 / 自动计算」这类二值设置。
export default function Switch({
  checked,
  onClick,
  tone = 'primary',
  label,
}: {
  checked: boolean;
  onClick: () => void;
  tone?: 'primary' | 'warning';
  /** 无障碍名称（屏幕阅读器读出） */
  label: string;
}) {
  const activeClass = tone === 'warning' ? 'bg-[var(--color-warning-bg)]' : 'bg-[var(--color-primary-fill)]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? activeClass : 'bg-[var(--color-border)]'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}
