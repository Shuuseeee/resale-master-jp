// app/transactions/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Transaction, PaymentMethod, PointsPlatform, PurchasePlatform } from '@/types/database.types';
import { formatCurrency, formatROI, daysUntil, calculatePaymentDate } from '@/lib/financial/calculator';
import { markTransactionArrived } from '@/lib/api/financial';
import Image from 'next/image';
import Link from 'next/link';
import { layout, heading, card, button, badge, input } from '@/lib/theme';
import BatchSaleForm from '@/components/BatchSaleForm';
import SalesRecordsList from '@/components/SalesRecordsList';
import ReturnRecordsList from '@/components/ReturnRecordsList';
import { createReturnRecord } from '@/lib/api/return-records';
import { parseNumberInput } from '@/lib/number-utils';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  platform_points_platform?: PointsPlatform;
  card_points_platform?: PointsPlatform;
  extra_platform_points_platform?: PointsPlatform;
  purchase_platform?: PurchasePlatform;
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [transaction, setTransaction] = useState<TransactionWithPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showBatchSaleForm, setShowBatchSaleForm] = useState(false); // 批量销售表单
  const [showReturnForm, setShowReturnForm] = useState(false); // 退货表单
  const [submitting, setSubmitting] = useState(false);

  const [returnData, setReturnData] = useState({
    quantity_returned: 1,
    return_date: new Date().toISOString().split('T')[0],
    return_amount: 0,
    points_deducted: 0,
    return_reason: '',
    notes: '',
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
          purchase_platform:purchase_platform_id(id, name),
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

  const cancelSale = async () => {
    if (!confirm('確定要取消此銷售嗎？\n\n此操作將：\n• 刪除所有銷售記錄\n• 恢復庫存數量\n• 將狀態改回"庫存中"\n• 清空所有銷售數據（利潤、ROI等）\n\n此操作無法撤銷。')) {
      return;
    }

    try {
      // 1. 删除所有销售记录（数据库触发器会自动更新 quantity_sold 和 status）
      const { error: deleteError } = await supabase
        .from('sales_records')
        .delete()
        .eq('transaction_id', id);

      if (deleteError) throw deleteError;

      // 2. 清空利润字段（因为触发器不会清空这些字段）
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          cash_profit: null,
          total_profit: null,
          roi: null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // 重新加载数据
      await loadTransaction();
      alert('销售已取消，所有销售记录已删除，库存已恢复');
    } catch (error) {
      console.error('取消销售失败:', error);
      alert('取消销售失败，请重试');
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transaction) return;

    if (returnData.quantity_returned > transaction.quantity_in_stock) {
      alert(`退货数量不能超过库存数量 (${transaction.quantity_in_stock})`);
      return;
    }

    if (!confirm(`确定要退货 ${returnData.quantity_returned} 个吗？`)) {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await createReturnRecord(transaction.id, {
        quantity_returned: returnData.quantity_returned,
        return_date: returnData.return_date,
        return_amount: returnData.return_amount,
        points_deducted: returnData.points_deducted,
        return_reason: returnData.return_reason,
        notes: returnData.notes,
      });

      if (error) throw error;

      await loadTransaction();
      setShowReturnForm(false);
      setReturnData({
        quantity_returned: 1,
        return_date: new Date().toISOString().split('T')[0],
        return_amount: 0,
        points_deducted: 0,
        return_reason: '',
        notes: '',
      });
      alert('退货记录已创建');
    } catch (error) {
      console.error('创建退货记录失败:', error);
      alert('操作失败，请重试');
    } finally {
      setSubmitting(false);
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
  if (transaction.payment_method && transaction.payment_method.closing_day && transaction.payment_method.payment_day && transaction.date) {
    try {
      const paymentDate = calculatePaymentDate(
        new Date(transaction.date),
        transaction.payment_method.closing_day,
        transaction.payment_method.payment_day,
        transaction.payment_method.payment_same_month || false
      );
      if (paymentDate && !isNaN(paymentDate.getTime())) {
        calculatedPaymentDate = paymentDate.toLocaleString().split(' ')[0]; // 只取日期部分
      }
    } catch (error) {
      console.error('Error calculating payment date:', error);
    }
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

          <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl xs:text-3xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-3 xs:line-clamp-2 lg:line-clamp-none break-cjk-normal leading-tight">{transaction.product_name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                {transaction.status === 'sold' ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                    已售出
                  </span>
                ) : transaction.status === 'returned' ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30 whitespace-nowrap">
                    已退货
                  </span>
                ) : transaction.status === 'pending' ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30 whitespace-nowrap">
                    未着
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                    库存中
                  </span>
                )}
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {new Date(transaction.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 flex-wrap xs:flex-nowrap">
              {/* 着荷按钮 - 仅当status=pending时显示 */}
              {transaction.status === 'pending' && (
                <button
                  onClick={async () => {
                    const success = await markTransactionArrived(transaction.id);
                    if (success) {
                      setTransaction({ ...transaction, status: 'in_stock' });
                    } else {
                      alert('着荷処理に失敗しました');
                    }
                  }}
                  className="px-3 py-2 xs:px-4 xs:py-2 sm:px-6 sm:py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl shadow-lg flex items-center gap-1.5 min-w-[100px] xs:min-w-[110px] whitespace-nowrap"
                >
                  <svg className="w-4 h-4 xs:w-5 xs:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="hidden xs:inline">着荷確認</span>
                  <span className="xs:hidden">着荷</span>
                </button>
              )}
              {/* 批量商品显示批量销售按钮 */}
              {transaction.quantity > 1 && transaction.quantity_in_stock > 0 && !showBatchSaleForm && (
                <button
                  onClick={() => setShowBatchSaleForm(true)}
                  className="px-3 py-2 xs:px-4 xs:py-2 sm:px-6 sm:py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl shadow-lg flex items-center gap-1.5 min-w-[100px] xs:min-w-[110px] whitespace-nowrap"
                >
                  <svg className="w-4 h-4 xs:w-5 xs:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden xs:inline">记录销售</span>
                  <span className="xs:hidden">记录</span>
                </button>
              )}
              {/* 单品显示原有的记录销售按钮 */}
              {transaction.quantity === 1 && transaction.status === 'in_stock' && !showSaleForm && (
                <button
                  onClick={() => setShowSaleForm(true)}
                  className="px-3 py-2 xs:px-4 xs:py-2 sm:px-6 sm:py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl shadow-lg flex items-center gap-1.5 min-w-[100px] xs:min-w-[110px] whitespace-nowrap"
                >
                  <svg className="w-4 h-4 xs:w-5 xs:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden xs:inline">记录销售</span>
                  <span className="xs:hidden">记录</span>
                </button>
              )}
              {/* 退货按钮 - 有库存时显示 */}
              {transaction.quantity_in_stock > 0 && !showReturnForm && (
                <button
                  onClick={() => setShowReturnForm(true)}
                  className="px-3 py-2 xs:px-4 xs:py-2 sm:px-6 sm:py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl shadow-lg flex items-center gap-1.5 min-w-[100px] xs:min-w-[110px] whitespace-nowrap"
                >
                  <svg className="w-4 h-4 xs:w-5 xs:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                  </svg>
                  <span className="hidden xs:inline">标记为退货</span>
                  <span className="xs:hidden">退货</span>
                </button>
              )}
              {transaction.status === 'sold' && (
                <button
                  onClick={cancelSale}
                  className="px-3 py-2 xs:px-4 xs:py-2 sm:px-6 sm:py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl shadow-lg flex items-center gap-1.5 min-w-[100px] xs:min-w-[110px] whitespace-nowrap"
                >
                  <svg className="w-4 h-4 xs:w-5 xs:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <span className="hidden xs:inline">取消销售</span>
                  <span className="xs:hidden">取消</span>
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
              <Link
                href={`/transactions/add?copy=${id}`}
                className="p-3 bg-white dark:bg-gray-700 hover:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-white rounded-xl transition-all border border-gray-300 dark:border-gray-600"
                title="复制为新交易"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </Link>
              <button
                onClick={deleteTransaction}
                className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-300 rounded-xl transition-all border border-red-500/30"
                title="删除"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 退货表单 */}
        {showReturnForm && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-red-500/30 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-red-500 to-rose-500 rounded-full"></div>
              记录退货
            </h2>
            <form onSubmit={handleReturn} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    退货数量 <span className="text-red-600 dark:text-red-300">*</span>
                  </label>
                  <input
                    type="number"
                    value={returnData.quantity_returned || ''}
                    onChange={(e) => setReturnData({ ...returnData, quantity_returned: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                    required
                    min="1"
                    max={transaction.quantity_in_stock}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    当前库存: {transaction.quantity_in_stock} 个
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    退货日期 <span className="text-red-600 dark:text-red-300">*</span>
                  </label>
                  <input
                    type="date"
                    value={returnData.return_date}
                    onChange={(e) => setReturnData({ ...returnData, return_date: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    退款金额
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={returnData.return_amount || ''}
                      onChange={(e) => setReturnData({ ...returnData, return_amount: parseNumberInput(e.target.value, 0) })}
                      placeholder="0.00"
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">¥</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    扣除积分
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={returnData.points_deducted || ''}
                    onChange={(e) => setReturnData({ ...returnData, points_deducted: parseNumberInput(e.target.value, 0) })}
                    placeholder="退货时被扣除的积分数量"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  退货原因
                </label>
                <input
                  type="text"
                  value={returnData.return_reason}
                  onChange={(e) => setReturnData({ ...returnData, return_reason: e.target.value })}
                  placeholder="不良品、サイズ違い、注文間違い等"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  备注
                </label>
                <textarea
                  value={returnData.notes}
                  onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                  rows={3}
                  placeholder="其他退货相关信息..."
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  {submitting ? '提交中...' : '确认退货'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReturnForm(false)}
                  className="px-6 py-3 bg-white dark:bg-gray-700 hover:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-white rounded-xl transition-all border border-gray-300 dark:border-gray-600"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 批量销售表单 */}
        {showBatchSaleForm && transaction.quantity > 1 && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-emerald-500/30 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
              记录销售信息
            </h2>
            <BatchSaleForm
              transaction={transaction}
              onSuccess={() => {
                setShowBatchSaleForm(false);
                loadTransaction();
              }}
              onCancel={() => setShowBatchSaleForm(false)}
            />
          </div>
        )}

        {/* 销售表单（统一使用批量销售表单） */}
        {showSaleForm && transaction.status === 'in_stock' && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-emerald-500/30 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
              记录销售信息
            </h2>
            <BatchSaleForm
              transaction={transaction}
              onSuccess={() => {
                setShowSaleForm(false);
                loadTransaction();
              }}
              onCancel={() => setShowSaleForm(false)}
            />
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

            {/* 購入情報 */}
            {(transaction.jan_code || transaction.purchase_platform || transaction.order_number || transaction.unit_price) && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                  購入情報
                </h2>
                <div className="space-y-3">
                  {transaction.purchase_platform && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">購入先</span>
                      <span className="text-gray-900 dark:text-white font-medium">{transaction.purchase_platform.name}</span>
                    </div>
                  )}
                  {transaction.jan_code && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">JANコード</span>
                      <span className="text-gray-900 dark:text-white font-mono">{transaction.jan_code}</span>
                    </div>
                  )}
                  {transaction.order_number && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">注文番号</span>
                      <span className="text-gray-900 dark:text-white font-mono">{transaction.order_number}</span>
                    </div>
                  )}
                  {/* 注文履歴リンク */}
                  {transaction.order_number && transaction.purchase_platform && (() => {
                    const platformName = transaction.purchase_platform!.name;
                    const orderNum = transaction.order_number!;
                    let orderUrl: string | null = null;
                    if (platformName === 'Amazon') {
                      orderUrl = `https://www.amazon.co.jp/gp/your-account/order-details?orderID=${orderNum}`;
                    } else if (platformName === '楽天市場') {
                      orderUrl = `https://order.my.rakuten.co.jp/`;
                    } else if (platformName === 'Yahoo!ショッピング') {
                      orderUrl = `https://odhistory.shopping.yahoo.co.jp/order-history/details`;
                    }
                    return orderUrl ? (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">注文履歴</span>
                        <a
                          href={orderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 dark:text-teal-400 hover:underline text-sm flex items-center gap-1"
                        >
                          {platformName}で確認
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    ) : null;
                  })()}
                  {transaction.unit_price && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">単価</span>
                      <span className="text-gray-900 dark:text-white font-mono">{formatCurrency(transaction.unit_price)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* リピート仕入れリンク */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
                リピート仕入れ
              </h2>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const searchQuery = transaction.jan_code || transaction.product_name;
                  const encodedQuery = encodeURIComponent(searchQuery);
                  const links = [
                    { name: 'Amazon', url: `https://www.amazon.co.jp/s?k=${encodedQuery}`, color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' },
                    { name: '楽天', url: `https://search.rakuten.co.jp/search/mall/${encodedQuery}/`, color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
                    { name: 'Yahoo!', url: `https://shopping.yahoo.co.jp/search?p=${encodedQuery}`, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
                    { name: 'メルカリ', url: `https://jp.mercari.com/search?keyword=${encodedQuery}`, color: 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-400/30' },
                    { name: 'ヤフオク', url: `https://auctions.yahoo.co.jp/search/search?p=${encodedQuery}`, color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
                  ];
                  return links.map((link) => (
                    <a
                      key={link.name}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all hover:opacity-80 ${link.color}`}
                    >
                      {link.name}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ));
                })()}
              </div>
              {transaction.jan_code && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  JANコード ({transaction.jan_code}) で検索
                </p>
              )}
            </div>

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
                      <div className="text-amber-600 dark:text-amber-300 text-sm mb-1">平台积分</div>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-300">{transaction.expected_platform_points} P</div>
                    </div>
                    {transaction.platform_points_platform && (
                      <div className="text-right">
                        <div className="text-xs text-amber-600 dark:text-amber-300/90">{transaction.platform_points_platform.display_name}</div>
                        <div className="text-sm text-amber-600 dark:text-amber-300 font-mono">
                          ¥{((transaction.expected_platform_points || 0) * transaction.platform_points_platform.yen_conversion_rate).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 额外平台积分 */}
                {transaction.extra_platform_points > 0 && (
                  <div className="bg-teal-500/10 rounded-xl p-4 border border-teal-500/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-teal-700 text-sm mb-1">额外积分</div>
                        <div className="text-2xl font-bold text-teal-700">{transaction.extra_platform_points} P</div>
                      </div>
                      {transaction.extra_platform_points_platform && (
                        <div className="text-right">
                          <div className="text-xs text-teal-700">{transaction.extra_platform_points_platform.display_name}</div>
                          <div className="text-sm text-teal-700 font-mono">
                            ¥{((transaction.extra_platform_points || 0) * transaction.extra_platform_points_platform.yen_conversion_rate).toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 信用卡积分 */}
                <div className="bg-teal-500/10 rounded-xl p-4 border border-teal-500/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-teal-700 dark:text-teal-400 text-sm mb-1">信用卡积分</div>
                      <div className="text-2xl font-bold text-teal-700 dark:text-teal-400">{transaction.expected_card_points} P</div>
                    </div>
                    {transaction.card_points_platform && (
                      <div className="text-right">
                        <div className="text-xs text-teal-700 dark:text-teal-400/70">{transaction.card_points_platform.display_name}</div>
                        <div className="text-sm text-teal-700 dark:text-teal-400 font-mono">
                          ¥{((transaction.expected_card_points || 0) * transaction.card_points_platform.yen_conversion_rate).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 备注 */}
            {transaction.notes && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-teal-400 to-teal-500 rounded-full"></div>
                  备注
                </h2>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{transaction.notes}</p>
              </div>
            )}
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-6">
            {/* 批量商品的库存信息 */}
            {transaction.quantity > 1 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">库存信息</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">总数量</span>
                    <span className="text-gray-900 dark:text-white font-medium">{transaction.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">已售出</span>
                    <span className="text-emerald-600 dark:text-emerald-300 font-medium">{transaction.quantity_sold}</span>
                  </div>
                  {transaction.quantity_returned > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">已退货</span>
                      <span className="text-red-600 dark:text-red-300 font-medium">{transaction.quantity_returned}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">库存</span>
                    <span className="text-teal-600 dark:text-teal-400 font-bold text-lg">{transaction.quantity_in_stock}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 销售记录列表 */}
            {transaction.quantity_sold > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">销售记录</h3>
                <SalesRecordsList
                  transactionId={transaction.id}
                  transaction={transaction}
                  onUpdate={loadTransaction}
                />
              </div>
            )}

            {/* 退货记录列表 */}
            {transaction.quantity_returned > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-red-500/20 shadow-2xl">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-300 mb-4">退货记录</h3>
                <ReturnRecordsList
                  transactionId={transaction.id}
                  onUpdate={loadTransaction}
                />
              </div>
            )}

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
                    <span className="text-emerald-600 dark:text-emerald-300 font-medium">{(transaction.payment_method.point_rate * 100).toFixed(2)}%</span>
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
                              <span className="text-red-600 dark:text-red-300 font-medium">已逾期 {Math.abs(daysToPayment)} 天</span>
                            ) : daysToPayment === 0 ? (
                              <span className="text-amber-600 dark:text-amber-300 font-medium">今天到期</span>
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
