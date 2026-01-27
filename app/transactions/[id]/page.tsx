// app/transactions/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Transaction, PaymentMethod, PointsPlatform } from '@/types/database.types';
import { formatCurrency, formatROI, daysUntil, calculatePaymentDate } from '@/lib/financial/calculator';
import Image from 'next/image';
import Link from 'next/link';
import { layout, heading, card, button, badge, input } from '@/lib/theme';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  platform_points_platform?: PointsPlatform;
  card_points_platform?: PointsPlatform;
  extra_platform_points_platform?: PointsPlatform;
}

interface SaleFormData {
  selling_price: number;
  platform_fee: number;
  shipping_fee: number;
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [transaction, setTransaction] = useState<TransactionWithPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [saleData, setSaleData] = useState<SaleFormData>({
    selling_price: 0,
    platform_fee: 0,
    shipping_fee: 0,
  });

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const loadTransaction = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          payment_method:payment_methods(*),
          platform_points_platform:platform_points_platform_id (
            display_name,
            yen_conversion_rate
          ),
          card_points_platform:card_points_platform_id (
            display_name,
            yen_conversion_rate
          ),
          extra_platform_points_platform:extra_platform_points_platform_id (
            display_name,
            yen_conversion_rate
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setTransaction(data);
    } catch (error) {
      console.error('加载交易详情失败:', error);
      alert('加载失败，请重试');
      router.push('/transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transaction) return;

    setSubmitting(true);
    try {
      // 计算现金利润（不含积分）
      const cash_profit = saleData.selling_price - transaction.purchase_price_total - saleData.platform_fee - saleData.shipping_fee;

      // 计算积分价值（使用平台兑换率）
      const platformPointsValue = (transaction.expected_platform_points || 0) *
        (transaction.platform_points_platform?.yen_conversion_rate || 1.0);
      const cardPointsValue = (transaction.expected_card_points || 0) *
        (transaction.card_points_platform?.yen_conversion_rate || 1.0);
      const extraPlatformPointsValue = (transaction.extra_platform_points || 0) *
        (transaction.extra_platform_points_platform?.yen_conversion_rate || 1.0);

      const points_value = platformPointsValue + cardPointsValue + extraPlatformPointsValue;

      // 计算总利润（现金 + 积分）
      const total_profit = cash_profit + points_value;

      // 计算实际现金支出（采购成本 - 积分抵扣）
      const actual_cash_spent = transaction.purchase_price_total - transaction.point_paid;

      // 计算 ROI（总利润 / 实际现金支出）
      const roi = actual_cash_spent > 0 ? (total_profit / actual_cash_spent) * 100 : 0;

      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'sold',
          selling_price: saleData.selling_price,
          platform_fee: saleData.platform_fee,
          shipping_fee: saleData.shipping_fee,
          cash_profit,
          total_profit,
          roi,
        })
        .eq('id', id);

      if (error) throw error;

      // 重新加载数据
      await loadTransaction();
      setShowSaleForm(false);
      alert('销售信息已保存！');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSale = async () => {
    if (!confirm('确定要取消此销售吗？\n\n此操作将：\n• 将状态改回"库存中"\n• 清空所有销售数据（售价、费用、利润、ROI等）\n\n此操作无法撤销。')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'in_stock',
          selling_price: null,
          platform_fee: null,
          shipping_fee: null,
          cash_profit: null,
          total_profit: null,
          roi: null,
        })
        .eq('id', id);

      if (error) throw error;

      // 重新加载数据
      await loadTransaction();
      alert('销售已取消，交易状态已恢复为"库存中"');
    } catch (error) {
      console.error('取消销售失败:', error);
      alert('取消销售失败，请重试');
    }
  };

  const deleteTransaction = async () => {
    if (!confirm('确定要删除这条交易记录吗？此操作无法撤销。')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      router.push('/transactions');
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
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

  if (!transaction) {
    return null;
  }

  // 重新计算预计还款日期（使用最新的 payment_same_month 配置）
  let calculatedPaymentDate: string | null = null;
  if (transaction.payment_method && transaction.payment_method.closing_day && transaction.payment_method.payment_day) {
    const paymentDate = calculatePaymentDate(
      new Date(transaction.date),
      transaction.payment_method.closing_day,
      transaction.payment_method.payment_day,
      transaction.payment_method.payment_same_month || false
    );
    calculatedPaymentDate = paymentDate.toLocaleString().split(' ')[0]; // 只取日期部分
  }

  const daysToPayment = calculatedPaymentDate ? daysUntil(calculatedPaymentDate) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="relative max-w-5xl mx-auto px-4 py-8">
        {/* 标题栏 */}
        <div className="mb-8">
          <Link
            href="/transactions"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回交易列表</span>
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{transaction.product_name}</h1>
              <div className="flex items-center gap-3">
                {transaction.status === 'sold' ? (
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    已售出
                  </span>
                ) : (
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    库存中
                  </span>
                )}
                <span className="text-gray-600 dark:text-gray-400">
                  {new Date(transaction.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {transaction.status === 'in_stock' && !showSaleForm && (
                <button
                  onClick={() => setShowSaleForm(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  记录销售
                </button>
              )}
              {transaction.status === 'sold' && (
                <button
                  onClick={cancelSale}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  取消销售
                </button>
              )}
              <Link
                href={`/transactions/${id}/edit`}
                className="p-3 bg-white dark:bg-gray-700 hover:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-white rounded-xl transition-all border border-gray-300 dark:border-gray-600"
                title="编辑"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Link>
              <button
                onClick={deleteTransaction}
                className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all border border-red-500/30"
                title="删除"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 销售表单（库存中商品） */}
        {showSaleForm && transaction.status === 'in_stock' && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-emerald-500/30 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
              记录销售信息
            </h2>
            <form onSubmit={handleSaleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    销售价格 <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={saleData.selling_price || ''}
                      onChange={(e) => setSaleData({ ...saleData, selling_price: parseFloat(e.target.value) || 0 })}
                      step="0.01"
                      min="0"
                      required
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">¥</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    平台费用
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={saleData.platform_fee || ''}
                      onChange={(e) => setSaleData({ ...saleData, platform_fee: parseFloat(e.target.value) || 0 })}
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">¥</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    运费
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={saleData.shipping_fee || ''}
                      onChange={(e) => setSaleData({ ...saleData, shipping_fee: parseFloat(e.target.value) || 0 })}
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">¥</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-gradient-to-r bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  {submitting ? '保存中...' : '保存销售信息'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaleForm(false)}
                  className="px-6 py-3 bg-white dark:bg-gray-700 hover:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-white rounded-xl transition-all border border-gray-300 dark:border-gray-600"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧主要内容 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 成本信息 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
                采购成本
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">采购总价</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(transaction.purchase_price_total)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">信用卡支付</span>
                    <span className="text-gray-900 dark:text-white font-mono">{formatCurrency(transaction.card_paid)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">积分抵扣</span>
                    <span className="text-gray-900 dark:text-white font-mono">{formatCurrency(transaction.point_paid)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">余额支付</span>
                    <span className="text-gray-900 dark:text-white font-mono">{formatCurrency(transaction.balance_paid)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 销售信息 */}
            {transaction.status === 'sold' && (() => {
              // 计算积分价值
              const platformPointsValue = (transaction.expected_platform_points || 0) *
                (transaction.platform_points_platform?.yen_conversion_rate || 1.0);
              const cardPointsValue = (transaction.expected_card_points || 0) *
                (transaction.card_points_platform?.yen_conversion_rate || 1.0);
              const extraPlatformPointsValue = (transaction.extra_platform_points || 0) *
                (transaction.extra_platform_points_platform?.yen_conversion_rate || 1.0);
              const totalPointsValue = platformPointsValue + cardPointsValue + extraPlatformPointsValue;

              return (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                    销售信息
                  </h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">销售价格</span>
                      <span className="text-gray-900 dark:text-white font-mono">{formatCurrency(transaction.selling_price || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">平台费用</span>
                      <span className="text-red-400 font-mono">-{formatCurrency(transaction.platform_fee)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">运费</span>
                      <span className="text-red-400 font-mono">-{formatCurrency(transaction.shipping_fee)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">现金利润</span>
                      <span className={`text-lg font-semibold ${(transaction.cash_profit || 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {formatCurrency(transaction.cash_profit || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">积分价值</span>
                      <span className="text-amber-400 font-semibold">
                        +{formatCurrency(totalPointsValue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300 dark:border-gray-600">
                      <span className="text-gray-900 dark:text-white font-semibold">总利润</span>
                      <span className={`text-2xl font-bold ${(transaction.total_profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(transaction.total_profit || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">ROI</span>
                      <span className={`text-xl font-bold ${(transaction.roi || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatROI(transaction.roi || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 预期积分 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
                预期积分
              </h2>
              <div className="space-y-3">
                {/* 平台积分 */}
                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-amber-400 text-sm mb-1">平台积分</div>
                      <div className="text-2xl font-bold text-amber-400">{transaction.expected_platform_points} P</div>
                    </div>
                    {transaction.platform_points_platform && (
                      <div className="text-right">
                        <div className="text-xs text-amber-400/70">{transaction.platform_points_platform.display_name}</div>
                        <div className="text-sm text-amber-400 font-mono">
                          ¥{((transaction.expected_platform_points || 0) * transaction.platform_points_platform.yen_conversion_rate).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 额外平台积分 */}
                {transaction.extra_platform_points > 0 && (
                  <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-cyan-400 text-sm mb-1">额外积分</div>
                        <div className="text-2xl font-bold text-cyan-400">{transaction.extra_platform_points} P</div>
                      </div>
                      {transaction.extra_platform_points_platform && (
                        <div className="text-right">
                          <div className="text-xs text-cyan-400/70">{transaction.extra_platform_points_platform.display_name}</div>
                          <div className="text-sm text-cyan-400 font-mono">
                            ¥{((transaction.extra_platform_points || 0) * transaction.extra_platform_points_platform.yen_conversion_rate).toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 信用卡积分 */}
                <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-purple-400 text-sm mb-1">信用卡积分</div>
                      <div className="text-2xl font-bold text-purple-400">{transaction.expected_card_points} P</div>
                    </div>
                    {transaction.card_points_platform && (
                      <div className="text-right">
                        <div className="text-xs text-purple-400/70">{transaction.card_points_platform.display_name}</div>
                        <div className="text-sm text-purple-400 font-mono">
                          ¥{((transaction.expected_card_points || 0) * transaction.card_points_platform.yen_conversion_rate).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-white dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">积分状态</span>
                  {transaction.point_status === 'received' ? (
                    <span className="text-emerald-400 text-sm font-medium">已到账</span>
                  ) : transaction.point_status === 'expired' ? (
                    <span className="text-red-400 text-sm font-medium">已过期</span>
                  ) : (
                    <span className="text-amber-400 text-sm font-medium">待确认</span>
                  )}
                </div>
              </div>
            </div>

            {/* 备注 */}
            {transaction.notes && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></div>
                  备注
                </h2>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{transaction.notes}</p>
              </div>
            )}
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-6">
            {/* 凭证图片 */}
            {transaction.image_url && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">采购凭证</h3>
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-800">
                  <Image
                    src={transaction.image_url}
                    alt="采购凭证"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            )}

            {/* 支付信息 */}
            {transaction.payment_method && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">支付方式</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">卡片名称</span>
                    <span className="text-gray-900 dark:text-white font-medium">{transaction.payment_method.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">返点率</span>
                    <span className="text-emerald-400 font-medium">{(transaction.payment_method.point_rate * 100).toFixed(2)}%</span>
                  </div>
                  {calculatedPaymentDate && (
                    <>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">预计还款日</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {calculatedPaymentDate}
                        </span>
                      </div>
                      {daysToPayment !== null && (
                        <div className="p-3 rounded-lg bg-white dark:bg-gray-700">
                          <div className="text-center">
                            {daysToPayment < 0 ? (
                              <span className="text-red-400 font-medium">已逾期 {Math.abs(daysToPayment)} 天</span>
                            ) : daysToPayment === 0 ? (
                              <span className="text-amber-400 font-medium">今天到期</span>
                            ) : (
                              <span className="text-gray-700 dark:text-gray-300">还有 <span className="text-gray-900 dark:text-white font-bold">{daysToPayment}</span> 天</span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 时间信息 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">时间信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">创建时间</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {new Date(transaction.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">更新时间</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {new Date(transaction.updated_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
