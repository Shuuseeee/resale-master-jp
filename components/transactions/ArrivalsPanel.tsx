// components/transactions/ArrivalsPanel.tsx — 详情页「到货管理」（对齐买取X 着荷管理）
// 列出到货明细（日期 / 数量 / 备注，可删），添加一次到货（数量不超过未到件数），「全部到货」，「重置为未到货」（没卖过时）。
// 没有明细的老数据 / 原生标记的到货按状态推断（见 lib/utils/arrivals.ts），这里显示为一行「已全部到货（无明细）」。
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Delete16Regular } from '@fluentui/react-icons/headless/svg/delete';
import DatePicker from '@/components/DatePicker';
import MessageBar from '@/components/fluent/MessageBar';
import { button, input } from '@/lib/theme';
import { addArrival, deleteArrivals, listArrivals, markAllArrived, resetToPending } from '@/lib/api/arrivals';
import { arrivedQty, notArrivedQty } from '@/lib/utils/arrivals';
import { formatDateToLocal, getTodayString, parseDateFromLocal } from '@/lib/utils/dateUtils';
import type { TransactionArrival } from '@/types/database.types';

interface Props {
  transaction: {
    id: string;
    status: string;
    quantity: number;
    quantity_arrived?: number | null;
    quantity_sold?: number | null;
    quantity_returned?: number | null;
  };
  /** 到货变化后重新读取交易（状态 / 已到货数量由数据库触发器更新） */
  onChange: () => void;
}

export default function ArrivalsPanel({ transaction, onChange }: Props) {
  const [rows, setRows] = useState<TransactionArrival[]>([]);
  const [qty, setQty] = useState(1);
  const [date, setDate] = useState(getTodayString());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const arrived = arrivedQty(transaction);
  const remaining = notArrivedQty(transaction);
  const sold = transaction.quantity_sold ?? 0;

  const reload = useCallback(async () => {
    try {
      setRows(await listArrivals(transaction.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取到货记录失败');
    }
  }, [transaction.id]);

  useEffect(() => {
    reload();
  }, [reload, transaction.quantity_arrived, transaction.status]);

  useEffect(() => {
    setQty(q => Math.min(Math.max(1, q), Math.max(1, remaining)));
  }, [remaining]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChange();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      await addArrival(transaction.id, qty, date, notes.trim() || null);
      setNotes('');
    });

  const remove = (row: TransactionArrival) => {
    if (!confirm(`删除 ${row.arrived_date} 到货的 ${row.quantity} 个？`)) return;
    run(() => deleteArrivals([row.id]));
  };

  const reset = () => {
    if (!confirm('改回「未到货」？到货记录会全部清除。')) return;
    run(() => resetToPending(transaction.id));
  };

  const field = input.base + ' w-full';

  return (
    <div className="sn-detail-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="sn-detail-title mb-0">到货管理</h3>
        <span className="text-sm text-[var(--color-text-secondary)] tabular-nums">到货 {arrived}/{transaction.quantity}</span>
      </div>

      {rows.length > 0 ? (
        <ul className="mb-4 divide-y divide-[var(--color-border)] text-sm">
          {rows.map(r => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className="tabular-nums text-[var(--color-text)]">{r.arrived_date}</span>
              <span className="tabular-nums font-semibold text-[var(--color-text)]">{r.quantity} 个</span>
              <span className="min-w-0 flex-1 truncate text-[var(--color-text-secondary)]">{r.notes}</span>
              <button
                onClick={() => remove(r)}
                disabled={busy}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                aria-label="删除这条到货记录"
              >
                <Delete16Regular />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          {arrived >= transaction.quantity ? '已全部到货（无到货明细）' : '暂无到货记录'}
        </p>
      )}

      {remaining > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="sn-form-label">到货数量</label>
              <input
                type="number"
                min={1}
                max={remaining}
                value={qty}
                onChange={e => setQty(Math.min(remaining, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
                className={field}
              />
            </div>
            <div>
              <label className="sn-form-label">到货日期</label>
              <DatePicker
                selected={parseDateFromLocal(date)}
                onChange={d => setDate(d ? formatDateToLocal(d) : getTodayString())}
                className={field}
              />
            </div>
          </div>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="备注（可选）" className={field} />
          <div className="flex gap-2">
            <button onClick={add} disabled={busy} className={button.secondary + ' flex-1'}>添加到货</button>
            <button onClick={() => run(() => markAllArrived(transaction.id))} disabled={busy} className={button.primary + ' flex-1'}>
              全部到货
            </button>
          </div>
        </div>
      )}

      {arrived > 0 && sold === 0 && transaction.status === 'in_stock' && (
        <button onClick={reset} disabled={busy} className={button.ghost + ' mt-3 w-full'}>重置为未到货</button>
      )}

      {error && <div className="mt-3"><MessageBar intent="error">{error}</MessageBar></div>}
    </div>
  );
}
