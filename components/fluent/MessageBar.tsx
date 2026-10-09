// components/fluent/MessageBar.tsx — 提示条（Fluent MessageBar；Loop 无实例，用户确认按 Fluent 默认，样式 globals.css .fluent-messagebar）
// 图标 20px（默认按 intent 取实心状态图标，可换）、正文、右侧操作区；信息色用蓝
import type { ReactNode } from 'react';
import { CheckmarkCircle20Filled } from '@fluentui/react-icons/headless/svg/checkmark-circle';
import { ErrorCircle20Filled } from '@fluentui/react-icons/headless/svg/error-circle';
import { Info20Filled } from '@fluentui/react-icons/headless/svg/info';
import { Warning20Filled } from '@fluentui/react-icons/headless/svg/warning';

export type MessageBarIntent = 'success' | 'error' | 'warning' | 'info';

// @layer components 里的类名必须以完整字面量出现在源码里
const INTENT_CLASS: Record<MessageBarIntent, string> = {
  success: 'fluent-messagebar fluent-messagebar--success',
  error: 'fluent-messagebar fluent-messagebar--error',
  warning: 'fluent-messagebar fluent-messagebar--warning',
  info: 'fluent-messagebar fluent-messagebar--info',
};

const INTENT_ICON: Record<MessageBarIntent, ReactNode> = {
  success: <CheckmarkCircle20Filled />,
  error: <ErrorCircle20Filled />,
  warning: <Warning20Filled />,
  info: <Info20Filled />,
};

export default function MessageBar({
  intent,
  icon,
  actions,
  className = '',
  role = 'status',
  children,
}: {
  intent: MessageBarIntent;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  role?: 'status' | 'alert';
  children: ReactNode;
}) {
  return (
    <div role={role} className={`${INTENT_CLASS[intent]} ${className}`}>
      <span className="fluent-messagebar__icon">{icon ?? INTENT_ICON[intent]}</span>
      <div className="fluent-messagebar__body">{children}</div>
      {actions ? <div className="fluent-messagebar__actions">{actions}</div> : <span />}
    </div>
  );
}
