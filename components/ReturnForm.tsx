// components/ReturnForm.tsx
// 退货表单(从详情页内联表单抽出,可被详情页和列表页 Modal 共用)

'use client';

import { useState } from 'react';
import type { Transaction } from '@/types/database.types';
import { createReturnRecord } from '@/lib/api/return-records';
import { parseNumberInput } from '@/lib/number-utils';
import { getTodayString } from '@/lib/utils/dateUtils';
import { button, input } from '@/lib/theme';

interface ReturnFormProps {
  transaction: Pick<Transaction, 'id' | 'quantity_in_stock'>;
  onSuccess: () => void;
  onCancel: () => void;
  showHeader?: boolean;
}

export default function ReturnForm({ transaction, onSuccess, onCancel, showHeader = false }: ReturnFormProps) {
  const [returnData, setReturnData] = useState({
    quantity_returned: 1,
    return_date: getTodayString(),
    return_amount: 0,
    points_deducted: 0,
    return_reason: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (returnData.quantity_returned > transaction.quantity_in_stock) {
      setError(`退货数量不能超过库存数量 (${transaction.quantity_in_stock})`);
      return;
    }
    if (returnData.quantity_returned < 1) {
      setError('退货数量至少为 1');
      return;
    }

    setSubmitting(true);
    try {
      const { error: apiError } = await createReturnRecord(transaction.id, {
        quantity_returned: returnData.quantity_returned,
        return_date: returnData.return_date,
        return_amount: returnData.return_amount,
        points_deducted: returnData.points_deducted,
        return_reason: returnData.return_reason,
        notes: returnData.notes,
      });

      if (apiError) throw apiError;
      onSuccess();
    } catch (err: any) {
      console.error('创建退货记录失败:', err);
      setError(err?.message || '操作失败,请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showHeader && (
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-[var(--color-text)]">
          <div className="h-6 w-1 rounded-full bg-[var(--color-danger)]"></div>
          记录退货
        </h2>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            退货数量 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="number"
            value={returnData.quantity_returned || ''}
            onChange={(e) => setReturnData({ ...returnData, quantity_returned: e.target.value === '' ? 0 : parseInt(e.target.value) })}
            required
            min="1"
            max={transaction.quantity_in_stock}
            className={input.base + ' w-full'}
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            当前库存: {transaction.quantity_in_stock} 个
          </p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            退货日期 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="date"
            value={returnData.return_date}
            onChange={(e) => setReturnData({ ...returnData, return_date: e.target.value })}
            required
            className={input.base + ' w-full'}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            退款金额
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={returnData.return_amount || ''}
              onChange={(e) => setReturnData({ ...returnData, return_amount: parseNumberInput(e.target.value, 0) })}
              placeholder="0.00"
              className={input.base + ' w-full pr-12'}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">¥</span>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            扣除积分
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={returnData.points_deducted || ''}
            onChange={(e) => setReturnData({ ...returnData, points_deducted: parseNumberInput(e.target.value, 0) })}
            placeholder="退货时被扣除的积分数量"
            className={input.base + ' w-full'}
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
          退货原因
        </label>
        <input
          type="text"
          value={returnData.return_reason}
          onChange={(e) => setReturnData({ ...returnData, return_reason: e.target.value })}
          placeholder="不良品、尺寸不符、订单错误等"
          className={input.base + ' w-full'}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
          备注
        </label>
        <textarea
          value={returnData.notes}
          onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
          rows={3}
          placeholder="其他退货相关信息..."
          className={input.base + ' w-full resize-none'}
        />
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className={button.danger}
        >
          {submitting ? '提交中...' : '确认退货'}
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
