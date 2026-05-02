// components/Modal.tsx
'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { button } from '@/lib/theme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
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
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC 键关闭
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, closeOnEsc]);

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
      onClose();
    }
  };

  if (!isOpen) return null;

  // 尺寸映射
  const sizeClasses = {
    sm: 'md:max-w-md',
    md: 'md:max-w-lg',
    lg: 'md:max-w-2xl',
    xl: 'md:max-w-4xl',
    full: 'md:max-w-7xl',
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[10010] flex items-end md:items-center justify-center animate-fade-in overflow-hidden overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
      onClick={handleOverlayClick}
      onTouchMove={(e) => {
        // 拦截外层(遮罩)上的滑动,防止冒泡到底部页面;Modal 内容区有 data-modal-scroll 标记不受影响
        const target = e.target as HTMLElement;
        if (!target.closest('[data-modal-scroll]')) e.preventDefault();
      }}
    >
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[4px]"
        aria-hidden="true"
      />

      {/* 模态框内容 */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`
          relative w-full ${sizeClasses[size]}
          max-h-[calc(90vh-5rem)] md:max-h-[85vh]
          bg-[var(--color-bg-elevated)]
          border border-[var(--color-border)]
          rounded-t-[20px] md:rounded-[16px]
          shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)]
          overflow-hidden
          animate-slide-up md:animate-fade-in
        `}
      >
        {/* 标题栏 */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
            {/* 移动端拖动指示器 */}
            <div className="absolute top-2 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-[var(--color-border)] md:hidden" />

            {title && (
              <h2
                id="modal-title"
                className="text-lg md:text-xl font-semibold text-[var(--color-text)] pt-2 md:pt-0"
              >
                {title}
              </h2>
            )}

            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-auto p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)] transition-colors rounded-[var(--radius-md)] min-h-touch min-w-touch flex items-center justify-center"
                aria-label="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* 内容区域 */}
        <div
          data-modal-scroll
          className="overflow-y-auto max-h-[calc(90vh-9rem)] md:max-h-[calc(85vh-5rem)] px-4 md:px-6 py-4 md:py-6 overscroll-contain text-[var(--color-text)]"
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
      <div className="py-4">
        <p className="text-sm text-[var(--color-text)] md:text-base">
          {message}
        </p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-4">
        <button
          onClick={onClose}
          disabled={isLoading}
          className={button.secondary}
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={confirmButtonClass}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>处理中...</span>
            </div>
          ) : (
            confirmText
          )}
        </button>
      </div>
    </Modal>
  );
}
