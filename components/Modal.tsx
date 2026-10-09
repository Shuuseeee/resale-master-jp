// components/Modal.tsx
// 桌面（≥768）= Fluent Dialog（design-spec/components/08-dialog.css：padding 32、radius 16、shadow64、遮罩无模糊；
// 进场 遮罩 opacity 250ms + 面板 scale .85→1 / opacity 250ms，无退场动画），样式在 globals.css 的 .modal-*；
// 手机（<768）仍是底部弹层，用 max-md: 前缀的类，结构与尺寸不变
'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Dismiss20Regular } from '@fluentui/react-icons/headless/svg/dismiss';
import { button } from '@/lib/theme';
import Spinner from '@/components/fluent/Spinner';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  beforeClose?: () => void;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  beforeClose,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC 键关闭
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (beforeClose) { beforeClose(); } else { onClose(); }
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, closeOnEsc, beforeClose]);

  // 防止滚动穿透
  useEffect(() => {
    if (isOpen) {
      // 保存当前滚动位置
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        // 恢复滚动位置
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // 点击外部关闭
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      if (beforeClose) { beforeClose(); } else { onClose(); }
    }
  };

  if (!isOpen) return null;

  // 尺寸映射
  const sizeClasses = {
    sm: 'md:max-w-[450px]',
    md: 'md:max-w-lg',
    lg: 'md:max-w-2xl',
    xl: 'md:max-w-4xl',
    full: 'md:max-w-7xl',
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[10010] flex items-end md:items-center justify-center max-md:animate-fade-in overflow-hidden overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
      onClick={handleOverlayClick}
      onTouchMove={(e) => {
        // 拦截外层(遮罩)上的滑动,防止冒泡到底部页面;Modal 内容区有 data-modal-scroll 标记不受影响
        const target = e.target as HTMLElement;
        if (!target.closest('[data-modal-scroll]')) e.preventDefault();
      }}
    >
      {/* 遮罩层 */}
      <div
        className="modal-backdrop absolute inset-0 max-md:bg-black/50 max-md:backdrop-blur-[4px]"
        aria-hidden="true"
      />

      {/* 模态框内容 */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`
          modal-surface relative w-full ${sizeClasses[size]}
          max-md:max-h-[min(calc(90vh-5rem),calc(100vh-5.75rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))]
          max-md:bg-[var(--color-bg-elevated)]
          max-md:border max-md:border-[var(--color-border)]
          max-md:rounded-t-[20px]
          max-md:shadow-[var(--shadow-modal)]
          overflow-hidden
          max-md:animate-slide-up
        `}
      >
        {/* 标题栏 */}
        {(title || showCloseButton) && (
          <div className="modal-header flex items-center justify-between max-md:px-4 max-md:py-4 max-md:border-b max-md:border-[var(--color-border)] max-md:bg-[var(--color-bg-subtle)]">
            {/* 移动端拖动指示器 */}
            <div className="absolute top-2 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-[var(--color-border)] md:hidden" />

            {title && (
              <h2
                id="modal-title"
                className="modal-title max-md:text-lg max-md:font-semibold max-md:text-[var(--color-text)] max-md:pt-2"
              >
                {title}
              </h2>
            )}

            {showCloseButton && (
              <button
                onClick={beforeClose || onClose}
                className="modal-close ml-auto flex items-center justify-center max-md:p-2 max-md:text-[var(--color-text-muted)] max-md:hover:bg-[var(--color-bg-elevated)] max-md:hover:text-[var(--color-text)] max-md:transition-colors max-md:rounded-[var(--radius-md)] max-md:min-h-touch max-md:min-w-touch"
                aria-label="关闭"
              >
                <Dismiss20Regular />
              </button>
            )}
          </div>
        )}

        {/* 内容区域 */}
        <div
          data-modal-scroll
          className="modal-content overflow-y-auto max-md:max-h-[min(calc(90vh-9rem),calc(100vh-9.75rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] max-md:px-4 max-md:py-4 overscroll-contain text-[var(--color-text)]"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );

  // 使用 Portal 渲染到 body
  return typeof window !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}

// 带页脚的 Modal 变体
interface ModalWithFooterProps extends ModalProps {
  footer?: React.ReactNode;
}

export function ModalWithFooter({
  footer,
  children,
  ...props
}: ModalWithFooterProps) {
  return (
    <Modal {...props}>
      <div className="flex flex-col">
        <div className="flex-1">{children}</div>
        {footer && (
          <div className="sticky bottom-0 left-0 right-0 bg-[var(--color-bg-elevated)] border-t border-[var(--color-border)] px-4 md:px-6 py-4 mt-6 -mx-4 md:-mx-6 -mb-4 md:-mb-6">
            {footer}
          </div>
        )}
      </div>
    </Modal>
  );
}

// 确认对话框 Modal
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'primary',
  isLoading = false,
}: ConfirmModalProps) {
  const confirmButtonClass = confirmVariant === 'danger'
    ? button.danger
    : button.primary;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnOverlayClick={!isLoading}
      closeOnEsc={!isLoading}
    >
      <div className="py-4 md:py-0">
        <p className="text-sm text-[var(--color-text)]">
          {message}
        </p>
      </div>

      {/* Fluent DialogActions：靠右、间距 8、主按钮在左（08-dialog.css）；手机仍是主按钮在上的纵向排列 */}
      <div className="flex flex-col gap-3 pt-4 sm:flex-row-reverse sm:justify-start md:flex-row md:justify-end md:gap-2 md:pt-6">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={confirmButtonClass}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Spinner />
              <span>处理中...</span>
            </div>
          ) : (
            confirmText
          )}
        </button>
        <button
          onClick={onClose}
          disabled={isLoading}
          className={button.secondary}
        >
          {cancelText}
        </button>
      </div>
    </Modal>
  );
}

export const UNSAVED_CHANGES_CONFIRM = {
  title: '放弃修改？',
  message: '表单有未保存的修改，确定要放弃吗？',
  confirmText: '放弃',
  cancelText: '继续编辑',
} as const;
