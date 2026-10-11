'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSuppliesCost } from '@/lib/api/supplies';
import type { RecurringFrequency, SuppliesCostFormData } from '@/types/database.types';
import { createRecurringExpense, FREQUENCY_OPTIONS, frequencyText, generateRecurringExpenses } from '@/lib/api/recurring-expenses';
import { button, card, heading, input, layout } from '@/lib/theme';
import PageHeader from '@/components/shell/PageHeader';
import Select from '@/components/Select';
import DatePicker from '@/components/DatePicker';
import { formatDateToLocal, getTodayString, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { DEFAULT_EXPENSE_CATEGORY, EXPENSE_CATEGORIES } from '@/lib/expenses/categories';
import ExpenseAttachments from '@/components/expenses/ExpenseAttachments';
import { uploadAttachment } from '@/lib/api/expense-attachments';

const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map(c => ({ value: c.value, label: c.label }));
const REPEAT_OPTIONS = [{ value: 'none', label: '不重复' }, ...FREQUENCY_OPTIONS];

export default function AddSupplyPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<SuppliesCostFormData>({
    category: DEFAULT_EXPENSE_CATEGORY as string,
    amount: 0,
    purchase_date: getTodayString(),
    description: '',
    notes: '',
  });
  // 重复：选了周期就登记为定期经费，由 generate_recurring_expenses 按日期记入（到今天为止的立即补记）
  const [repeatValue, setRepeat] = useState<RecurringFrequency | 'none'>('none');
  const repeat = repeatValue === 'none' ? null : repeatValue;
  const [endDate, setEndDate] = useState('');
  // 凭证先暂存在本地，经费保存后再上传（要用新经费的 id 做存储路径）；定期经费不带凭证
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!formData.category) next.category = '请选择经费分类';
    if (formData.amount <= 0) next.amount = '金额必须大于 0';
    if (!formData.purchase_date) next.purchase_date = repeat ? '请选择开始日期' : '请选择采购日期';
    if (repeat && endDate && formData.purchase_date && endDate < formData.purchase_date) next.end_date = '结束日期不能早于开始日期';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (repeat) {
        await createRecurringExpense({
          category: formData.category,
          amount: formData.amount,
          description: formData.description || null,
          notes: formData.notes || null,
          frequency: repeat,
          start_date: formData.purchase_date,
          end_date: endDate || null,
        });
        await generateRecurringExpenses();
        router.push('/supplies?section=recurring');
        return;
      }
      const { data, error } = await createSuppliesCost(formData);
      if (error || !data) throw error ?? new Error('保存失败');
      const failed: string[] = [];
      for (const f of pendingFiles) {
        try {
          await uploadAttachment(data.id, f);
        } catch (e) {
          failed.push(e instanceof Error ? e.message : f.name);
        }
      }
      if (failed.length) {
        alert(`经费已保存，但有 ${failed.length} 个凭证没传上去：\n${failed.join('\n')}\n\n可以在编辑页重新上传。`);
        router.push(`/supplies/${data.id}/edit`);
        return;
      }
      router.push('/supplies');
    } catch (error: any) {
      setErrors(prev => ({ ...prev, submit: error.message || '保存失败，请重试' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = input.base + ' w-full';

  return (
    <div className={layout.page}>
      <PageHeader crumbs={[{ label: '经费', href: '/supplies' }, { label: '新增经费' }]} />
      <div className={'mx-auto max-w-3xl px-4 py-6 ' + layout.narrowDesktop}>
        <div className={layout.section + ' md:mb-0'}>
          <button onClick={() => router.back()} className={button.ghost + ' mb-4 inline-flex items-center gap-2 md:hidden'}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>
          <h1 className={heading.page}>新增经费</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-5 flex items-center gap-2'}>
              经费信息
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">分类 <span className="text-[var(--color-danger)]">*</span></label>
                <Select
                  value={formData.category}
                  onChange={v => handleInputChange({ target: { name: 'category', value: v } } as unknown as React.ChangeEvent<HTMLSelectElement>)}
                  options={CATEGORY_OPTIONS}
                  className={field}
                />
                {errors.category && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.category}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">{repeat ? '开始日期' : '采购日期'} <span className="text-[var(--color-danger)]">*</span></label>
                <DatePicker
                  selected={formData.purchase_date ? parseDateFromLocal(formData.purchase_date) : null}
                  onChange={date => setFormData(prev => ({ ...prev, purchase_date: date ? formatDateToLocal(date) : '' }))}
                  className={field}
                />
                {errors.purchase_date && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.purchase_date}</p>}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">重复</label>
                <Select value={repeatValue} onChange={v => setRepeat(v as RecurringFrequency | 'none')} options={REPEAT_OPTIONS} className={field} />
              </div>
              {repeat && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">结束日期</label>
                  <DatePicker
                    selected={endDate ? parseDateFromLocal(endDate) : null}
                    onChange={date => setEndDate(date ? formatDateToLocal(date) : '')}
                    className={field}
                    placeholder="不结束"
                    minDate={parseDateFromLocal(formData.purchase_date) ?? undefined}
                  />
                  {errors.end_date && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.end_date}</p>}
                </div>
              )}
            </div>
            {repeat && formData.purchase_date && (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {frequencyText(repeat, formData.purchase_date)}自动记一笔{endDate ? `，到 ${endDate} 为止` : ''}；开始日期到今天（含）为止的会立即记入。之后可在「经费 › 定期经费」暂停或修改。
              </p>
            )}

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">{repeat ? '每次金额' : '金额'} <span className="text-[var(--color-danger)]">*</span></label>
              <div className="relative">
                <input type="number" name="amount" value={formData.amount || ''} onChange={handleNumberChange} className={field + ' pr-12'} min="0" step="0.01" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">¥</span>
              </div>
              {errors.amount && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.amount}</p>}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">描述</label>
              <input name="description" value={formData.description} onChange={handleInputChange} className={field} placeholder="例如：A4 气泡袋 100 个" />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">备注</label>
              <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className={field + ' resize-none'} placeholder="补充说明..." />
            </div>
          </section>

          {!repeat && <ExpenseAttachments pending={pendingFiles} onPendingChange={setPendingFiles} />}

          {errors.submit && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger-border)] bg-[var(--color-danger-subtle)] p-4 text-sm text-[var(--color-danger)]">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className={button.primary + ' flex-1'}>
              {isSubmitting ? '保存中...' : '保存经费'}
            </button>
            <button type="button" onClick={() => router.back()} className={button.secondary}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
