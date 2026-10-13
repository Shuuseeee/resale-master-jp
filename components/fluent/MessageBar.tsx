// components/fluent/MessageBar.tsx — 提示条（Loop 实测 = Fluent v9 原生 MessageBar，补测-4；样式 globals.css .fluent-messagebar）
// Loop 实例：断网（警告，圆圈 i 图标、无关闭）、页面锁定（信息，中性灰底、可关闭）。
// 结构：图标 20（右距 8）｜正文（粗体标题 + 正文同一行接着排，右距 12）｜操作区（自定义按钮 + 关闭，右距 12）；
// 左 padding 12、右侧没有 padding；放不下一行时自动换成多行布局（操作区换到下一行），换回的宽度 = 换成多行时的宽度。
// 出现 / 消失都没有动画。
'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CheckmarkCircle20Filled } from '@fluentui/react-icons/headless/svg/checkmark-circle';
import { DiamondDismiss20Filled } from '@fluentui/react-icons/headless/svg/diamond-dismiss';
import { Dismiss20Regular } from '@fluentui/react-icons/headless/svg/dismiss';
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

// Fluent v9 MessageBar 的默认图标（Loop 的实例都按场景另传了图标，如断网用圆圈 i、锁定用禁止编辑的笔）
const INTENT_ICON: Record<MessageBarIntent, ReactNode> = {
  success: <CheckmarkCircle20Filled />,
  error: <DiamondDismiss20Filled />,
  warning: <Warning20Filled />,
  info: <Info20Filled />,
};

const DISMISS_LABEL: Record<MessageBarIntent, string> = {
  success: '关闭成功提示',
  error: '关闭错误提示',
  warning: '关闭警告提示',
  info: '关闭信息提示',
};

export default function MessageBar({
  intent,
  icon,
  title,
  actions,
  onDismiss,
  className = '',
  role = 'status',
  children,
}: {
  intent: MessageBarIntent;
  icon?: ReactNode;
  /** 粗体标题（Loop：标题 600 + 正文同一行接着排） */
  title?: ReactNode;
  /** 操作按钮 / 链接（在关闭按钮左边） */
  actions?: ReactNode;
  /** 传了才显示关闭按钮（Loop：断网提示没有关闭，锁定提示有） */
  onDismiss?: () => void;
  className?: string;
  role?: 'status' | 'alert';
  children?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [multiline, setMultiline] = useState(false);
  const wrapWidth = useRef(0);

  // 自动换行布局（Fluent useMessageBarReflow 的做法）：单行放不下（正文折行）→ 多行，记下当时的宽度；变得比它宽 → 回到单行
  useLayoutEffect(() => {
    const root = rootRef.current;
    const body = bodyRef.current;
    if (!root || !body) return;
    const check = () => {
      const width = root.getBoundingClientRect().width;
      setMultiline(prev => {
        if (!prev) {
          const lineHeight = parseFloat(getComputedStyle(body).fontSize) * 1.6;
          if (body.getBoundingClientRect().height > lineHeight) {
            wrapWidth.current = width;
            return true;
          }
          return false;
        }
        return width <= wrapWidth.current;
      });
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} role={role} className={`${INTENT_CLASS[intent]} ${className}`} data-multiline={multiline || undefined}>
      <span className="fluent-messagebar__icon">{icon ?? INTENT_ICON[intent]}</span>
      <div ref={bodyRef} className="fluent-messagebar__body">
        {title && <span className="fluent-messagebar__title">{title}</span>}
        {children}
      </div>
      <div className="fluent-messagebar__actions">
        {actions}
        {onDismiss && (
          <button type="button" className="fluent-messagebar__dismiss" aria-label={DISMISS_LABEL[intent]} onClick={onDismiss}>
            <Dismiss20Regular />
          </button>
        )}
      </div>
    </div>
  );
}
