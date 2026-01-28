// components/SalesRecordsList.tsx
// 销售记录列表组件

'use client';

import { useState, useEffect } from 'react';
import type { SalesRecord } from '@/types/database.types';
import { getSalesRecords, deleteSalesRecord } from '@/lib/api/sales-records';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import { card, button, badge } from '@/lib/theme';

interface SalesRecordsListProps {
  transactionId: string;
  onUpdate: () => void;
}

export default function SalesRecordsList({ transactionId, onUpdate }: SalesRecordsListProps) {
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, [transactionId]);

  const loadRecords = async () => {
    setLoading(true);
    const data = await getSalesRecords(transactionId);
    setRecords(data);
    setLoading(false);
  };

  const handleCancelSale = async (record: SalesRecord) => {
    if (!confirm('确定要取消这笔销售吗？\n\n此操作将：\n• 删除该销售记录\n• 恢复库存数量\n• 如果全部售出已取消，状态将改回"库存中"\n\n此操作无法撤销。')) {
      return;
    }

    try {
      // 1. 删除销售记录
      const deleteSuccess = await deleteSalesRecord(record.id);
      if (!deleteSuccess) {
        alert('删除销售记录失败，请重试');
        return;
      }

      // 2. 获取交易当前数据
      const { data: transaction, error: fetchError } = await (await import('@/lib/supabase/client')).supabase
        .from('transactions')
        .select('*')
        .eq('id', record.transaction_id)
        .single();

      if (fetchError || !transaction) {
        alert('获取交易数据失败，请刷新页面');
        return;
      }

      // 3. 更新交易数据
      const newQuantitySold = transaction.quantity_sold - record.quantity_sold;
      const newQuantityInStock = transaction.quantity_in_stock + record.quantity_sold;
      const newStatus = newQuantitySold === 0 ? 'in_stock' : transaction.status;

      const { error: updateError } = await (await import('@/lib/supabase/client')).supabase
        .from('transactions')
        .update({
          quantity_sold: newQuantitySold,
          quantity_in_stock: newQuantityInStock,
          status: newStatus,
        })
        .eq('id', record.transaction_id);

      if (updateError) {
        alert('更新交易数据失败，请重试');
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
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(record.sale_date).toLocaleDateString('zh-CN')}
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                售出 {record.quantity_sold} 个
              </div>
            </div>
            <button
              onClick={() => handleCancelSale(record)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              取消销售
            </button>
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
        </div>
      ))}
    </div>
  );
}
