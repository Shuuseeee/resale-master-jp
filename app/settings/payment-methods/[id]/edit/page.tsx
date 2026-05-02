'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { PointsPlatform } from '@/types/database.types';
import { button, card, heading, input, layout } from '@/lib/theme';

export default function EditPaymentMethodPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [formData, setFormData] = useState({
    name: '',
    closing_day: '',
    payment_day: '',
    payment_same_month: false,
    point_rate: '',
    card_points_platform_id: '',
    is_active: true,
  });
  const [pointsPlatforms, setPointsPlatforms] = useState<PointsPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPaymentMethod();
    supabase.from('points_platforms').select('*').eq('is_active', true).order('display_name')
      .then(({ data }) => setPointsPlatforms(data || []));
  }, [id]);

  const loadPaymentMethod = async () => {
    try {
      const { data, error } = await supabase.from('payment_methods').select('*').eq('id', id).single();
      if (error) throw error;
      setFormData({
        name: data.name,
        closing_day: data.closing_day?.toString() || '',
        payment_day: data.payment_day?.toString() || '',
        payment_same_month: data.payment_same_month || false,
        point_rate: (data.point_rate * 100).toString(),
        card_points_platform_id: data.card_points_platform_id || '',
        is_active: data.is_active,
      });
    } catch (error) {
      console.error('加载失败:', error);
      alert('加载失败，请重试');
      router.push('/settings/payment-methods');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { error } = await supabase.from('payment_methods').update({
        name: formData.name,
        closing_day: formData.closing_day ? parseInt(formData.closing_day) : null,
        payment_day: formData.payment_day ? parseInt(formData.payment_day) : null,
        payment_same_month: formData.payment_same_month,
        point_rate: parseFloat(formData.point_rate) / 100,
        card_points_platform_id: formData.card_points_platform_id || null,
        is_active: formData.is_active,
      }).eq('id', id);
      if (error) throw error;
      router.push('/settings/payment-methods');
    } catch (error: any) {
      setErrors({ submit: error.message || '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const field = input.base + ' w-full';

  if (loading) {
    return (
      <div className={layout.page}>
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--color-text-muted)]">加载中...</div>
      </div>
    );
  }

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
          <h1 className={heading.h1}>编辑支付方式</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">更新信用卡账单日、还款日与返点率。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-5 flex items-center gap-2'}>
              <span className="h-6 w-1 rounded-full bg-[var(--color-primary)]" />
              支付方式信息
            </h2>

            <div className="space-y-5">
              <div>
                <label className="sn-form-label">名称 <span className="text-[var(--color-danger)]">*</span></label>
                <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={field} required />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="sn-form-label">账单日</label>
                  <input type="number" value={formData.closing_day} onChange={e => setFormData({ ...formData, closing_day: e.target.value })} min="1" max="31" className={field} placeholder="1-31" />
                </div>
                <div>
                  <label className="sn-form-label">还款日</label>
                  <input type="number" value={formData.payment_day} onChange={e => setFormData({ ...formData, payment_day: e.target.value })} min="1" max="31" className={field} placeholder="1-31" />
                </div>
              </div>

              <div>
                <label className="sn-form-label">还款周期</label>
                <select value={formData.payment_same_month ? 'same' : 'next'} onChange={e => setFormData({ ...formData, payment_same_month: e.target.value === 'same' })} className={field}>
                  <option value="next">次月还款</option>
                  <option value="same">当月还款</option>
                </select>
              </div>

              <div>
                <label className="sn-form-label">返点率 (%)</label>
                <input type="number" value={formData.point_rate} onChange={e => setFormData({ ...formData, point_rate: e.target.value })} step="0.01" min="0" className={field} />
              </div>

              <div>
                <label className="sn-form-label">信用卡积分平台</label>
                <select value={formData.card_points_platform_id} onChange={e => setFormData({ ...formData, card_points_platform_id: e.target.value })} className={field}>
                  <option value="">未设置</option>
                  {pointsPlatforms.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                </select>
                <p className="sn-form-muted">新建交易时自动关联此积分平台。</p>
              </div>

              <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3">
                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                <span className="text-sm font-medium text-[var(--color-text)]">启用此支付方式</span>
              </label>
            </div>
          </section>

          {errors.submit && <div className="sn-form-alert-error">{errors.submit}</div>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className={button.primary + ' flex-1'}>
              {saving ? '保存中...' : '保存更改'}
            </button>
            <button type="button" onClick={() => router.back()} className={button.secondary}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}
