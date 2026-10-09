// components/fluent/DualIcon.tsx — Fluent 图标的常规 / 实心两态
// Loop 实测：subtle 按钮、导航 Tab 悬停时、选中时从常规换成实心（瞬时切换，原稿 base.css .fbtn / 02-nav.css .tab）。
// 两个都渲染，由容器状态决定显示哪个：规则在 globals.css 的 .ic-r / .ic-f
import type { FluentIcon } from '@fluentui/react-icons/headless';

export default function DualIcon({ regular: Regular, filled: Filled, className }: { regular: FluentIcon; filled: FluentIcon; className?: string }) {
  return (
    <>
      <Regular className={className ? `ic-r ${className}` : 'ic-r'} />
      <Filled className={className ? `ic-f ${className}` : 'ic-f'} />
    </>
  );
}
