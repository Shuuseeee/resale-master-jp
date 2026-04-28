// app/settings/payment-methods/add/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { PointsPlatform } from '@/types/database.types';
import Link from 'next/link';
import { layout, heading, card, button, input } from '@/lib/theme';

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
      const { error } = await supabase
        .from('payment_methods')
        .insert([{
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
      console.error('保存失败:', error);
      setErrors({ submit: error.message || '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-apple-bg dark:bg-apple-bgDark">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/settings/payment-methods"
          className="inline-flex items-center gap-2 text-apple-gray-1 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">添加支付方式</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-apple-separator dark:border-apple-sepDark p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  名称 <span className="text-apple-red">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-apple-gray-6 dark:bg-white/8 shadow-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent"
                  required
                  placeholder="例如：楽天カード"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        账单日
                      </label>
                      <input
                        type="number"
                        value={formData.closing_day}
                        onChange={(e) => setFormData({ ...formData, closing_day: e.target.value })}
                        min="1"
                        max="31"
                        className="w-full px-4 py-2 rounded-lg bg-apple-gray-6 dark:bg-white/8 shadow-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent"
                        placeholder="1-31"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        还款日
                      </label>
                      <input
                        type="number"
                        value={formData.payment_day}
                        onChange={(e) => setFormData({ ...formData, payment_day: e.target.value })}
                        min="1"
                        max="31"
                        className="w-full px-4 py-2 rounded-lg bg-apple-gray-6 dark:bg-white/8 shadow-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent"
                        placeholder="1-31"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      还款周期
                    </label>
                    <select
                      value={formData.payment_same_month ? 'same' : 'next'}
                      onChange={(e) => setFormData({ ...formData, payment_same_month: e.target.value === 'same' })}
                      className="w-full px-4 py-2 rounded-lg bg-apple-gray-6 dark:bg-white/8 shadow-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent"
                    >
                      <option value="next">次月还款</option>
                      <option value="same">当月还款</option>
                    </select>
                    <p className="mt-1 text-xs text-apple-gray-1">
                      次月还款：还款日在账单日的下个月（大部分信用卡）<br/>
                      当月还款：还款日在账单日的当月（部分储蓄卡联名卡）
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      返点率 (%)
                    </label>
                    <input
                      type="number"
                      value={formData.point_rate}
                      onChange={(e) => setFormData({ ...formData, point_rate: e.target.value })}
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2 rounded-lg bg-apple-gray-6 dark:bg-white/8 shadow-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent"
                      placeholder="1.0"
                    />
                    <p className="mt-1 text-xs text-apple-gray-1">
                      例如：1% 返点率输入 1.0
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      信用卡积分平台
                    </label>
                    <select
                      value={formData.card_points_platform_id}
                      onChange={(e) => setFormData({ ...formData, card_points_platform_id: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-apple-gray-6 dark:bg-white/8 shadow-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent"
                    >
                      <option value="">未设置</option>
                      {pointsPlatforms.map((p) => (
                        <option key={p.id} value={p.id}>{p.display_name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-apple-gray-1">
                      新建交易时自动关联此积分平台
                    </p>
                  </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-apple-blue bg-gray-100 dark:bg-gray-700 border-apple-separator dark:border-apple-sepDark rounded focus:ring-apple-blue/30"
                />
                <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                  启用此支付方式
                </label>
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className="p-4 bg-apple-red/5 dark:bg-apple-red/10 border border-apple-red/30 rounded-lg">
              <p className="text-sm text-apple-red">{errors.submit}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-apple-blue active:opacity-70 disabled:opacity-40 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-apple-gray-5 dark:bg-white/10 text-gray-900 dark:text-white font-medium rounded-lg active:opacity-80 transition-opacity"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
