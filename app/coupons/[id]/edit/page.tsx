'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { DiscountType } from '@/types/database.types';
import DatePicker from '@/components/DatePicker';
import { button, card, heading, input, layout } from '@/lib/theme';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';

interface CouponFormData {
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase_amount: number;
  start_date: string;
  expiry_date: string;
  platform: string;
  coupon_code: string;
  max_discount_amount: number;
  notes: string;
}

export default function EditCouponPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [formData, setFormData] = useState<CouponFormData>({
    name: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_purchase_amount: 0,
    start_date: '',
    expiry_date: '',
    platform: '',
    coupon_code: '',
    max_discount_amount: 0,
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { loadCoupon(); }, [id]);

  const loadCoupon = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('coupons').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) {
        setFormData({
          name: data.name,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          min_purchase_amount: data.min_purchase_amount,
          start_date: data.start_date || '',
          expiry_date: data.expiry_date,
          platform: data.platform || '',
          coupon_code: data.coupon_code || '',
          max_discount_amount: data.max_discount_amount || 0,
          notes: data.notes || '',
        });
      }
    } catch (error) {
      alert('加载失败，请重试');
      router.push('/coupons');
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
    if (!formData.name.trim()) next.name = '请输入优惠券名称';
    if (formData.discount_type !== 'free_item' && formData.discount_value <= 0) next.discount_value = '请输入大于 0 的数值';
    if (formData.discount_type === 'percentage' && formData.discount_value > 100) next.discount_value = '折扣率不能超过 100%';
    if (!formData.expiry_date) next.expiry_date = '请选择有效期';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('coupons').update({
        name: formData.name,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        min_purchase_amount: formData.min_purchase_amount,
        start_date: formData.start_date || null,
        expiry_date: formData.expiry_date,
        platform: formData.platform || null,
        coupon_code: formData.coupon_code || null,
        max_discount_amount: formData.max_discount_amount,
        notes: formData.notes || null,
      }).eq('id', id);
      if (error) throw error;
      router.push('/coupons');
    } catch (error: any) {
      setErrors({ submit: error.message || '保存失败，请重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = input.base + ' w-full';

  if (loading) {
    return <div className={layout.page + ' flex min-h-screen items-center justify-center text-[var(--color-text-muted)]'}>加载中...</div>;
  }

  return (
    <div className={layout.page}>
      <div className={layout.container + ' max-w-3xl'}>
        <div className={layout.section}>
          <button onClick={() => router.back()} className={button.ghost + ' mb-4 inline-flex items-center gap-2'}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            返回
          </button>
          <h1 className={heading.h1}>编辑优惠券</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">修改优惠券、券码与有效期信息。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-5 flex items-center gap-2'}>
              <span className="h-6 w-1 rounded-full bg-[var(--color-primary)]" />
              基本信息
            </h2>

            <div className="space-y-5">
              <div>
                <label className="sn-form-label">优惠券名称 <span className="text-[var(--color-danger)]">*</span></label>
                <input name="name" value={formData.name} onChange={handleInputChange} className={field} placeholder="例如：楽天超级SALE 10%OFF" />
                {errors.name && <p className="sn-form-error">{errors.name}</p>}
              </div>

              <div>
                <label className="sn-form-label">平台</label>
                <input name="platform" value={formData.platform} onChange={handleInputChange} className={field} placeholder="例如：楽天市场、Amazon、Yahoo!" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="sn-form-label">折扣类型 <span className="text-[var(--color-danger)]">*</span></label>
                  <select name="discount_type" value={formData.discount_type} onChange={handleInputChange} className={field}>
                    <option value="percentage">折扣率 (%)</option>
                    <option value="fixed_amount">固定金额 (¥)</option>
                    <option value="point_multiply">积分倍率</option>
                    <option value="free_item">免费兑换</option>
                  </select>
                </div>
                {formData.discount_type !== 'free_item' && (
                  <div>
                    <label className="sn-form-label">折扣值 <span className="text-[var(--color-danger)]">*</span></label>
                    <div className="relative">
                      <input type="number" name="discount_value" value={formData.discount_value || ''} onChange={handleNumberChange} className={field + ' pr-12'} min="0" step="0.01" />
                      <span className="sn-form-addon">{formData.discount_type === 'percentage' ? '%' : formData.discount_type === 'point_multiply' ? '倍' : '¥'}</span>
                    </div>
                    {errors.discount_value && <p className="sn-form-error">{errors.discount_value}</p>}
                  </div>
                )}
              </div>

              {formData.discount_type === 'percentage' && (
                <div>
                  <label className="sn-form-label">最高折扣金额</label>
                  <div className="relative">
                    <input type="number" name="max_discount_amount" value={formData.max_discount_amount || ''} onChange={handleNumberChange} className={field + ' pr-12'} min="0" step="0.01" placeholder="不限则填 0" />
                    <span className="sn-form-addon">¥</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="sn-form-label">最低购买金额</label>
                  <div className="relative">
                    <input type="number" name="min_purchase_amount" value={formData.min_purchase_amount || ''} onChange={handleNumberChange} className={field + ' pr-12'} min="0" step="0.01" placeholder="0" />
                    <span className="sn-form-addon">¥</span>
                  </div>
                </div>
                <div>
                  <label className="sn-form-label">券码</label>
                  <input name="coupon_code" value={formData.coupon_code} onChange={handleInputChange} className={field} placeholder="例如：RAKUTEN500" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="sn-form-label">开始日期</label>
                  <DatePicker selected={formData.start_date ? parseDateFromLocal(formData.start_date) : null} onChange={date => setFormData(prev => ({ ...prev, start_date: date ? formatDateToLocal(date) : '' }))} className={field} />
                </div>
                <div>
                  <label className="sn-form-label">有效期 <span className="text-[var(--color-danger)]">*</span></label>
                  <DatePicker selected={formData.expiry_date ? parseDateFromLocal(formData.expiry_date) : null} onChange={date => setFormData(prev => ({ ...prev, expiry_date: date ? formatDateToLocal(date) : '' }))} className={field} />
                  {errors.expiry_date && <p className="sn-form-error">{errors.expiry_date}</p>}
                </div>
              </div>

              <div>
                <label className="sn-form-label">备注</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className={field + ' resize-none'} placeholder="补充说明..." />
              </div>
            </div>
          </section>

          {errors.submit && <div className="sn-form-alert-error">{errors.submit}</div>}

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className={button.primary + ' flex-1'}>{isSubmitting ? '保存中...' : '保存更改'}</button>
            <button type="button" onClick={() => router.back()} className={button.secondary}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}
