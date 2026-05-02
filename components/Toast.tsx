'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed left-1/2 top-16 z-[10002] w-full max-w-sm animate-slide-down px-4" style={{ transform: 'translateX(-50%)' }}>
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-[var(--color-text)] shadow-[var(--shadow-lg)]">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-light)]">
          <svg className="h-4 w-4 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </span>
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
