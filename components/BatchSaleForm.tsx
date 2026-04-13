// components/BatchSaleForm.tsx
// 批量销售表单组件

'use client';

import { useState, useEffect } from 'react';
import type { Transaction, SalesRecordFormData, SellingPlatform } from '@/types/database.types';
import { createSalesRecord } from '@/lib/api/sales-records';
import { button, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import { getTodayString, formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { parseNumberInput } from '@/lib/number-utils';
import { getSellingPlatforms, createSellingPlatform } from '@/lib/api/platforms';

interface BatchSaleFormProps {
  transaction: Transaction;
  onSuccess: () => void;
  onCancel: () => void;
  onDataRefresh?: () => void;
}

export default function BatchSaleForm({ transaction, onSuccess, onCancel, onDataRefresh }: BatchSaleFormProps) {
  const [formData, setFormData] = useState<SalesRecordFormData>({
    quantity_sold: 1,
    selling_price_per_unit: 0,
    platform_fee: 0,
    shipping_fee: 0,
    sale_date: getTodayString(),
    selling_platform_id: '',
    sale_order_number: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [sellingPlatforms, setSellingPlatforms] = useState<SellingPlatform[]>([]);
  const [newSellingPlatformName, setNewSellingPlatformName] = useState('');

  useEffect(() => {
    getSellingPlatforms().then(setSellingPlatforms);
  }, []);

  const handleAddSellingPlatform = async () => {
    const name = newSellingPlatformName.trim();
    if (!name) return;
    const created = await createSellingPlatform(name);
    if (created) {
      setSellingPlatforms(prev => [...prev, created]);
      setFormData(prev => ({ ...prev, selling_platform_id: created.id }));
      setNewSellingPlatformName('');
    }
  };

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
          date: transaction.date, // 添加交易日期用于耗材成本分摊
        }
      );

      if (apiError) {
        setError(apiError.message || '保存失败');
        return;
      }

      setSuccessCount(prev => prev + 1);

      // 保留売却先、単価、費用，只清空数量和注文ID
      setFormData(prev => ({
        ...prev,
        quantity_sold: 1,
        sale_order_number: '',
        notes: '',
      }));

      // 刷新父组件数据（更新库存显示等），但不关闭表单
      if (onDataRefresh) {
        onDataRefresh();
      }
    } catch (err: any) {
      setError(err.message || '保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPrice = formData.quantity_sold * formData.selling_price_per_unit;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-apple-blue/5 border border-apple-blue/20 rounded-lg p-4">
        <p className="text-sm text-apple-blue">
          当前库存：<span className="font-bold">{transaction.quantity_in_stock}</span> / {transaction.quantity}
        </p>
      </div>

      {successCount > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            已保存 {successCount} 条销售记录。销售平台、单价、费用保留了上次的输入。
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            销售数量 <span className="text-red-600 dark:text-red-300">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={formData.quantity_sold || ''}
            onChange={(e) => setFormData({ ...formData, quantity_sold: parseNumberInput(e.target.value, 0) })}
            className={input.base}
            required
            placeholder="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            单价 (¥) <span className="text-red-600 dark:text-red-300">*</span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={formData.selling_price_per_unit || ''}
            onChange={(e) => setFormData({ ...formData, selling_price_per_unit: parseNumberInput(e.target.value, 0) })}
            className={input.base}
            required
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          总售价：<span className="font-bold text-gray-900 dark:text-white">¥{totalPrice.toLocaleString()}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            平台费用 (¥)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={formData.platform_fee || ''}
            onChange={(e) => setFormData({ ...formData, platform_fee: parseNumberInput(e.target.value, 0) })}
            className={input.base}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            运费 (¥)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={formData.shipping_fee || ''}
            onChange={(e) => setFormData({ ...formData, shipping_fee: parseNumberInput(e.target.value, 0) })}
            className={input.base}
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          销售日期
        </label>
        <DatePicker
          selected={formData.sale_date ? parseDateFromLocal(formData.sale_date) : new Date()}
          onChange={(date) => setFormData({ ...formData, sale_date: date ? formatDateToLocal(date) : getTodayString() })}
          placeholder="选择销售日期"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            销售平台
          </label>
          <select
            value={formData.selling_platform_id || ''}
            onChange={(e) => setFormData({ ...formData, selling_platform_id: e.target.value })}
            className={input.base}
          >
            <option value="">请选择</option>
            {sellingPlatforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.is_builtin ? '' : ' (カスタム)'}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newSellingPlatformName}
              onChange={(e) => setNewSellingPlatformName(e.target.value)}
              placeholder="添加新的销售平台..."
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={handleAddSellingPlatform}
              disabled={!newSellingPlatformName.trim()}
              className="px-3 py-2 bg-apple-blue hover:bg-apple-blue/90 disabled:bg-gray-400 text-white text-sm rounded-lg transition-all disabled:cursor-not-allowed"
            >
              添加
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            销售订单号
          </label>
          <input
            type="text"
            value={formData.sale_order_number || ''}
            onChange={(e) => setFormData({ ...formData, sale_order_number: e.target.value })}
            className={input.base}
            placeholder="注文番号"
          />
        </div>
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
          onClick={() => {
            if (successCount > 0 && onDataRefresh) {
              onDataRefresh();
            }
            onCancel();
          }}
          disabled={submitting}
          className={button.secondary + ' flex-1'}
        >
          {successCount > 0 ? '完成' : '取消'}
        </button>
      </div>
    </form>
  );
}
