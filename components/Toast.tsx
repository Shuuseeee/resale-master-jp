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
    <div className="fixed top-16 left-1/2 z-[10002] animate-slide-down px-4 w-full max-w-sm" style={{ transform: 'translateX(-50%)' }}>
      <div className="bg-white dark:bg-apple-cardDark text-gray-900 dark:text-white px-4 py-3 rounded-2xl shadow-card-md flex items-center gap-2.5">
        <svg className="w-5 h-5 text-apple-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-[15px] font-medium">{message}</span>
      </div>
    </div>
  );
}
