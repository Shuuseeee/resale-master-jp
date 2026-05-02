// components/ReturnRecordsList.tsx
// 退货记录列表组件

'use client';

import { useState, useEffect } from 'react';
import type { ReturnRecord } from '@/types/database.types';
import { getReturnRecords, deleteReturnRecord } from '@/lib/api/return-records';
import { formatCurrency } from '@/lib/financial/calculator';

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
    return <div className="text-center py-4 text-[var(--color-text-muted)]">加载中...</div>;
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-text-muted)]">
        暂无退货记录
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <div key={record.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {new Date(record.return_date).toLocaleDateString('zh-CN')}
              </div>
              <div className="text-lg font-semibold text-[var(--color-danger)]">
                退货 {record.quantity_returned} 个
              </div>
            </div>
            <button
              onClick={() => handleDelete(record)}
              className="text-[var(--color-danger)] hover:opacity-80 text-sm font-medium"
            >
              删除
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {record.return_amount > 0 && (
              <div>
                <span className="text-[var(--color-text-muted)]">退款金额：</span>
                <span className="text-[var(--color-text)] font-medium">
                  {formatCurrency(record.return_amount)}
                </span>
              </div>
            )}
            {record.points_deducted > 0 && (
              <div>
                <span className="text-[var(--color-text-muted)]">扣除积分：</span>
                <span className="text-[var(--color-text)] font-medium">
                  {record.points_deducted} P
                </span>
              </div>
            )}
          </div>

          {record.return_reason && (
            <div className="mt-2 text-sm">
              <span className="text-[var(--color-text-muted)]">退货原因：</span>
              <span className="text-[var(--color-text)]">{record.return_reason}</span>
            </div>
          )}

          {record.notes && (
            <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-text-muted)]">{record.notes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
