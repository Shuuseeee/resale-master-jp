// components/SalesRecordsList.tsx
// 销售记录列表组件

'use client';

import { useState, useEffect } from 'react';
import type { SalesRecord } from '@/types/database.types';
import { getSalesRecords, deleteSalesRecord } from '@/lib/api/sales-records';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import { card, button, badge, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import { supabase } from '@/lib/supabase/client';

interface SalesRecordsListProps {
  transactionId: string;
  onUpdate: () => void;
}

export default function SalesRecordsList({ transactionId, onUpdate }: SalesRecordsListProps) {
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<SalesRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    sale_date: '',
    quantity_sold: 0,
    selling_price_per_unit: 0,
    platform_fee: 0,
    shipping_fee: 0,
    notes: '',
  });

  useEffect(() => {
    loadRecords();
  }, [transactionId]);

  const loadRecords = async () => {
    setLoading(true);
    const data = await getSalesRecords(transactionId);
    setRecords(data);
    setLoading(false);
  };

  const handleEdit = (record: SalesRecord) => {
    setEditingRecord(record);
    setEditFormData({
      sale_date: record.sale_date || new Date().toISOString().split('T')[0],
      quantity_sold: record.quantity_sold,
      selling_price_per_unit: record.selling_price_per_unit,
      platform_fee: record.platform_fee,
      shipping_fee: record.shipping_fee,
      notes: record.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    if (!editFormData.sale_date) {
      alert('请选择销售日期');
      return;
    }

    try {
      // 更新销售记录（不重新计算利润，因为数量和价格没变）
      const { error } = await supabase
        .from('sales_records')
        .update({
          sale_date: editFormData.sale_date,
          quantity_sold: editFormData.quantity_sold,
          selling_price_per_unit: editFormData.selling_price_per_unit,
          platform_fee: editFormData.platform_fee,
          shipping_fee: editFormData.shipping_fee,
          notes: editFormData.notes,
        })
        .eq('id', editingRecord.id);

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

  const handleCancelSale = async (record: SalesRecord) => {
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
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">加载中...</div>;
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        暂无销售记录
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <div key={record.id} className={card.secondary + ' p-4'}>
          {editingRecord?.id === record.id ? (
            // 编辑模式
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                编辑销售记录
              </h3>

              {!record.sale_date && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    ⚠️ 此销售记录缺少销售日期，请补充以确保税务申报准确。
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  销售日期 <span className="text-red-400">*</span>
                </label>
                <DatePicker
                  selected={editFormData.sale_date ? new Date(editFormData.sale_date) : null}
                  onChange={(date) => setEditFormData({ ...editFormData, sale_date: date ? date.toISOString().split('T')[0] : '' })}
                  placeholder="选择销售日期"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    销售数量
                  </label>
                  <input
                    type="number"
                    value={editFormData.quantity_sold || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, quantity_sold: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                    className={input.base}
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    单价 (¥)
                  </label>
                  <input
                    type="number"
                    value={editFormData.selling_price_per_unit || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, selling_price_per_unit: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className={input.base}
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    平台费用 (¥)
                  </label>
                  <input
                    type="number"
                    value={editFormData.platform_fee || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, platform_fee: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className={input.base}
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    运费 (¥)
                  </label>
                  <input
                    type="number"
                    value={editFormData.shipping_fee || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, shipping_fee: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className={input.base}
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  备注
                </label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                  className={input.base}
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
          ) : (
            // 显示模式
            <>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {record.sale_date ? new Date(record.sale_date).toLocaleDateString('zh-CN') : '未设置销售日期'}
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    售出 {record.quantity_sold} 个
                  </div>
                  {!record.sale_date && (
                    <div className="text-xs text-amber-500 mt-1">
                      ⚠️ 请编辑此记录补充销售日期
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(record)}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleCancelSale(record)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    取消销售
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">单价：</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatCurrency(record.selling_price_per_unit)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">总售价：</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatCurrency(record.total_selling_price)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">平台费：</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatCurrency(record.platform_fee)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">运费：</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatCurrency(record.shipping_fee)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">现金利润：</span>
                  <span className={`font-medium ${(record.cash_profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(record.cash_profit || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">总利润：</span>
                  <span className={`font-medium ${(record.total_profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(record.total_profit || 0)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600 dark:text-gray-400">ROI：</span>
                  <span className={`font-bold text-lg ${(record.roi || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatROI(record.roi || 0)}
                  </span>
                </div>
              </div>

              {record.notes && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{record.notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
