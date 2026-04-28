// app/coupons/add/page.tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { DiscountType } from '@/types/database.types';
import { layout, heading, card, button, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { processImageForUpload, isValidImageFile } from '@/lib/image-utils';

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
      setOcrError('画像ファイルを選択してください');
      return;
    }

    setIsRecognizing(true);
    setOcrError(null);

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

      if (!res.ok) throw new Error('認識に失敗しました');
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
      setOcrError(err.message || '認識に失敗しました');
    } finally {
      setIsRecognizing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'クーポン名を入力してください';
    }

    if (formData.discount_type !== 'free_item' && formData.discount_value <= 0) {
      newErrors.discount_value = '割引値は0より大きい値を入力してください';
    }

    if (formData.discount_type === 'percentage' && formData.discount_value > 100) {
      newErrors.discount_value = '割引率は100%を超えることはできません';
    }

    if (!formData.expiry_date) {
      newErrors.expiry_date = '有効期限を選択してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('coupons').insert([
        {
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
        },
      ]);

      if (error) throw error;

      router.push('/coupons');
    } catch (error: any) {
      console.error('保存失敗:', error);
      setErrors({ submit: error.message || '保存に失敗しました' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-apple-bg dark:bg-apple-bgDark">
      <div className="relative max-w-2xl mx-auto px-4 py-8">
        {/* 標題区域 */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-apple-gray-1 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">戻る</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">クーポン追加</h1>
              <p className="text-apple-gray-1">
                {ocrError
                  ? <span className="text-apple-red dark:text-red-400 text-sm">{ocrError}</span>
                  : '新しいクーポン・キャンペーンを記録'}
              </p>
            </div>
            {/* OCR 相机按钮 */}
            <div className="mt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRecognizing}
                className="p-2 rounded-xl text-apple-gray-1 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="写真から自動入力"
              >
                {isRecognizing ? (
                  <svg className="animate-spin w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageCapture}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="bg-white dark:bg-apple-cardDark rounded-xl p-6 shadow-card">
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-apple-blue rounded-full"></div>
                基本情報
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  クーポン名 <span className="text-red-300">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="例: 楽天スーパーSALE 10%OFFクーポン"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all"
                  required
                />
                {errors.name && <p className="mt-1 text-sm text-red-300">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  プラットフォーム
                </label>
                <input
                  type="text"
                  name="platform"
                  value={formData.platform}
                  onChange={handleInputChange}
                  placeholder="例: 楽天市場, Amazon, Yahoo!"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    割引タイプ <span className="text-red-300">*</span>
                  </label>
                  <select
                    name="discount_type"
                    value={formData.discount_type}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all"
                  >
                    <option value="percentage">割引率 (%)</option>
                    <option value="fixed_amount">固定額 (¥)</option>
                    <option value="point_multiply">ポイント倍率</option>
                    <option value="free_item">無料引換</option>
                  </select>
                </div>

                {formData.discount_type !== 'free_item' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    割引値 <span className="text-red-300">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="discount_value"
                      value={formData.discount_value || ''}
                      onChange={handleNumberChange}
                      step="0.01"
                      min="0"
                      placeholder="0"
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-apple-gray-1">
                      {formData.discount_type === 'percentage' ? '%' : formData.discount_type === 'point_multiply' ? '倍' : '¥'}
                    </span>
                  </div>
                  {errors.discount_value && (
                    <p className="mt-1 text-sm text-red-300">{errors.discount_value}</p>
                  )}
                </div>
                )}
              </div>

              {formData.discount_type === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    最大割引額
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="max_discount_amount"
                      value={formData.max_discount_amount || ''}
                      onChange={handleNumberChange}
                      step="0.01"
                      min="0"
                      placeholder="上限なしの場合は0"
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-apple-gray-1">¥</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    最低購入金額
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="min_purchase_amount"
                      value={formData.min_purchase_amount || ''}
                      onChange={handleNumberChange}
                      step="0.01"
                      min="0"
                      placeholder="0"
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-apple-gray-1">¥</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    クーポンコード
                  </label>
                  <input
                    type="text"
                    name="coupon_code"
                    value={formData.coupon_code}
                    onChange={handleInputChange}
                    placeholder="例: RAKUTEN500"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    開始日
                  </label>
                  <DatePicker
                    selected={formData.start_date ? parseDateFromLocal(formData.start_date) : null}
                    onChange={(date) => {
                      setFormData((prev) => ({
                        ...prev,
                        start_date: formatDateToLocal(date)
                      }));
                    }}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    有効期限 <span className="text-red-300">*</span>
                  </label>
                  <DatePicker
                    selected={formData.expiry_date ? parseDateFromLocal(formData.expiry_date) : null}
                    onChange={(date) => {
                      setFormData((prev) => ({
                        ...prev,
                        expiry_date: formatDateToLocal(date)
                      }));
                    }}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all"
                  />
                  {errors.expiry_date && (
                    <p className="mt-1 text-sm text-red-300">{errors.expiry_date}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  メモ
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="メモを追加..."
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-apple-separator dark:border-apple-sepDark rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* 送信ボタン */}
          {errors.submit && (
            <div className="p-4 bg-apple-red/10 border border-apple-red/30 rounded-xl">
              <p className="text-sm text-red-300">{errors.submit}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-4 bg-apple-blue active:opacity-70 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-8 py-4 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-xl transition-all border border-apple-separator dark:border-apple-sepDark"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
