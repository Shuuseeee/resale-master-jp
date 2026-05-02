'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
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

export default function EditSupplyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [formData, setFormData] = useState<SuppliesCostFormData>({
    category: '包装材料',
    amount: 0,
    purchase_date: getTodayString(),
    description: '',
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { fetchSupply(); }, [id]);

  const fetchSupply = async () => {
    try {
      const { data, error } = await supabase.from('supplies_costs').select('*').eq('id', id).single();
      if (error) throw error;
      setFormData({
        category: data.category,
        amount: data.amount,
        purchase_date: data.purchase_date,
        description: data.description || '',
        notes: data.notes || '',
      });
    } catch (error: any) {
      setErrors({ fetch: error.message || '加载失败' });
    } finally {
      setLoading(false);
    }
  };

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
    setSaving(true);
    try {
      const { error } = await supabase.from('supplies_costs').update({
        category: formData.category,
        amount: formData.amount,
        purchase_date: formData.purchase_date,
        description: formData.description || null,
        notes: formData.notes || null,
      }).eq('id', id);
      if (error) throw error;
      router.push('/supplies');
    } catch (error: any) {
      setErrors({ submit: error.message || '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这条耗材记录吗？此操作不可恢复。')) return;
    try {
      const { error } = await supabase.from('supplies_costs').delete().eq('id', id);
      if (error) throw error;
      router.push('/supplies');
    } catch (error: any) {
      setErrors({ submit: error.message || '删除失败，请重试' });
    }
  };

  const field = input.base + ' w-full';

  if (loading) {
    return <div className={layout.page + ' flex min-h-screen items-center justify-center text-[var(--color-text-muted)]'}>加载中...</div>;
  }

  if (errors.fetch) {
    return (
      <div className={layout.page}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-[var(--color-danger)]">{errors.fetch}</p>
            <button onClick={() => router.back()} className={button.primary + ' mt-4'}>返回</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={layout.page}>
      <div className={layout.container + ' max-w-3xl'}>
        <div className={layout.section}>
          <button onClick={() => router.back()} className={button.ghost + ' mb-4 inline-flex items-center gap-2'}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            返回
          </button>
          <h1 className={heading.h1}>编辑耗材记录</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">修改耗材采购信息。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-5 flex items-center gap-2'}>
              <span className="h-6 w-1 rounded-full bg-[var(--color-primary)]" />
              耗材信息
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="sn-form-label">耗材分类 <span className="text-[var(--color-danger)]">*</span></label>
                <select name="category" value={formData.category} onChange={handleInputChange} className={field}>
                  {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {errors.category && <p className="sn-form-error">{errors.category}</p>}
              </div>

              <div>
                <label className="sn-form-label">采购日期 <span className="text-[var(--color-danger)]">*</span></label>
                <DatePicker selected={formData.purchase_date ? parseDateFromLocal(formData.purchase_date) : null} onChange={date => setFormData(prev => ({ ...prev, purchase_date: date ? formatDateToLocal(date) : '' }))} className={field} />
                {errors.purchase_date && <p className="sn-form-error">{errors.purchase_date}</p>}
              </div>
            </div>

            <div className="mt-4">
              <label className="sn-form-label">金额 <span className="text-[var(--color-danger)]">*</span></label>
              <div className="relative">
                <input type="number" name="amount" value={formData.amount || ''} onChange={handleNumberChange} className={field + ' pr-12'} min="0" step="0.01" />
                <span className="sn-form-addon">¥</span>
              </div>
              {errors.amount && <p className="sn-form-error">{errors.amount}</p>}
            </div>

            <div className="mt-4">
              <label className="sn-form-label">描述</label>
              <input name="description" value={formData.description} onChange={handleInputChange} className={field} placeholder="例如：A4 气泡袋 100 个" />
            </div>

            <div className="mt-4">
              <label className="sn-form-label">备注</label>
              <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className={field + ' resize-none'} placeholder="补充说明..." />
            </div>
          </section>

          {errors.submit && <div className="sn-form-alert-error">{errors.submit}</div>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className={button.primary + ' flex-1'}>{saving ? '更新中...' : '更新耗材记录'}</button>
            <button type="button" onClick={() => router.back()} className={button.secondary}>取消</button>
            <button type="button" onClick={handleDelete} className={button.danger}>删除</button>
          </div>
        </form>
      </div>
    </div>
  );
}
