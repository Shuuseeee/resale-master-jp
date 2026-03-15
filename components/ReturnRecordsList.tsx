// components/ReturnRecordsList.tsx
// 退货记录列表组件

'use client';

import { useState, useEffect } from 'react';
import type { ReturnRecord, Transaction } from '@/types/database.types';
import { getReturnRecords, deleteReturnRecord } from '@/lib/api/return-records';
import { formatCurrency } from '@/lib/financial/calculator';
import { card } from '@/lib/theme';

interface ReturnRecordsListProps {
  transactionId: string;
  onUpdate: () => void;
}

export default function ReturnRecordsList({ transactionId, onUpdate }: ReturnRecordsListProps) {
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, [transactionId]);

  const loadRecords = async () => {
    setLoading(true);
    const data = await getReturnRecords(transactionId);
    setRecords(data);
    setLoading(false);
  };

  const handleDelete = async (record: ReturnRecord) => {
    if (!confirm('确定要删除这条退货记录吗？\n\n此操作将恢复库存数量。')) {
      return;
    }

    try {
      const success = await deleteReturnRecord(record.id);
      if (!success) {
        alert('删除失败，请重试');
        return;
      }
      alert('退货记录已删除');
      await loadRecords();
      onUpdate();
    } catch (error) {
      console.error('删除退货记录失败:', error);
      alert('操作失败，请重试');
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">加载中...</div>;
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        暂无退货记录
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
                {new Date(record.return_date).toLocaleDateString('zh-CN')}
              </div>
              <div className="text-lg font-semibold text-red-600 dark:text-red-300">
                退货 {record.quantity_returned} 个
              </div>
            </div>
            <button
              onClick={() => handleDelete(record)}
              className="text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200 text-sm"
            >
              删除
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {record.return_amount > 0 && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">退款金额：</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {formatCurrency(record.return_amount)}
                </span>
              </div>
            )}
            {record.points_deducted > 0 && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">扣除积分：</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {record.points_deducted} P
                </span>
              </div>
            )}
          </div>

          {record.return_reason && (
            <div className="mt-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">退货原因：</span>
              <span className="text-gray-900 dark:text-white">{record.return_reason}</span>
            </div>
          )}

          {record.notes && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">{record.notes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
