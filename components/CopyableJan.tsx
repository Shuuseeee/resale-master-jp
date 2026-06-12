// components/CopyableJan.tsx — 可点击复制的 JAN 显示元素（交互参照交易列表 JAN 列）
'use client';

import { useState } from 'react';
import Toast from '@/components/Toast';

interface CopyableJanProps {
  jan: string;
  /** 布局与配色类，如 'block mt-1 text-xs text-[var(--color-text-muted)]' */
  className?: string;
}

// 使用 span[role=button] 而非 button：JAN 常嵌在可点击行、按钮或链接内，嵌套 button 是无效 HTML
export default function CopyableJan({ jan, className = '' }: CopyableJanProps) {
  const [showToast, setShowToast] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    // 阻止冒泡与默认行为，避免触发父级的行点击/链接跳转
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(jan).then(() => {
      setShowToast(true);
    });
  };

  return (
    <>
      <span
        role="button"
        onClick={handleCopy}
        title="点击复制JAN"
        className={`font-mono cursor-pointer hover:text-[var(--color-primary)] transition-colors ${className}`}
      >
        {jan}
      </span>
      {showToast && <Toast message="已复制到剪贴板" onClose={() => setShowToast(false)} />}
    </>
  );
}
