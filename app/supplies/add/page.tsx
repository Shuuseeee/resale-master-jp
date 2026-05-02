'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSuppliesCost } from '@/lib/api/supplies';
import type { SuppliesCostFormData } from '@/types/database.types';
import { button, card, heading, input, layout } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import { formatDateToLocal, getTodayString, parseDateFromLocal } from '@/lib/utils/dateUtils';

const CATEGORY_OPTIONS = [
  { value: '包装材料', label: '包装材料' },
  { value: '运输耗材', label: '运输耗材' },
  { value: '标签打印', label: '标签打印' },
  { value: '其他', label: '其他' },
];

export default function AddSupplyPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<SuppliesCostFormData>({
    category: '包装材料',
    amount: 0,
    purchase_date: getTodayString(),
    description: '',
    notes: '',
  });
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
    if (!formData.category) next.category = '请选择耗材分类';
    if (formData.amount <= 0) next.amount = '金额必须大于 0';
    if (!formData.purchase_date) next.purchase_date = '请选择采购日期';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const { error } = await createSuppliesCost(formData);
      if (error) throw error;
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
      <div className={layout.container + ' max-w-3xl'}>
        <div className={layout.section}>
          <button onClick={() => router.back()} className={button.ghost + ' mb-4 inline-flex items-center gap-2'}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>
          <h1 className={heading.h1}>新增耗材记录</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">记录包装、运输与标签等采购成本。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-5 flex items-center gap-2'}>
              <span className="h-6 w-1 rounded-full bg-[var(--color-primary)]" />
              耗材信息
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">耗材分类 <span className="text-[var(--color-danger)]">*</span></label>
                <select name="category" value={formData.category} onChange={handleInputChange} className={field}>
                  {CATEGORY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.category}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">采购日期 <span className="text-[var(--color-danger)]">*</span></label>
                <DatePicker
                  selected={formData.purchase_date ? parseDateFromLocal(formData.purchase_date) : null}
                  onChange={date => setFormData(prev => ({ ...prev, purchase_date: date ? formatDateToLocal(date) : '' }))}
                  className={field}
                />
                {errors.purchase_date && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.purchase_date}</p>}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">金额 <span className="text-[var(--color-danger)]">*</span></label>
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

          {errors.submit && (
            <div className="rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-[var(--color-danger)]">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className={button.primary + ' flex-1'}>
              {isSubmitting ? '保存中...' : '保存耗材记录'}
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
