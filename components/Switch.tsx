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
  // Fluent Switch（globals.css .fluent-switch，design-spec/components/05-switch.css）：轨道 40×20、滑块 18
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={tone === 'warning' ? 'fluent-switch fluent-switch--warning' : 'fluent-switch'}
    >
      <span className="fluent-switch__thumb" />
    </button>
  );
}
