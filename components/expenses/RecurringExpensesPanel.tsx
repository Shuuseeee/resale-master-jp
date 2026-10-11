// components/expenses/RecurringExpensesPanel.tsx — 经费页「定期经费」视图：规则列表 + 暂停 / 恢复 / 编辑 / 删除
// 新建在「新增经费」表单里选「重复」。开始日与周期建好后不能改（决定已记笔数对应的日期），要改就删了重建。
'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Delete20Regular } from '@fluentui/react-icons/headless/svg/delete';
import { Edit20Regular } from '@fluentui/react-icons/headless/svg/edit';
import { DataTable } from '@/components/DataTable';
import Switch from '@/components/Switch';
import Modal, { ConfirmModal } from '@/components/Modal';
import Select from '@/components/Select';
import DatePicker from '@/components/DatePicker';
import MessageBar from '@/components/fluent/MessageBar';
import { badge, button, card, empty, input } from '@/lib/theme';
import { formatCurrency } from '@/lib/financial/calculator';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from '@/lib/expenses/categories';
import {
  deleteRecurringExpense,
  frequencyText,
  getRecurringExpenses,
  updateRecurringExpense,
} from '@/lib/api/recurring-expenses';
import type { RecurringExpense } from '@/types/database.types';

const columnHelper = createColumnHelper<RecurringExpense>();
const NONE: RecurringExpense[] = [];
const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map(c => ({ value: c.value, label: c.label }));
const iconBtn = 'p-2 text-[var(--color-text-muted)] rounded-[var(--radius-md)] transition-all';

