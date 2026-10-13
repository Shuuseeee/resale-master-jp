// components/CopyButton.tsx — 小号复制按钮：点后图标变成勾 1.5 秒（不弹提示对话框）。
// 传 children 时文字和图标是同一个按钮（点文字也能复制），如设置页的 MCP 地址
'use client';

import { useState, type ReactNode } from 'react';
import { Checkmark16Regular } from '@fluentui/react-icons/headless/svg/checkmark';
import { Copy16Regular } from '@fluentui/react-icons/headless/svg/copy';

export default function CopyButton({ text, label, children }: { text: string; label: string; children?: ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className={`inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] p-1 align-middle transition-colors hover:bg-[var(--color-bg-hover)] ${done ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
      title={done ? '已复制' : label}
      aria-label={children ? undefined : label}
    >
      {children && <span className="font-mono text-[var(--color-text)]">{children}</span>}
      {done ? <Checkmark16Regular /> : <Copy16Regular />}
    </button>
  );
}
