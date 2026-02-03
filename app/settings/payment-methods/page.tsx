// app/settings/payment-methods/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethod } from '@/types/database.types';
import Link from 'next/link';
import { layout, heading, card, button, badge } from '@/lib/theme';

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('type')
        .order('name');

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('加载支付方式失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentSameMonth = async (id: string, paymentSameMonth: boolean) => {
    setSaving(id);
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ payment_same_month: paymentSameMonth })
        .eq('id', id);

      if (error) throw error;

      // 更新本地状态
      setPaymentMethods(methods =>
        methods.map(m => m.id === id ? { ...m, payment_same_month: paymentSameMonth } : m)
      );
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请重试');
    } finally {
      setSaving(null);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      // 更新本地状态
      setPaymentMethods(methods =>
        methods.map(m => m.id === id ? { ...m, is_active: !isActive } : m)
      );
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请重试');
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'card': return '信用卡';
      case 'bank': return '银行账户';
      case 'wallet': return '电子钱包';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-900 dark:text-white">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xl">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="relative max-w-6xl mx-auto px-4 py-8">
        {/* 标题区域 */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回仪表盘</span>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">支付方式管理</h1>
              <p className="text-gray-600 dark:text-gray-400">配置信用卡还款周期和其他设置</p>
            </div>
            <Link
              href="/settings/payment-methods/add"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加支付方式
            </Link>
          </div>
        </div>

        {/* 信用卡列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              信用卡配置
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    名称
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    类型
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    账单日
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    还款日
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    还款周期
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    返点率
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paymentMethods.filter(pm => pm.type === 'card').map((method) => (
                  <tr key={method.id} className="hover:bg-gray-100 dark:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                      {method.name}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {getTypeLabel(method.type)}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">
                      {method.closing_day ? `${method.closing_day}日` : '-'}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">
                      {method.payment_day ? `${method.payment_day}日` : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <select
                        value={method.payment_same_month ? 'same' : 'next'}
                        onChange={(e) => updatePaymentSameMonth(method.id, e.target.value === 'same')}
                        disabled={saving === method.id || !method.closing_day || !method.payment_day}
                        className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="next">次月还款</option>
                        <option value="same">当月还款</option>
                      </select>
                      {saving === method.id && (
                        <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">保存中...</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-emerald-600 dark:text-emerald-300 font-medium">
                        {(method.point_rate * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleActive(method.id, method.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          method.is_active
                            ? 'bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40'
                            : 'bg-slate-700/50 text-gray-700 dark:text-gray-400 border border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        {method.is_active ? '启用' : '禁用'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link
                        href={`/settings/payment-methods/${method.id}/edit`}
                        className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      >
                        编辑
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 说明卡片 */}
        <div className="mt-6 bg-indigo-500/10 backdrop-blur-xl rounded-xl p-6 border border-indigo-500/30">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            还款周期说明
          </h3>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <span className="font-medium text-gray-900 dark:text-white">次月还款：</span>
              还款日在账单日的下个月（大部分信用卡的模式）
              <div className="ml-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                示例：账单日 25日，还款日 15日 → 1月10日消费，2月15日还款
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-900 dark:text-white">当月还款：</span>
              还款日在账单日的当月（部分储蓄卡联名卡或特殊信用卡）
              <div className="ml-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                示例：账单日 15日，还款日 28日 → 1月10日消费，1月28日还款
              </div>
            </div>
          </div>
        </div>

        {/* 其他支付方式 */}
        {paymentMethods.filter(pm => pm.type !== 'card').length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
                其他支付方式
              </h2>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paymentMethods.filter(pm => pm.type !== 'card').map((method) => (
                  <div key={method.id} className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 border border-gray-300 dark:border-gray-600/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-gray-900 dark:text-white font-medium">{method.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{getTypeLabel(method.type)}</div>
                      </div>
                      <button
                        onClick={() => toggleActive(method.id, method.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          method.is_active
                            ? 'bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-700/50 text-gray-700 dark:text-gray-400 border border-slate-600'
                        }`}
                      >
                        {method.is_active ? '启用' : '禁用'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
