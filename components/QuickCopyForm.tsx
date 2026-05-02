// components/QuickCopyForm.tsx
// 快速复制交易:从源交易拷贝大部分字段,只让用户调整数量/单价/订单号/日期

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Transaction } from '@/types/database.types';
import { quickCopyTransaction } from '@/lib/api/transactions';
import { parseNumberInput } from '@/lib/number-utils';
import { getTodayString } from '@/lib/utils/dateUtils';
import { formatCurrency } from '@/lib/financial/calculator';
import { button, input } from '@/lib/theme';

interface QuickCopyFormProps {
  source: Transaction;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function QuickCopyForm({ source, onSuccess, onCancel }: QuickCopyFormProps) {
  const [formData, setFormData] = useState({
    date: getTodayString(),
    quantity: source.quantity,
    unit_price: source.unit_price ?? Math.round((source.purchase_price_total || 0) / Math.max(source.quantity, 1)),
    order_number: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const newTotal = formData.unit_price * formData.quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.quantity < 1) {
      setError('数量至少为 1');
      return;
    }
    if (formData.unit_price <= 0) {
      setError('单价必须大于 0');
      return;
    }

    setSubmitting(true);
    const { error: apiError } = await quickCopyTransaction(source, {
      date: formData.date,
      quantity: formData.quantity,
      unit_price: formData.unit_price,
      order_number: formData.order_number,
    });
    setSubmitting(false);

    if (apiError) {
      setError(apiError?.message || '创建失败,请重试');
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 text-sm">
        <div className="line-clamp-2 break-cjk font-medium text-[var(--color-text)]">
          {source.product_name}
        </div>
        {source.jan_code && (
          <div className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">{source.jan_code}</div>
        )}
        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
          原:{source.quantity} 件 × {formatCurrency(source.unit_price ?? Math.round((source.purchase_price_total || 0) / Math.max(source.quantity, 1)))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            进货日期 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            className={input.base + ' w-full'}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">订单号</label>
          <input
            type="text"
            value={formData.order_number}
            onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
            placeholder="可选"
            className={input.base + ' w-full'}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            数量 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="number"
            min={1}
            value={formData.quantity || ''}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value === '' ? 0 : parseInt(e.target.value) })}
            required
            className={input.base + ' w-full'}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            单价 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={formData.unit_price || ''}
              onChange={(e) => setFormData({ ...formData, unit_price: parseNumberInput(e.target.value, 0) })}
              required
              className={input.base + ' w-full pr-12'}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">¥</span>
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-primary)]/20 bg-[var(--color-primary-light)] p-3 text-sm">
        <div className="flex justify-between text-[var(--color-text)]">
          <span className="text-[var(--color-text-muted)]">合计</span>
          <span className="font-medium">{formatCurrency(newTotal)}</span>
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          其他字段(JAN、商品名、平台、积分、备注)从原交易复制。如需调整,请用{' '}
          <Link href={`/transactions/add?copy=${source.id}`} className="text-[var(--color-primary)] hover:underline">
            完整新建
          </Link>
        </p>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className={button.primary}
        >
          {submitting ? '创建中...' : '复制并创建'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={button.secondary}
        >
          取消
        </button>
      </div>
    </form>
  );
}
