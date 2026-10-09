// components/Toast.tsx — 操作反馈提示 = Loop「复制」后弹出的提示对话框（design-spec/components/13-toast.css）
// - 视口居中的对话框（475 宽，≤480 宽时铺满屏宽）+ 与对话框相同的遮罩；只有标题行：绿色成功图标、文字、×
// - 约 2.2s 自动关闭（Loop 实测），× / 点遮罩 / Esc 也能关；进场同对话框，没有退场动画
'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckmarkCircle16Filled } from '@fluentui/react-icons/headless/svg/checkmark-circle';
import { Dismiss16Regular } from '@fluentui/react-icons/headless/svg/dismiss';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 2200 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [duration, onClose]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="loop-toast-layer" role="status" aria-live="polite">
      <div className="loop-toast-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="loop-toast">
        <div className="loop-toast__inner">
          <div className="loop-toast__header">
            <CheckmarkCircle16Filled className="loop-toast__icon" />
            <p className="loop-toast__title">{message}</p>
            <button type="button" className="loop-toast__close" aria-label="关闭" onClick={onClose}>
              <Dismiss16Regular />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
