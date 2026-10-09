// components/fluent/Spinner.tsx — 加载转圈（Fluent Spinner；Loop 无实例，用户确认按钮加载用 tiny；样式 globals.css .fluent-spinner）
const SIZE_CLASS = {
  tiny: 'fluent-spinner fluent-spinner--tiny',
  small: 'fluent-spinner fluent-spinner--small',
  medium: 'fluent-spinner fluent-spinner--medium',
} as const;

export default function Spinner({ size = 'tiny', label = '加载中' }: { size?: keyof typeof SIZE_CLASS; label?: string }) {
  return <span role="progressbar" aria-label={label} className={SIZE_CLASS[size]} />;
}