export default function RecurringExpensesPanel() {
  const queryClient = useQueryClient();
  const { data: rules = NONE, isPending, error } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: getRecurringExpenses,
  });
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [deleting, setDeleting] = useState<RecurringExpense | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const patchCache = useCallback((id: string, patch: Partial<RecurringExpense>) => {
    queryClient.setQueryData<RecurringExpense[]>(['recurring-expenses'], old => old?.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, [queryClient]);

  const toggleActive = useCallback(async (rule: RecurringExpense) => {
    setActionError('');
    try {
      await updateRecurringExpense(rule.id, { active: !rule.active });
      patchCache(rule.id, { active: !rule.active });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败，请重试');
    }
  }, [patchCache]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setActionError('');
    try {
      await deleteRecurringExpense(deleting.id);
      queryClient.setQueryData<RecurringExpense[]>(['recurring-expenses'], old => old?.filter(r => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor('category', {
      header: '分类',
      enableSorting: false,
      cell: info => <span className={badge.info}>{expenseCategoryLabel(info.getValue())}</span>,
      meta: { card: { slot: 'badge' } },
    }),
    columnHelper.accessor('description', {
      header: '描述',
      enableSorting: false,
      cell: info => info.getValue() || '-',
      meta: { card: { slot: 'title' } },
    }),
    columnHelper.accessor('amount', {
      header: '每次金额',
      cell: info => formatCurrency(info.getValue()),
      meta: { align: 'right', tdClassName: 'font-mono font-semibold whitespace-nowrap', card: { slot: 'field', label: '每次金额' } },
    }),
    columnHelper.display({
      id: 'schedule',
      header: '周期',
      cell: ({ row }) => frequencyText(row.original.frequency, row.original.start_date),
      meta: { tdClassName: 'whitespace-nowrap', card: { slot: 'field', label: '周期' } },
    }),
    columnHelper.display({
      id: 'period',
      header: '期间',
      cell: ({ row }) => `${row.original.start_date} ～ ${row.original.end_date ?? '不结束'}`,
      meta: { tdClassName: 'whitespace-nowrap', minBreakpoint: 'lg', card: { slot: 'field', label: '期间' } },
    }),
    columnHelper.accessor('generated_count', {
      header: '已记',
      cell: info => `${info.getValue()} 笔`,
      meta: { align: 'right', tdClassName: 'whitespace-nowrap', card: { slot: 'field', label: '已记' } },
    }),
    columnHelper.display({
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">{row.original.active ? '启用' : '已暂停'}</span>
          <Switch checked={row.original.active} onClick={() => toggleActive(row.original)} label={row.original.active ? '暂停' : '恢复'} />
          <button
            onClick={() => setEditing(row.original)}
            className={iconBtn + ' hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]'}
            title="编辑"
          >
            <Edit20Regular />
          </button>
          <button
            onClick={() => setDeleting(row.original)}
            className={iconBtn + ' hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)]'}
            title="删除"
          >
            <Delete20Regular />
          </button>
        </div>
      ),
      meta: { align: 'right', card: { slot: 'actions' } },
    }),
  ], [toggleActive]);

  if (isPending) return null;

  if (error) {
    return <MessageBar intent="error">读取定期经费失败：{error.message}（数据库未升级时需先执行 23_recurring_expenses.sql）</MessageBar>;
  }

  return (
    <div className="space-y-4">
      {actionError && <MessageBar intent="error">{actionError}</MessageBar>}
      {rules.length === 0 ? (
        <div className={card.primary + ' ' + empty.container}>
          <p className={empty.title}>还没有定期经费</p>
          <p className={empty.text}>房租、仓库保管费、订阅服务等固定支出，在「新增经费」里选择「重复」后会按周期自动记入。</p>
          <Link href="/supplies/add" className={button.primary}>新增经费</Link>
        </div>
      ) : (
        <DataTable data={rules} columns={columns} getRowId={getRuleId} mobile="cards" />
      )}

      {editing && (
        <EditRuleModal
          rule={editing}
          onClose={() => setEditing(null)}
          onSaved={patch => {
            patchCache(editing.id, patch);
            setEditing(null);
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="删除定期经费"
        message={`删除后不再自动记入。已记入的 ${deleting?.generated_count ?? 0} 笔经费会保留，需要时到经费列表里逐笔删除。`}
        confirmText="删除"
        confirmVariant="danger"
        isLoading={busy}
      />
    </div>
  );
}

const getRuleId = (r: RecurringExpense) => r.id;

type RulePatch = Pick<RecurringExpense, 'category' | 'amount' | 'description' | 'notes' | 'end_date'>;

function EditRuleModal({ rule, onClose, onSaved }: { rule: RecurringExpense; onClose: () => void; onSaved: (patch: RulePatch) => void }) {
  const [form, setForm] = useState({
    category: rule.category,
    amount: String(rule.amount),
    description: rule.description ?? '',
    notes: rule.notes ?? '',
    end_date: rule.end_date ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const field = input.base + ' w-full';
  const label = 'mb-2 block text-sm font-medium text-[var(--color-text)]';

  const save = async () => {
    const amount = parseFloat(form.amount);
    if (!(amount > 0)) return setError('金额必须大于 0');
    if (form.end_date && form.end_date < rule.start_date) return setError('结束日期不能早于开始日期');
    const patch: RulePatch = {
      category: form.category,
      amount,
      description: form.description || null,
      notes: form.notes || null,
      end_date: form.end_date || null,
    };
    setSaving(true);
    try {
      await updateRecurringExpense(rule.id, patch);
      onSaved(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，请重试');
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="编辑定期经费" size="sm" closeOnOverlayClick={!saving}>
      <div className="space-y-4 py-2 md:py-0">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {frequencyText(rule.frequency, rule.start_date)}，{rule.start_date} 起。修改只影响之后记入的经费，已记入的 {rule.generated_count} 笔不变。
        </p>
        <div>
          <label className={label}>分类</label>
          <Select value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={CATEGORY_OPTIONS} className={field} />
        </div>
        <div>
          <label className={label}>每次金额</label>
          <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={field} />
        </div>
        <div>
          <label className={label}>描述</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={field} />
        </div>
        <div>
          <label className={label}>结束日期</label>
          <DatePicker
            selected={form.end_date ? parseDateFromLocal(form.end_date) : null}
            onChange={date => setForm(f => ({ ...f, end_date: date ? formatDateToLocal(date) : '' }))}
            minDate={parseDateFromLocal(rule.start_date) ?? undefined}
            placeholder="不结束"
            className={field}
          />
        </div>
        <div>
          <label className={label}>备注</label>
          <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={field + ' resize-none'} />
        </div>
        {error && <MessageBar intent="error">{error}</MessageBar>}
      </div>
      <div className="flex flex-col gap-3 pt-4 md:flex-row md:justify-end md:gap-2 md:pt-6">
        <button onClick={save} disabled={saving} className={button.primary}>{saving ? '保存中...' : '保存'}</button>
        <button onClick={onClose} disabled={saving} className={button.secondary}>取消</button>
      </div>
    </Modal>
  );
}
