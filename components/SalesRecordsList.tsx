// components/SalesRecordsList.tsx
// 销售记录列表组件：桌面 DataTable（嵌入详情卡片，bare 模式）+ 移动卡片，编辑走 Modal

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { StickyNote } from 'lucide-react';
import type { SalesRecord, Transaction } from '@/types/database.types';
import { getSalesRecords, deleteSalesRecord, updateSalesRecord } from '@/lib/api/sales-records';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import { button, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import Modal from '@/components/Modal';
import { DataTable } from '@/components/DataTable';
import { getTodayString, formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';

type SalesRecordWithPlatform = SalesRecord & {
  selling_platform?: { id: string; name: string } | null;
};

interface SalesRecordsListProps {
  transactionId: string;
  transaction: Transaction;
  onUpdate: () => void;
}

const columnHelper = createColumnHelper<SalesRecordWithPlatform>();

const profitClass = (value: number) =>
  value >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]';

export default function SalesRecordsList({ transactionId, transaction, onUpdate }: SalesRecordsListProps) {
  const [records, setRecords] = useState<SalesRecordWithPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<SalesRecordWithPlatform | null>(null);
  const [editFormData, setEditFormData] = useState({
    sale_date: '',
    quantity_sold: 0,
    selling_price_per_unit: 0,
    platform_fee: 0,
    shipping_fee: 0,
    notes: '',
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const data = await getSalesRecords(transactionId);
    setRecords(data as SalesRecordWithPlatform[]);
    setLoading(false);
  }, [transactionId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleEdit = useCallback((record: SalesRecordWithPlatform) => {
    setEditingRecord(record);
    setEditFormData({
      sale_date: record.sale_date || getTodayString(),
      quantity_sold: record.quantity_sold,
      selling_price_per_unit: record.selling_price_per_unit,
      platform_fee: record.platform_fee,
      shipping_fee: record.shipping_fee,
      notes: record.notes || '',
    });
  }, []);

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    if (!editFormData.sale_date) {
      alert('请选择销售日期');
      return;
    }

    try {
      const { error } = await updateSalesRecord(
        editingRecord.id,
        editFormData,
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
          date: transaction.date,
        }
      );

      if (error) throw error;

      alert('保存成功！');
      setEditingRecord(null);
      await loadRecords();
      onUpdate();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
  };

  const handleCancelSale = useCallback(async (record: SalesRecordWithPlatform) => {
    if (!confirm('确定要取消这笔销售吗？\n\n此操作将：\n• 删除该销售记录\n• 恢复库存数量\n• 如果全部售出已取消，状态将改回"库存中"\n\n此操作无法撤销。')) {
      return;
    }

    try {
      // 1. 删除销售记录 (会触发数据库触发器自动更新 quantity_sold)
      const deleteSuccess = await deleteSalesRecord(record.id);
      if (!deleteSuccess) {
        alert('删除销售记录失败，请重试');
        return;
      }

      alert('销售已取消，库存已恢复');
      await loadRecords();
      onUpdate();
    } catch (error) {
      console.error('取消销售失败:', error);
      alert('操作失败，请重试');
    }
  }, [loadRecords, onUpdate]);

  const columns = useMemo(() => [
    columnHelper.accessor('sale_date', {
      header: '日期',
      sortingFn: 'basic',
      cell: info => info.getValue()
        ? new Date(info.getValue()!).toLocaleDateString('zh-CN')
        : <span className="text-[var(--color-warning)]">未设置</span>,
      meta: { tdClassName: 'whitespace-nowrap' },
    }),
    columnHelper.display({
      id: 'platform',
      header: '平台 / 订单',
      cell: ({ row }) => {
        const r = row.original;
        if (!r.selling_platform && !r.sale_order_number) return '-';
        return (
          <div className="min-w-0">
            {r.selling_platform && (
              <div className="text-xs font-medium text-[var(--color-primary)]">
                {r.selling_platform.name}
              </div>
            )}
            {r.sale_order_number && (
              <div className="max-w-[10rem] truncate text-xs text-[var(--color-text-muted)]" title={r.sale_order_number}>
                {r.sale_order_number}
              </div>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor('quantity_sold', {
      header: '数量',
      meta: { align: 'right' },
    }),
    columnHelper.accessor('selling_price_per_unit', {
      header: '单价',
      cell: info => formatCurrency(info.getValue()),
      meta: { align: 'right', tdClassName: 'font-mono whitespace-nowrap' },
    }),
    columnHelper.accessor('total_selling_price', {
      header: '总售价',
      cell: info => formatCurrency(info.getValue()),
      meta: { align: 'right', tdClassName: 'font-mono whitespace-nowrap', minBreakpoint: 'lg' },
    }),
    columnHelper.accessor('platform_fee', {
      header: '平台费',
      cell: info => formatCurrency(info.getValue()),
      meta: { align: 'right', tdClassName: 'font-mono whitespace-nowrap', minBreakpoint: 'lg' },
    }),
    columnHelper.accessor('shipping_fee', {
      header: '运费',
      cell: info => formatCurrency(info.getValue()),
      meta: { align: 'right', tdClassName: 'font-mono whitespace-nowrap', minBreakpoint: 'lg' },
    }),
    columnHelper.accessor(r => r.cash_profit ?? 0, {
      id: 'cash_profit',
      header: '现金利润',
      cell: info => (
        <span className={`font-medium ${profitClass(info.getValue())}`}>
          {formatCurrency(info.getValue())}
        </span>
      ),
      meta: { align: 'right', tdClassName: 'font-mono whitespace-nowrap', minBreakpoint: 'xl' },
    }),
    columnHelper.accessor(r => r.total_profit ?? 0, {
      id: 'total_profit',
      header: '总利润',
      cell: info => (
        <span className={`font-medium ${profitClass(info.getValue())}`}>
          {formatCurrency(info.getValue())}
        </span>
      ),
      meta: { align: 'right', tdClassName: 'font-mono whitespace-nowrap' },
    }),
    columnHelper.accessor(r => r.roi ?? 0, {
      id: 'roi',
      header: 'ROI',
      cell: info => (
        <span className={`font-bold ${profitClass(info.getValue())}`}>
          {formatROI(info.getValue())}
        </span>
      ),
      meta: { align: 'right', tdClassName: 'whitespace-nowrap' },
    }),
    columnHelper.display({
      id: 'actions',
      header: '操作',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            {r.notes && (
              <span title={r.notes}>
                <StickyNote className="w-4 h-4 text-[var(--color-text-muted)]" />
              </span>
            )}
            <button
              onClick={() => handleEdit(r)}
              className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            >
              编辑
            </button>
            <button
              onClick={() => handleCancelSale(r)}
              className="whitespace-nowrap text-sm font-medium text-[var(--color-danger)] hover:opacity-80"
            >
              取消销售
            </button>
          </div>
        );
      },
      meta: { align: 'right' },
    }),
  ], [handleEdit, handleCancelSale]);

  // 移动端卡片（沿用原展示形态）
  const renderRecordCard = (record: SalesRecordWithPlatform) => (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {record.sale_date ? new Date(record.sale_date).toLocaleDateString('zh-CN') : '未设置销售日期'}
          </div>
          <div className="text-lg font-semibold text-[var(--color-text)]">
            售出 {record.quantity_sold} 个
          </div>
          {record.selling_platform && (
            <div className="text-xs text-[var(--color-primary)] mt-0.5">
              {record.selling_platform.name}
              {record.sale_order_number && ` · ${record.sale_order_number}`}
            </div>
          )}
          {!record.selling_platform && record.sale_order_number && (
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
              订单: {record.sale_order_number}
            </div>
          )}
          {!record.sale_date && (
            <div className="text-xs text-[var(--color-warning)] mt-1">
              请编辑此记录补充销售日期
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(record)}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] text-sm font-medium"
          >
            编辑
          </button>
          <button
            onClick={() => handleCancelSale(record)}
            className="text-[var(--color-danger)] hover:opacity-80 text-sm font-medium"
          >
            取消销售
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-[var(--color-text-muted)]">单价：</span>
          <span className="text-[var(--color-text)] font-medium">
            {formatCurrency(record.selling_price_per_unit)}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">总售价：</span>
          <span className="text-[var(--color-text)] font-medium">
            {formatCurrency(record.total_selling_price)}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">平台费：</span>
          <span className="text-[var(--color-text)] font-medium">
            {formatCurrency(record.platform_fee)}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">运费：</span>
          <span className="text-[var(--color-text)] font-medium">
            {formatCurrency(record.shipping_fee)}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">现金利润：</span>
          <span className={`font-medium ${profitClass(record.cash_profit || 0)}`}>
            {formatCurrency(record.cash_profit || 0)}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">总利润：</span>
          <span className={`font-medium ${profitClass(record.total_profit || 0)}`}>
            {formatCurrency(record.total_profit || 0)}
          </span>
        </div>
        <div className="col-span-2">
          <span className="text-[var(--color-text-muted)]">ROI：</span>
          <span className={`font-bold text-lg ${profitClass(record.roi || 0)}`}>
            {formatROI(record.roi || 0)}
          </span>
        </div>
      </div>

      {record.notes && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-muted)]">{record.notes}</p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="text-center py-4 text-[var(--color-text-muted)]">加载中...</div>;
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-text-muted)]">
        暂无销售记录
      </div>
    );
  }

  return (
    <>
      <DataTable
        data={records}
        columns={columns}
        getRowId={r => r.id}
        bare
        mobile="cards"
        renderMobileItem={row => renderRecordCard(row.original)}
      />

      {/* 编辑销售记录 Modal */}
      <Modal
        isOpen={editingRecord !== null}
        onClose={handleCancelEdit}
        title="编辑销售记录"
        size="lg"
      >
        {editingRecord && (
          <div className="space-y-4">
            {!editingRecord.sale_date && (
              <div className="bg-[var(--color-warning-subtle)] border border-[var(--color-warning-border)] rounded-[var(--radius-md)] p-3">
                <p className="text-sm text-[var(--color-warning)]">
                  此销售记录缺少销售日期，请补充以确保税务申报准确。
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                销售日期 <span className="text-[var(--color-danger)]">*</span>
              </label>
              <DatePicker
                selected={editFormData.sale_date ? parseDateFromLocal(editFormData.sale_date) : null}
                onChange={(date) => setEditFormData({ ...editFormData, sale_date: date ? formatDateToLocal(date) : '' })}
                placeholder="选择销售日期"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  销售数量
                </label>
                <input
                  type="number"
                  value={editFormData.quantity_sold || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, quantity_sold: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className={input.base + ' w-full'}
                  min="1"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  单价 (¥)
                </label>
                <input
                  type="number"
                  value={editFormData.selling_price_per_unit || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, selling_price_per_unit: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  className={input.base + ' w-full'}
                  step="0.01"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  平台费用 (¥)
                </label>
                <input
                  type="number"
                  value={editFormData.platform_fee || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, platform_fee: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  className={input.base + ' w-full'}
                  step="0.01"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  运费 (¥)
                </label>
                <input
                  type="number"
                  value={editFormData.shipping_fee || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, shipping_fee: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  className={input.base + ' w-full'}
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                备注
              </label>
              <textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                rows={3}
                className={input.base + ' w-full'}
                placeholder="可选"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSaveEdit}
                className={button.primary + ' flex-1'}
              >
                保存
              </button>
              <button
                onClick={handleCancelEdit}
                className={button.secondary + ' flex-1'}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
