// app/settings/payment-methods/[id]/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethod, PointsPlatform } from '@/types/database.types';
import Link from 'next/link';
import { layout, heading, card, button, input } from '@/lib/theme';

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
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('id', id)
        .single();

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

    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({
          name: formData.name,
          closing_day: formData.closing_day ? parseInt(formData.closing_day) : null,
          payment_day: formData.payment_day ? parseInt(formData.payment_day) : null,
          payment_same_month: formData.payment_same_month,
          point_rate: parseFloat(formData.point_rate) / 100,
          card_points_platform_id: formData.card_points_platform_id || null,
          is_active: formData.is_active,
        })
        .eq('id', id);

      if (error) throw error;

      router.push('/settings/payment-methods');
    } catch (error: any) {
      console.error('保存失败:', error);
      setErrors({ submit: error.message || '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/settings/payment-methods"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">编辑支付方式</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        账单日
                      </label>
                      <input
                        type="number"
                        value={formData.closing_day}
                        onChange={(e) => setFormData({ ...formData, closing_day: e.target.value })}
                        min="1"
                        max="31"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="1-31"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        还款日
                      </label>
                      <input
                        type="number"
                        value={formData.payment_day}
                        onChange={(e) => setFormData({ ...formData, payment_day: e.target.value })}
                        min="1"
                        max="31"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="1-31"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      还款周期
                    </label>
                    <select
                      value={formData.payment_same_month ? 'same' : 'next'}
                      onChange={(e) => setFormData({ ...formData, payment_same_month: e.target.value === 'same' })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="next">次月还款</option>
                      <option value="same">当月还款</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      返点率 (%)
                    </label>
                    <input
                      type="number"
                      value={formData.point_rate}
                      onChange={(e) => setFormData({ ...formData, point_rate: e.target.value })}
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="1.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      信用卡积分平台
                    </label>
                    <select
                      value={formData.card_points_platform_id}
                      onChange={(e) => setFormData({ ...formData, card_points_platform_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="">未设置</option>
                      {pointsPlatforms.map((p) => (
                        <option key={p.id} value={p.id}>{p.display_name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      新建交易时自动关联此积分平台
                    </p>
                  </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-teal-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-teal-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  启用此支付方式
                </label>
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-300">{errors.submit}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
