// components/BatchSaleForm.tsx
// 批量销售表单组件

'use client';

import { useState } from 'react';
import type { Transaction, SalesRecordFormData } from '@/types/database.types';
import { createSalesRecord } from '@/lib/api/sales-records';
import { button, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';

interface BatchSaleFormProps {
  transaction: Transaction;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function BatchSaleForm({ transaction, onSuccess, onCancel }: BatchSaleFormProps) {
  const [formData, setFormData] = useState<SalesRecordFormData>({
    quantity_sold: 1,
    selling_price_per_unit: 0,
    platform_fee: 0,
    shipping_fee: 0,
    sale_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (formData.quantity_sold > transaction.quantity_in_stock) {
      setError(`销售数量不能超过库存数量 (${transaction.quantity_in_stock})`);
      return;
    }

    if (formData.quantity_sold <= 0) {
      setError('销售数量必须大于0');
      return;
    }

    if (formData.selling_price_per_unit <= 0) {
      setError('单价必须大于0');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: apiError } = await createSalesRecord(
        transaction.id,
        formData,
        {
          purchase_price_total: transaction.purchase_price_total,
          point_paid: transaction.point_paid,
          quantity: transaction.quantity,
          expected_platform_points: transaction.expected_platform_points,
          expected_card_points: transaction.expected_card_points,
          extra_platform_points: transaction.extra_platform_points,
          platform_points_platform_id: transaction.platform_points_platform_id,
          card_points_platform_id: transaction.card_points_platform_id,
          extra_platform_points_platform_id: transaction.extra_platform_points_platform_id,
        }
      );

      if (apiError) {
        setError(apiError.message || '保存失败');
        return;
      }

      alert('销售记录已保存！');
      onSuccess();
    } catch (err: any) {
      setError(err.message || '保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPrice = formData.quantity_sold * formData.selling_price_per_unit;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          当前库存：<span className="font-bold">{transaction.quantity_in_stock}</span> / {transaction.quantity}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            销售数量 <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            value={formData.quantity_sold}
            onChange={(e) => setFormData({ ...formData, quantity_sold: parseInt(e.target.value) || 0 })}
            min="1"
            max={transaction.quantity_in_stock}
            className={input.base}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            单价 (¥) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            value={formData.selling_price_per_unit}
            onChange={(e) => setFormData({ ...formData, selling_price_per_unit: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
            className={input.base}
            required
          />
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          总售价：<span className="font-bold text-gray-900 dark:text-white">¥{totalPrice.toLocaleString()}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            平台费用 (¥)
          </label>
          <input
            type="number"
            value={formData.platform_fee}
            onChange={(e) => setFormData({ ...formData, platform_fee: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
            className={input.base}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            运费 (¥)
          </label>
          <input
            type="number"
            value={formData.shipping_fee}
            onChange={(e) => setFormData({ ...formData, shipping_fee: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
            className={input.base}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          销售日期
        </label>
        <DatePicker
          selected={formData.sale_date ? new Date(formData.sale_date) : new Date()}
          onChange={(date) => setFormData({ ...formData, sale_date: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0] })}
          placeholder="选择销售日期"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          备注
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className={input.base}
          placeholder="可选"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className={button.primary + ' flex-1'}
        >
          {submitting ? '保存中...' : '确认销售'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={button.secondary + ' flex-1'}
        >
          取消
        </button>
      </div>
    </form>
  );
}
