// components/QuickEditForm.tsx
// 列表页快速编辑高频字段(状态/数量/单价/订单号/账号/渠道/备注)
// 完整编辑(含付款拆分、积分、凭证等)请走 /transactions/[id]/edit

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Transaction, TransactionStatus, PaymentMethod, PurchasePlatform } from '@/types/database.types';
import { quickUpdateTransaction, type QuickEditPayload } from '@/lib/api/transactions';
import { parseNumberInput } from '@/lib/number-utils';

interface QuickEditFormProps {
  transaction: Transaction;
  paymentMethods: Array<Pick<PaymentMethod, 'id' | 'name'>>;
  purchasePlatforms: Array<Pick<PurchasePlatform, 'id' | 'name'>>;
  onSuccess: () => void;
  onCancel: () => void;
}

const STATUS_OPTIONS: Array<{ value: TransactionStatus; label: string }> = [
  { value: 'pending', label: '未到货' },
  { value: 'in_stock', label: '在库' },
  { value: 'awaiting_payment', label: '待入账' },
  { value: 'sold', label: '已售出' },
  { value: 'returned', label: '已退货' },
];

export default function QuickEditForm({
  transaction,
  paymentMethods,
  purchasePlatforms,
  onSuccess,
  onCancel,
}: QuickEditFormProps) {
  const canEditStatus =
    (transaction.status === 'pending' || transaction.status === 'in_stock') &&
    transaction.quantity_sold === 0;

  const [formData, setFormData] = useState({
    status: transaction.status,
    quantity: transaction.quantity,
    unit_price: transaction.unit_price ?? 0,
    order_number: transaction.order_number ?? '',
    card_id: transaction.card_id ?? '',
    purchase_platform_id: transaction.purchase_platform_id ?? '',
    notes: transaction.notes ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const payload: QuickEditPayload = {
      quantity: formData.quantity,
      unit_price: formData.unit_price,
      order_number: formData.order_number,
      card_id: formData.card_id,
      purchase_platform_id: formData.purchase_platform_id,
      notes: formData.notes,
    };

    if (canEditStatus && formData.status !== transaction.status) {
      payload.status = formData.status;
    }

    if (formData.quantity !== transaction.quantity || formData.unit_price !== (transaction.unit_price ?? 0)) {
      payload.purchase_price_total = formData.unit_price * formData.quantity;
    }

    const { error: apiError } = await quickUpdateTransaction(transaction.id, payload);
    setSubmitting(false);

    if (apiError) {
      setError(apiError?.message || '保存失败,请重试');
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">状态</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
            disabled={!canEditStatus}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {!canEditStatus && (
            <p className="mt-1 text-xs text-apple-gray-1">已有销售记录或当前状态不允许直接修改</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">订单号</label>
          <input
            type="text"
            value={formData.order_number}
            onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
            placeholder="可选"
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">数量</label>
          <input
            type="number"
            min={1}
            value={formData.quantity || ''}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value === '' ? 0 : parseInt(e.target.value) })}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">单价</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={formData.unit_price || ''}
              onChange={(e) => setFormData({ ...formData, unit_price: parseNumberInput(e.target.value, 0) })}
              className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-apple-gray-1">¥</span>
          </div>
          {(formData.quantity !== transaction.quantity || formData.unit_price !== (transaction.unit_price ?? 0)) && (
            <p className="mt-1 text-xs text-apple-gray-1">
              新合计:¥{(formData.unit_price * formData.quantity).toLocaleString()}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">账号</label>
          <select
            value={formData.card_id}
            onChange={(e) => setFormData({ ...formData, card_id: e.target.value })}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all"
          >
            <option value="">未选择</option>
            {paymentMethods.map(pm => (
              <option key={pm.id} value={pm.id}>{pm.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">渠道</label>
          <select
            value={formData.purchase_platform_id}
            onChange={(e) => setFormData({ ...formData, purchase_platform_id: e.target.value })}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all"
          >
            <option value="">未选择</option>
            {purchasePlatforms.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">备注</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-none"
        />
      </div>

      <p className="text-xs text-apple-gray-1">
        修改付款拆分、积分或凭证等其他字段,请打开{' '}
        <Link href={`/transactions/${transaction.id}/edit`} className="text-apple-blue hover:underline">
          完整编辑页
        </Link>
      </p>

      {error && <p className="text-sm text-apple-red">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 bg-apple-blue disabled:opacity-40 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed"
        >
          {submitting ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-6 py-3 bg-white dark:bg-apple-cardDark dark:hover:bg-white/5 text-gray-900 dark:text-white rounded-xl transition-all border border-apple-separator dark:border-apple-sepDark disabled:opacity-40"
        >
          取消
        </button>
      </div>
    </form>
  );
}
