'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { PointsPlatform } from '@/types/database.types';
import { button, card, heading, input, layout } from '@/lib/theme';

export default function AddPaymentMethodPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    closing_day: '',
    payment_day: '',
    payment_same_month: false,
    point_rate: '1.0',
    card_points_platform_id: '',
    is_active: true,
  });
  const [pointsPlatforms, setPointsPlatforms] = useState<PointsPlatform[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('points_platforms').select('*').eq('is_active', true).order('display_name')
      .then(({ data }) => setPointsPlatforms(data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const { error } = await supabase.from('payment_methods').insert([{
        name: formData.name,
        type: 'card',
        closing_day: formData.closing_day ? parseInt(formData.closing_day) : null,
        payment_day: formData.payment_day ? parseInt(formData.payment_day) : null,
        payment_same_month: formData.payment_same_month,
        point_rate: parseFloat(formData.point_rate) / 100,
        card_points_platform_id: formData.card_points_platform_id || null,
        is_active: formData.is_active,
      }]);

      if (error) throw error;
      router.push('/settings/payment-methods');
    } catch (error: any) {
      setErrors({ submit: error.message || '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const field = input.base + ' w-full';

  return (
    <div className={layout.page}>
      <div className={layout.container + ' max-w-3xl'}>
        <div className={layout.section}>
          <Link href="/settings/payment-methods" className={button.ghost + ' mb-4 inline-flex items-center gap-2'}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </Link>
          <h1 className={heading.h1}>新增支付方式</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">配置信用卡账单日、还款日与返点率。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-5 flex items-center gap-2'}>
              <span className="h-6 w-1 rounded-full bg-[var(--color-primary)]" />
              支付方式信息
            </h2>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">名称 <span className="text-[var(--color-danger)]">*</span></label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={field} placeholder="例如：楽天カード" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">账单日</label>
                  <input type="number" value={formData.closing_day} onChange={e => setFormData({ ...formData, closing_day: e.target.value })} min="1" max="31" className={field} placeholder="1-31" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">还款日</label>
                  <input type="number" value={formData.payment_day} onChange={e => setFormData({ ...formData, payment_day: e.target.value })} min="1" max="31" className={field} placeholder="1-31" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">还款周期</label>
                <select value={formData.payment_same_month ? 'same' : 'next'} onChange={e => setFormData({ ...formData, payment_same_month: e.target.value === 'same' })} className={field}>
                  <option value="next">次月还款</option>
                  <option value="same">当月还款</option>
                </select>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">次月还款是大部分信用卡模式，当月还款适用于部分特殊卡种。</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">返点率 (%)</label>
                <input type="number" value={formData.point_rate} onChange={e => setFormData({ ...formData, point_rate: e.target.value })} step="0.01" min="0" className={field} placeholder="1.0" />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">例如 1% 返点率请填写 1.0</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">信用卡积分平台</label>
                <select value={formData.card_points_platform_id} onChange={e => setFormData({ ...formData, card_points_platform_id: e.target.value })} className={field}>
                  <option value="">未设置</option>
                  {pointsPlatforms.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">新建交易时会自动关联该积分平台。</p>
              </div>

              <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span className="text-sm font-medium text-[var(--color-text)]">启用此支付方式</span>
              </label>
            </div>
          </section>

          {errors.submit && (
            <div className="rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-[var(--color-danger)]">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className={button.primary + ' flex-1'}>
              {saving ? '保存中...' : '保存支付方式'}
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
