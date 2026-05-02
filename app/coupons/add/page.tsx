'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { DiscountType } from '@/types/database.types';
import { button, card, heading, input, layout } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { isValidImageFile, processImageForUpload } from '@/lib/image-utils';

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

export default function AddCouponPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
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

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
      setErrors(prev => ({ ...prev, submit: '请选择有效的图片文件' }));
      return;
    }

    setIsRecognizing(true);
    try {
      const compressed = await processImageForUpload(file, 1200, 1200, 0.85);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
      });

      const res = await fetch('/api/ocr/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
      });

      if (!res.ok) throw new Error('识别失败');
      const data = await res.json();

      setFormData(prev => ({
        ...prev,
        name: data.name || prev.name,
        discount_type: (['percentage', 'fixed_amount', 'point_multiply', 'free_item'].includes(data.discount_type) ? data.discount_type : prev.discount_type) as DiscountType,
        discount_value: typeof data.discount_value === 'number' ? data.discount_value : prev.discount_value,
        expiry_date: data.expiry_date || prev.expiry_date,
        start_date: data.start_date || prev.start_date,
        platform: data.platform || prev.platform,
        coupon_code: data.coupon_code || prev.coupon_code,
        min_purchase_amount: typeof data.min_purchase_amount === 'number' ? data.min_purchase_amount : prev.min_purchase_amount,
        max_discount_amount: typeof data.max_discount_amount === 'number' ? data.max_discount_amount : prev.max_discount_amount,
        notes: data.notes || prev.notes,
      }));
    } catch (err: any) {
      setErrors(prev => ({ ...prev, submit: err?.message || '识别失败' }));
    } finally {
      setIsRecognizing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
      const { error } = await supabase.from('coupons').insert([{
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
        is_used: false,
      }]);

      if (error) throw error;
      router.push('/coupons');
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

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className={heading.h1}>新增优惠券</h1>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">记录新的券码、有效期和折扣信息。</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRecognizing}
              className={button.secondary + ' gap-2'}
              title="从图片自动识别"
            >
              {isRecognizing ? '识别中...' : '图片识别'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageCapture} className="hidden" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-5 flex items-center gap-2'}>
              <span className="h-6 w-1 rounded-full bg-[var(--color-primary)]" />
              基本信息
            </h2>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">优惠券名称 <span className="text-[var(--color-danger)]">*</span></label>
                <input name="name" value={formData.name} onChange={handleInputChange} className={field} placeholder="例如：楽天超级SALE 10%OFF" />
                {errors.name && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.name}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">平台</label>
                <input name="platform" value={formData.platform} onChange={handleInputChange} className={field} placeholder="例如：楽天市场、Amazon、Yahoo!" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">折扣类型 <span className="text-[var(--color-danger)]">*</span></label>
                  <select name="discount_type" value={formData.discount_type} onChange={handleInputChange} className={field}>
                    <option value="percentage">折扣率 (%)</option>
                    <option value="fixed_amount">固定金额 (¥)</option>
                    <option value="point_multiply">积分倍率</option>
                    <option value="free_item">免费兑换</option>
                  </select>
                </div>

                {formData.discount_type !== 'free_item' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">折扣值 <span className="text-[var(--color-danger)]">*</span></label>
                    <div className="relative">
                      <input type="number" name="discount_value" value={formData.discount_value || ''} onChange={handleNumberChange} className={field + ' pr-12'} min="0" step="0.01" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                        {formData.discount_type === 'percentage' ? '%' : formData.discount_type === 'point_multiply' ? '倍' : '¥'}
                      </span>
                    </div>
                    {errors.discount_value && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.discount_value}</p>}
                  </div>
                )}
              </div>

              {formData.discount_type === 'percentage' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">最高折扣金额</label>
                  <div className="relative">
                    <input type="number" name="max_discount_amount" value={formData.max_discount_amount || ''} onChange={handleNumberChange} className={field + ' pr-12'} min="0" step="0.01" placeholder="不限则填 0" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">¥</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">最低购买金额</label>
                  <div className="relative">
                    <input type="number" name="min_purchase_amount" value={formData.min_purchase_amount || ''} onChange={handleNumberChange} className={field + ' pr-12'} min="0" step="0.01" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">¥</span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">券码</label>
                  <input name="coupon_code" value={formData.coupon_code} onChange={handleInputChange} className={field} placeholder="例如：RAKUTEN500" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">开始日期</label>
                  <DatePicker selected={formData.start_date ? parseDateFromLocal(formData.start_date) : null} onChange={date => setFormData(prev => ({ ...prev, start_date: date ? formatDateToLocal(date) : '' }))} className={field} />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">有效期 <span className="text-[var(--color-danger)]">*</span></label>
                  <DatePicker selected={formData.expiry_date ? parseDateFromLocal(formData.expiry_date) : null} onChange={date => setFormData(prev => ({ ...prev, expiry_date: date ? formatDateToLocal(date) : '' }))} className={field} />
                  {errors.expiry_date && <p className="mt-1 text-sm text-[var(--color-danger)]">{errors.expiry_date}</p>}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">备注</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className={field + ' resize-none'} placeholder="补充说明..." />
              </div>
            </div>
          </section>

          {errors.submit && (
            <div className="rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-[var(--color-danger)]">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className={button.primary + ' flex-1'}>
              {isSubmitting ? '保存中...' : '保存优惠券'}
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
