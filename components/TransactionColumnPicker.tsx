// components/TransactionColumnPicker.tsx — 列定制 Modal 内容
'use client';

import { COLUMN_LABELS } from '@/lib/transactions/columns';
import type { ColumnConfig } from '@/lib/transactions/columns';

interface Props {
  value: ColumnConfig[];
  onChange: (next: ColumnConfig[]) => void;
  onReset: () => void;
}

export default function TransactionColumnPicker({ value, onChange, onReset }: Props) {
  const move = (index: number, direction: -1 | 1) => {
    const next = [...value];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const toggle = (index: number) => {
    const next = value.map((c, i) => i === index ? { ...c, visible: !c.visible } : c);
    onChange(next);
  };

  return (
    <div>
      <p className="text-sm text-apple-gray-1 mb-4">勾选要显示的列，点击箭头调整顺序。</p>
      <ul className="divide-y divide-apple-separator dark:divide-apple-sepDark">
        {value.map((col, i) => (
          <li key={col.key} className="flex items-center gap-3 py-2.5">
            {/* Checkbox */}
            <button
              type="button"
              onClick={() => toggle(i)}
              className="flex-shrink-0"
              aria-label={col.visible ? '隐藏此列' : '显示此列'}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                col.visible
                  ? 'bg-apple-blue border-apple-blue'
                  : 'bg-white dark:bg-gray-800 border-apple-separator dark:border-apple-sepDark'
              }`}>
                {col.visible && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>

            {/* 列名 */}
            <span className={`flex-1 text-sm ${col.visible ? 'text-gray-900 dark:text-white' : 'text-apple-gray-2'}`}>
              {COLUMN_LABELS[col.key]}
            </span>

            {/* 上下箭头 */}
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1 rounded text-apple-gray-1 hover:text-gray-900 dark:hover:text-white hover:bg-apple-gray-5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="上移"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="p-1 rounded text-apple-gray-1 hover:text-gray-900 dark:hover:text-white hover:bg-apple-gray-5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="下移"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex justify-end pt-4 border-t border-apple-separator dark:border-apple-sepDark mt-2">
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1.5 text-sm text-apple-gray-1 hover:text-gray-900 dark:hover:text-white border border-apple-separator dark:border-apple-sepDark rounded-lg active:opacity-70 transition-colors"
        >
          重置默认
        </button>
      </div>
    </div>
  );
}
