// components/MultiItemSaleForm.tsx
// 多件商品同一订单售出表单

'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Transaction, SellingPlatform } from '@/types/database.types';
import { createSaleOrder } from '@/lib/api/sale-orders';
import { computeSaleProfit } from '@/lib/api/sales-records';
import { button, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import { getTodayString, formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { parseNumberInput } from '@/lib/number-utils';
import { getSellingPlatforms, createSellingPlatform } from '@/lib/api/platforms';

interface PerItemDraft {
  quantity_sold: number;
  selling_price_per_unit: number;
  platform_fee: number;
  shipping_fee: number;
}

function getDefaultDraft(tx: Transaction): PerItemDraft {
  return {
    quantity_sold: tx.quantity_in_stock,
    selling_price_per_unit: 0,
    platform_fee: 0,
    shipping_fee: 0,
  };
}

interface MultiItemSaleFormProps {
  transactions: Transaction[];
  onSuccess: (orderId: string) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export default function MultiItemSaleForm({
  transactions,
  onSuccess,
  onCancel,
  onDirtyChange,
}: MultiItemSaleFormProps) {
  // ── 共享字段 ──
  const [saleDate, setSaleDate] = useState(getTodayString());
  const [sellingPlatformId, setSellingPlatformId] = useState('');
  const [saleOrderNumber, setSaleOrderNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [newPlatformName, setNewPlatformName] = useState('');

  // ── 逐件草稿 ──
  const [drafts, setDrafts] = useState<Record<string, PerItemDraft>>(() => {
    const init: Record<string, PerItemDraft> = {};
    for (const tx of transactions) {
      init[tx.id] = getDefaultDraft(tx);
    }
    return init;
  });

  const [sellingPlatforms, setSellingPlatforms] = useState<SellingPlatform[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSellingPlatforms().then(setSellingPlatforms);
  }, []);

  // dirty 检测
  const isDirty = useMemo(() => {
    if (submitting) return false;
    if (saleOrderNumber || notes || sellingPlatformId) return true;
    return transactions.some(tx => {
      const d = drafts[tx.id];
      if (!d) return false;
      return (
        d.selling_price_per_unit !== 0 ||
        d.platform_fee !== 0 ||
        d.shipping_fee !== 0
      );
    });
  }, [submitting, saleDate, saleOrderNumber, notes, sellingPlatformId, drafts, transactions]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const updateDraft = (txId: string, patch: Partial<PerItemDraft>) => {
    setDrafts(prev => ({ ...prev, [txId]: { ...prev[txId], ...patch } }));
  };

  const handleAddPlatform = async () => {
    const name = newPlatformName.trim();
    if (!name) return;
    const created = await createSellingPlatform(name);
    if (created) {
      setSellingPlatforms(prev => [...prev, created]);
      setSellingPlatformId(created.id);
      setNewPlatformName('');
    }
  };

  // ── 每件实时利润预览 ──
  const profitPreviews = useMemo(() => {
    const result: Record<string, ReturnType<typeof computeSaleProfit>> = {};
    for (const tx of transactions) {
      const d = drafts[tx.id];
      if (!d) continue;
      result[tx.id] = computeSaleProfit(d, {
        purchase_price_total: tx.purchase_price_total,
        quantity: tx.quantity,
        expected_platform_points: tx.expected_platform_points,
        expected_card_points: tx.expected_card_points,
        extra_platform_points: tx.extra_platform_points,
        platform_points_platform_id: tx.platform_points_platform_id,
        card_points_platform_id: tx.card_points_platform_id,
        extra_platform_points_platform_id: tx.extra_platform_points_platform_id,
      });
    }
    return result;
  }, [transactions, drafts]);

  // ── 订单合计 ──
  const totals = useMemo(() => {
    let totalSelling = 0, totalFees = 0, totalProfit = 0;
    for (const tx of transactions) {
      const d = drafts[tx.id];
      if (!d) continue;
      totalSelling += d.quantity_sold * d.selling_price_per_unit;
      totalFees += d.platform_fee + d.shipping_fee;
      totalProfit += profitPreviews[tx.id]?.total_profit ?? 0;
    }
    return { totalSelling, totalFees, totalProfit };
  }, [transactions, drafts, profitPreviews]);

  // ── 校验 ──
  const validate = (): string | null => {
    for (const tx of transactions) {
      const d = drafts[tx.id];
      if (!d) continue;
      const inStock = tx.quantity_in_stock;
      if (d.quantity_sold <= 0) return `「${tx.product_name}」销售数量必须大于 0`;
      if (d.quantity_sold > inStock) return `「${tx.product_name}」销售数量不能超过库存 (${inStock})`;
      if (d.selling_price_per_unit <= 0) return `「${tx.product_name}」单价必须大于 0`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const items = transactions.map(tx => ({
        transaction_id: tx.id,
        quantity_in_stock: tx.quantity_in_stock,
        ...drafts[tx.id],
        basis: {
          purchase_price_total: tx.purchase_price_total,
          quantity: tx.quantity,
          expected_platform_points: tx.expected_platform_points,
          expected_card_points: tx.expected_card_points,
          extra_platform_points: tx.extra_platform_points,
          platform_points_platform_id: tx.platform_points_platform_id,
          card_points_platform_id: tx.card_points_platform_id,
          extra_platform_points_platform_id: tx.extra_platform_points_platform_id,
        },
      }));

      const { orderId, error: apiError } = await createSaleOrder(
        {
          sale_date: saleDate,
          selling_platform_id: sellingPlatformId || null,
          sale_order_number: saleOrderNumber || null,
          notes: notes || null,
        },
        items
      );

      if (apiError || !orderId) {
        setError(apiError?.message || '保存失败，请重试');
        return;
      }

      onSuccess(orderId);
    } catch (err: any) {
      setError(err.message || '保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* 错误提示 */}
      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] p-4">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* ── 共享字段 ── */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">订单共享信息</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 销售日期 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
              销售日期
            </label>
            <DatePicker
              selected={saleDate ? parseDateFromLocal(saleDate) : new Date()}
              onChange={(date) => setSaleDate(date ? formatDateToLocal(date) : getTodayString())}
              placeholder="选择销售日期"
            />
          </div>

          {/* 销售订单号 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
              订单号
            </label>
            <input
              type="text"
              value={saleOrderNumber}
              onChange={(e) => setSaleOrderNumber(e.target.value)}
              className={input.base + ' w-full'}
              placeholder="如：Yahoo! 注文番号"
            />
          </div>
        </div>

        {/* 销售平台 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            销售平台
          </label>
          <select
            value={sellingPlatformId}
            onChange={(e) => setSellingPlatformId(e.target.value)}
            className={input.base + ' w-full'}
          >
            <option value="">请选择</option>
            {sellingPlatforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.is_builtin ? '' : '（自定义）'}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newPlatformName}
              onChange={(e) => setNewPlatformName(e.target.value)}
              placeholder="添加新的销售平台..."
              className={input.base + ' flex-1'}
            />
            <button
              type="button"
              onClick={handleAddPlatform}
              disabled={!newPlatformName.trim()}
              className={button.primary + ' px-4 py-2 text-sm'}
            >
              添加
            </button>
          </div>
        </div>

        {/* 备注 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            备注
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={input.base + ' w-full'}
            placeholder="可选"
          />
        </div>
      </div>

      {/* ── 逐件输入 ── */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">逐件录入</p>
        {transactions.map((tx) => {
          const d = drafts[tx.id] ?? getDefaultDraft(tx);
          const inStock = tx.quantity_in_stock;
          const preview = profitPreviews[tx.id];
          const totalSell = d.quantity_sold * d.selling_price_per_unit;

          return (
            <div
              key={tx.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col gap-3"
            >
              {/* 商品标题行 */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{tx.product_name}</p>
                  {tx.jan_code && (
                    <p className="text-xs text-[var(--color-text-muted)]">JAN: {tx.jan_code}</p>
                  )}
                </div>
                <span className="flex-shrink-0 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] px-2 py-1 rounded-full whitespace-nowrap">
                  库存 {inStock}/{tx.quantity}
                </span>
              </div>

              {/* 数量 + 单价 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                    数量 <span className="text-[var(--color-danger)]">*</span>
                    <span className="ml-1 text-[var(--color-text-muted)]">(最多 {inStock})</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={d.quantity_sold || ''}
                    onChange={(e) => updateDraft(tx.id, { quantity_sold: parseNumberInput(e.target.value, 0) })}
                    className={input.base + ' w-full' + (d.quantity_sold > inStock ? ' border-[var(--color-danger)]' : '')}
                    placeholder="1"
                  />
                  {d.quantity_sold > inStock && (
                    <p className="mt-1 text-xs text-[var(--color-danger)]">超出库存</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                    单价 (¥) <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={d.selling_price_per_unit || ''}
                    onChange={(e) => updateDraft(tx.id, { selling_price_per_unit: parseNumberInput(e.target.value, 0) })}
                    className={input.base + ' w-full'}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 平台费 + 运费 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                    平台费用 (¥)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={d.platform_fee || ''}
                    onChange={(e) => updateDraft(tx.id, { platform_fee: parseNumberInput(e.target.value, 0) })}
                    className={input.base + ' w-full'}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                    运费 (¥)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={d.shipping_fee || ''}
                    onChange={(e) => updateDraft(tx.id, { shipping_fee: parseNumberInput(e.target.value, 0) })}
                    className={input.base + ' w-full'}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 该件利润预览 */}
              {(d.selling_price_per_unit > 0 || totalSell > 0) && (
                <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  <span>售价 ¥{totalSell.toLocaleString()}</span>
                  {preview && (
                    <span className={preview.total_profit >= 0 ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-danger)] font-semibold'}>
                      利润 ¥{Math.round(preview.total_profit).toLocaleString()}
                      <span className="ml-1 font-normal">({preview.roi.toFixed(1)}%)</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 订单合计 ── */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-primary)]/20 bg-[var(--color-primary-light)] p-4">
        <p className="mb-2 text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wider">订单合计</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">总售价</p>
            <p className="font-bold text-[var(--color-text)]">¥{Math.round(totals.totalSelling).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">费用合计</p>
            <p className="font-bold text-[var(--color-text)]">¥{Math.round(totals.totalFees).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">预计利润</p>
            <p className={`font-bold ${totals.totalProfit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
              ¥{Math.round(totals.totalProfit).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* ── 操作按钮 ── */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className={button.primary + ' flex-1'}
        >
          {submitting ? '保存中...' : `确认售出 (${transactions.length} 件)`}
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
