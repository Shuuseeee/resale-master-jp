// app/transactions/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Transaction, PaymentMethod, PointsPlatform, PurchasePlatform } from '@/types/database.types';
import { formatCurrency, formatROI, daysUntil, calculatePaymentDate } from '@/lib/financial/calculator';
import { markTransactionArrived, confirmPaymentReceived } from '@/lib/api/financial';
import Image from 'next/image';
import Link from 'next/link';
import { button } from '@/lib/theme';
import BatchSaleForm from '@/components/BatchSaleForm';
import SalesRecordsList from '@/components/SalesRecordsList';
import ReturnRecordsList from '@/components/ReturnRecordsList';
import ReturnForm from '@/components/ReturnForm';
import Toast from '@/components/Toast';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  platform_points_platform?: PointsPlatform;
  card_points_platform?: PointsPlatform;
  extra_platform_points_platform?: PointsPlatform;
  purchase_platform?: PurchasePlatform;
}

interface HistoryEntry {
  id: string;
  changed_at: string;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
}

const FIELD_LABELS: Record<string, string> = {
  product_name: '商品名',
  date: '采购日',
  purchase_price_total: '合计金额',
  unit_price: '单价',
  quantity: '数量',
  card_paid: '信用卡支付',
  point_paid: '积分抵扣',
  balance_paid: '余额支付',
  expected_platform_points: '平台积分',
  expected_card_points: '信用卡积分',
  extra_platform_points: '额外积分',
  jan_code: 'JAN 码',
  order_number: '订单号',
  notes: '备注',
  status: '状态',
  image_url: '图片',
  purchase_platform_id: '采购平台',
  card_id: '卡片',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '未到货',
  in_stock: '库存中',
  awaiting_payment: '待入账',
  sold: '已售出',
  returned: '已退货',
};

function formatHistoryValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (field === 'status') return STATUS_LABELS[String(value)] || String(value);
  if (field === 'image_url') return '(图片)';
  if (['purchase_platform_id', 'card_id'].includes(field)) return '(已变更)';
  if (['purchase_price_total', 'unit_price', 'card_paid', 'point_paid', 'balance_paid',
    'expected_platform_points', 'expected_card_points', 'extra_platform_points'].includes(field)) {
    return `¥${Number(value).toLocaleString()}`;
  }
  return String(value);
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const autoSale = searchParams.get('action') === 'sale';
  const autoReturn = searchParams.get('action') === 'return';

  const [transaction, setTransaction] = useState<TransactionWithPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showBatchSaleForm, setShowBatchSaleForm] = useState(false); // 批量销售表单
  const [showReturnForm, setShowReturnForm] = useState(false); // 退货表单
  const [showToast, setShowToast] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setShowToast(true);
    });
  };

  useEffect(() => {
    loadTransaction();
    loadHistory();
  }, [id]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from('transaction_history')
      .select('id, changed_at, old_values, new_values')
      .eq('transaction_id', id)
      .order('changed_at', { ascending: false })
      .limit(50);
    if (data) setHistory(data as HistoryEntry[]);
  };

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
      if (autoSale && data) {
        if (data.quantity > 1) {
          setShowBatchSaleForm(true);
        } else if (data.status === 'in_stock') {
          setShowSaleForm(true);
        }
      }
      if (autoReturn && data && (data.status === 'in_stock' || data.status === 'pending')) {
        setShowReturnForm(true);
      }
    } catch (error) {
      console.error('加载交易详情失败:', error);
      alert('加载失败，请重试');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const cancelSale = async () => {
    if (!confirm('确定要取消此销售吗？\n\n此操作将：\n• 删除所有销售记录\n• 恢复库存数量\n• 将状态改回"库存中"\n• 清空所有销售数据（利润、ROI等）\n\n此操作无法撤销。')) {
      return;
    }

    try {
      // 1. 删除所有销售记录（数据库触发器会自动更新 quantity_sold 和 status）
      const { error: deleteError } = await supabase
        .from('sales_records')
        .delete()
        .eq('transaction_id', id);

      if (deleteError) throw deleteError;

      // 2. 显式恢复状态 + 清空利润字段
      // trigger 会把 awaiting_payment → in_stock，但 sold 被 guard 保护不会自动回退
      // 所以这里必须显式设置 status
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'in_stock',
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

  const handleReturnSuccess = async () => {
    await loadTransaction();
    setShowReturnForm(false);
    alert('退货记录已创建');
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

      router.back();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text)]">
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
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="relative max-w-5xl mx-auto px-4 py-8">
        {/* 标题栏 */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回</span>
          </button>

          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--color-text)] mb-2 line-clamp-3 sm:line-clamp-2 lg:line-clamp-none break-cjk-normal leading-tight">{transaction.product_name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                {transaction.status === 'sold' ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/30 whitespace-nowrap">
                    已售出
                  </span>
                ) : transaction.status === 'returned' ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-red-500/20 text-[var(--color-danger)] border border-red-500/30 whitespace-nowrap">
                    已退货
                  </span>
                ) : transaction.status === 'awaiting_payment' ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/30 whitespace-nowrap">
                    待入账
                  </span>
                ) : transaction.status === 'pending' ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/30 whitespace-nowrap">
                    未到货
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-[rgba(245,158,11,0.14)] text-[var(--color-warning)] border border-[rgba(245,158,11,0.3)] whitespace-nowrap">
                    库存中
                  </span>
                )}
                <span className="text-xs sm:text-sm text-[var(--color-text-muted)] whitespace-nowrap">
                  {new Date(transaction.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 着荷按钮 - 仅当status=pending时显示 */}
              {transaction.status === 'pending' && (
                <button
                  onClick={async () => {
                    const success = await markTransactionArrived(transaction.id);
                    if (success) {
                      setTransaction({ ...transaction, status: 'in_stock' });
                    } else {
                      alert('到货处理失败');
                    }
                  }}
                  className={button.primary + " gap-1.5 whitespace-nowrap"}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  确认到货
                </button>
              )}
              {/* 批量商品显示批量销售按钮 */}
              {transaction.quantity > 1 && transaction.quantity_in_stock > 0 && !showBatchSaleForm && (
                <button
                  onClick={() => setShowBatchSaleForm(true)}
                  className={button.primary + " gap-1.5 whitespace-nowrap"}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  记录销售
                </button>
              )}
              {/* 单品显示原有的记录销售按钮 */}
              {transaction.quantity === 1 && transaction.status === 'in_stock' && !showSaleForm && (
                <button
                  onClick={() => setShowSaleForm(true)}
                  className={button.primary + " gap-1.5 whitespace-nowrap"}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  记录销售
                </button>
              )}
              {/* 退货按钮 - 有库存时显示 */}
              {transaction.quantity_in_stock > 0 && !showReturnForm && (
                <button
                  onClick={() => setShowReturnForm(true)}
                  className={button.danger + " gap-1.5 whitespace-nowrap"}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                  </svg>
                  退货
                </button>
              )}
              {/* 入金確認按钮 - 仅当status=awaiting_payment时显示 */}
              {transaction.status === 'awaiting_payment' && (
                <button
                  onClick={async () => {
                    const success = await confirmPaymentReceived(transaction.id);
                    if (success) {
                      setTransaction({ ...transaction, status: 'sold' });
                    } else {
                      alert('入金确认失败');
                    }
                  }}
                  className={button.primary + " gap-1.5 whitespace-nowrap"}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  确认入账
                </button>
              )}
              {(transaction.status === 'sold' || transaction.status === 'awaiting_payment') && (
                <button
                  onClick={cancelSale}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-warning)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  取消销售
                </button>
              )}
              <Link
                href={`/transactions/${id}/edit`}
                className="sn-icon-button"
                title="编辑"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Link>
              <Link
                href={`/transactions/add?copy=${id}`}
                className="sn-icon-button"
                title="复制为新交易"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </Link>
              <button
                onClick={deleteTransaction}
                className="sn-icon-button text-[var(--color-danger)] hover:border-[rgba(239,68,68,0.35)] hover:bg-[rgba(239,68,68,0.08)]"
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
          <div className="mb-6 sn-detail-card border-[rgba(239,68,68,0.3)]">
            <ReturnForm
              transaction={transaction}
              onSuccess={handleReturnSuccess}
              onCancel={() => setShowReturnForm(false)}
              showHeader
            />
          </div>
        )}

        {/* 批量销售表单 */}
        {showBatchSaleForm && transaction.quantity > 1 && (
          <div className="mb-6 sn-detail-card border-[rgba(16,185,129,0.3)]">
            <h2 className="sn-detail-title-lg">
              <div className="sn-form-title-bar"></div>
              记录销售信息
            </h2>
            <BatchSaleForm
              transaction={transaction}
              onSuccess={() => {
                setShowBatchSaleForm(false);
                loadTransaction();
              }}
              onDataRefresh={loadTransaction}
              onCancel={() => setShowBatchSaleForm(false)}
            />
          </div>
        )}

        {/* 销售表单（统一使用批量销售表单） */}
        {showSaleForm && transaction.status === 'in_stock' && (
          <div className="mb-6 sn-detail-card border-[rgba(16,185,129,0.3)]">
            <h2 className="sn-detail-title-lg">
              <div className="sn-form-title-bar"></div>
              记录销售信息
            </h2>
            <BatchSaleForm
              transaction={transaction}
              onSuccess={() => {
                setShowSaleForm(false);
                loadTransaction();
              }}
              onDataRefresh={loadTransaction}
              onCancel={() => setShowSaleForm(false)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧主要内容 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 成本信息 */}
            <div className="sn-detail-card">
              <h2 className="sn-detail-title-lg">
                <div className="sn-form-title-bar"></div>
                采购成本
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-[var(--color-border)]">
                  <span className="text-[var(--color-text-muted)]">采购总价</span>
                  <span className="text-2xl font-bold text-[var(--color-text)]">{formatCurrency(transaction.purchase_price_total)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-text-muted)]">信用卡支付</span>
                    <span className="text-[var(--color-text)] font-mono">{formatCurrency(transaction.card_paid)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-text-muted)]">积分抵扣</span>
                    <span className="text-[var(--color-text)] font-mono">{formatCurrency(transaction.point_paid)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-text-muted)]">余额支付</span>
                    <span className="text-[var(--color-text)] font-mono">{formatCurrency(transaction.balance_paid)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 采购信息 */}
            {(transaction.jan_code || transaction.purchase_platform || transaction.order_number || transaction.unit_price) && (
              <div className="sn-detail-card">
                <h2 className="sn-detail-title-lg">
                  <div className="sn-form-title-bar"></div>
                  采购信息
                </h2>
                <div className="space-y-3">
                  {transaction.purchase_platform && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">采购平台</span>
                      <span className="text-[var(--color-text)] font-medium">{transaction.purchase_platform.name}</span>
                    </div>
                  )}
                  {transaction.jan_code && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">JAN 码</span>
                      <button
                        onClick={() => copyToClipboard(transaction.jan_code!)}
                        className="text-[var(--color-text)] font-mono hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                        title="点击复制"
                      >
                        {transaction.jan_code}
                      </button>
                    </div>
                  )}
                  {transaction.order_number && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">订单号</span>
                      <button
                        onClick={() => copyToClipboard(transaction.order_number!)}
                        className="text-[var(--color-text)] font-mono hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                        title="点击复制"
                      >
                        {transaction.order_number}
                      </button>
                    </div>
                  )}
                  {/* 订单历史链接 */}
                  {transaction.order_number && transaction.purchase_platform && (() => {
                    const platformName = transaction.purchase_platform?.name || '';
                    const orderNum = transaction.order_number || '';
                    let orderUrl: string | null = null;
                    let platformLabel = platformName;
                    if (platformName === 'Amazon') {
                      orderUrl = `https://www.amazon.co.jp/gp/your-account/order-details?orderID=${orderNum}`;
                    } else if (platformName === '楽天市場') {
                      orderUrl = `https://order.my.rakuten.co.jp/`;
                      platformLabel = '乐天市场';
                    } else if (platformName === 'Yahoo!ショッピング') {
                      orderUrl = `https://odhistory.shopping.yahoo.co.jp/order-history/details`;
                      platformLabel = 'Yahoo!购物';
                    }
                    return orderUrl ? (
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--color-text-muted)]">订单历史</span>
                        <a
                          href={orderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-primary)] hover:underline text-sm flex items-center gap-1"
                        >
                          在{platformLabel}查看
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    ) : null;
                  })()}
                  {transaction.unit_price && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">单价</span>
                      <span className="text-[var(--color-text)] font-mono">{formatCurrency(transaction.unit_price)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 复购链接 */}
            <div className="sn-detail-card">
              <h2 className="sn-detail-title-lg">
                <div className="sn-form-title-bar"></div>
                复购
              </h2>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const searchQuery = transaction.jan_code || transaction.product_name;
                  const encodedQuery = encodeURIComponent(searchQuery);
                  const links = [
                    { name: 'Amazon', url: `https://www.amazon.co.jp/s?k=${encodedQuery}`, color: 'bg-[rgba(245,158,11,0.1)] text-[var(--color-warning)] border-[rgba(245,158,11,0.3)]' },
                    { name: '乐天', url: `https://search.rakuten.co.jp/search/mall/${encodedQuery}/`, color: 'bg-[rgba(239,68,68,0.1)] text-[var(--color-danger)] border-[rgba(239,68,68,0.3)]' },
                    { name: 'Yahoo!', url: `https://shopping.yahoo.co.jp/search?p=${encodedQuery}`, color: 'bg-[rgba(59,130,246,0.1)] text-[var(--color-info)] border-[rgba(59,130,246,0.3)]' },
                    { name: 'Mercari', url: `https://jp.mercari.com/search?keyword=${encodedQuery}`, color: 'bg-[rgba(239,68,68,0.1)] text-[var(--color-danger)] border-[rgba(239,68,68,0.3)]' },
                    { name: '雅虎拍卖', url: `https://auctions.yahoo.co.jp/search/search?p=${encodedQuery}`, color: 'bg-[rgba(245,158,11,0.1)] text-[var(--color-warning)] border-[rgba(245,158,11,0.3)]' },
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
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  JAN 码 ({transaction.jan_code}) 搜索
                </p>
              )}
            </div>

            

            {/* 备注 */}
            {transaction.notes && (
              <div className="sn-detail-card">
                <h2 className="sn-detail-title-lg">
                  <div className="sn-form-title-bar"></div>
                  备注
                </h2>
                <p className="text-[var(--color-text)] whitespace-pre-wrap">{transaction.notes}</p>
              </div>
            )}
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-6">
            {/* 批量商品的库存信息 */}
            {transaction.quantity > 1 && (
              <div className="sn-detail-card">
                <h3 className="sn-detail-title">库存信息</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-text-muted)]">总数量</span>
                    <span className="text-[var(--color-text)] font-medium">{transaction.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-text-muted)]">已售出</span>
                    <span className="text-[var(--color-primary)] font-medium">{transaction.quantity_sold}</span>
                  </div>
                  {transaction.quantity_returned > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-text-muted)]">已退货</span>
                      <span className="text-[var(--color-danger)] font-medium">{transaction.quantity_returned}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-text-muted)]">库存</span>
                    <span className="text-[var(--color-primary)] font-bold text-lg">{transaction.quantity_in_stock}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 销售记录列表 */}
            {transaction.quantity_sold > 0 && (
              <div className="sn-detail-card">
                <h3 className="sn-detail-title">销售记录</h3>
                <SalesRecordsList
                  transactionId={transaction.id}
                  transaction={transaction}
                  onUpdate={loadTransaction}
                />
              </div>
            )}

            {/* 退货记录列表 */}
            {transaction.quantity_returned > 0 && (
              <div className="sn-detail-card border-[rgba(239,68,68,0.25)]">
                <h3 className="text-lg font-semibold text-[var(--color-danger)] mb-4">退货记录</h3>
                <ReturnRecordsList
                  transactionId={transaction.id}
                  onUpdate={loadTransaction}
                />
              </div>
            )}

            {/* 凭证图片 */}
            {transaction.image_url && (
              <div className="sn-detail-card">
                <h3 className="sn-detail-title">采购凭证</h3>
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[var(--color-header)]">
                  <Image
                    src={transaction.image_url}
                    alt="采购凭证"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            )}
{/* 预期积分 */}
            <div className="sn-detail-card">
              <h2 className="sn-detail-title-lg">
                <div className="sn-form-title-bar"></div>
                预期积分
              </h2>
              <div className="space-y-3">
                {/* 平台积分 */}
                <div className="bg-[rgba(245,158,11,0.1)] rounded-xl p-4 border border-[rgba(245,158,11,0.3)]">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[var(--color-warning)] text-sm mb-1">平台积分</div>
                      <div className="text-2xl font-bold text-[var(--color-warning)]">{transaction.expected_platform_points} P</div>
                    </div>
                    {transaction.platform_points_platform && (
                      <div className="text-right">
                        <div className="text-xs text-[var(--color-warning)] opacity-90">{transaction.platform_points_platform.display_name}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 额外平台积分 */}
                {transaction.extra_platform_points > 0 && (
                  <div className="bg-[var(--color-primary-light)] rounded-xl p-4 border border-[var(--color-primary)]/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[var(--color-primary)] text-sm mb-1">额外积分</div>
                        <div className="text-2xl font-bold text-[var(--color-primary)]">{transaction.extra_platform_points} P</div>
                      </div>
                      {transaction.extra_platform_points_platform && (
                        <div className="text-right">
                          <div className="text-xs text-[var(--color-primary)]">{transaction.extra_platform_points_platform.display_name}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 信用卡积分 */}
                <div className="bg-[var(--color-primary-light)] rounded-xl p-4 border border-[var(--color-primary)]/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[var(--color-primary)] text-sm mb-1">信用卡积分</div>
                      <div className="text-2xl font-bold text-[var(--color-primary)]">{transaction.expected_card_points} P</div>
                    </div>
                    {transaction.card_points_platform && (
                      <div className="text-right">
                        <div className="text-xs text-[var(--color-primary)] opacity-70">{transaction.card_points_platform.display_name}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* 支付信息 */}
            {transaction.payment_method && (
              <div className="sn-detail-card">
                <h3 className="sn-detail-title">支付方式</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-text-muted)]">卡片名称</span>
                    <span className="text-[var(--color-text)] font-medium">{transaction.payment_method.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-text-muted)]">返点率</span>
                    <span className="text-[var(--color-primary)] font-medium">{(transaction.payment_method.point_rate * 100).toFixed(2)}%</span>
                  </div>
                  {calculatedPaymentDate && (
                    <>
                      <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                        <span className="text-[var(--color-text-muted)]">预计还款日</span>
                        <span className="text-[var(--color-text)] font-medium">
                          {calculatedPaymentDate}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 时间信息 */}
            <div className="sn-detail-card">
              <h3 className="sn-detail-title">时间信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">创建时间</span>
                  <span className="text-[var(--color-text)]">
                    {new Date(transaction.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">更新时间</span>
                  <span className="text-[var(--color-text)]">
                    {new Date(transaction.updated_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>

            {/* 编辑历史 */}
            {history.length > 0 && (
              <div className="sn-detail-card">
                <h3 className="sn-detail-title">
                  <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  编辑历史
                </h3>
                <div className="space-y-4">
                  {history.map((entry) => {
                    const changedFields = Object.keys(entry.new_values);
                    return (
                      <div key={entry.id} className="relative pl-5 border-l-2 border-[var(--color-border)]">
                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-[var(--color-border)]" />
                        <p className="text-xs text-[var(--color-text-muted)] mb-1.5">
                          {new Date(entry.changed_at).toLocaleString('zh-CN', {
                            month: 'numeric', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                        <div className="space-y-1">
                          {changedFields.map((field) => (
                            <div key={field} className="text-xs">
                              <span className="text-[var(--color-text-muted)] font-medium">
                                {FIELD_LABELS[field] || field}
                              </span>
                              <span className="text-[var(--color-text-muted)] mx-1">:</span>
                              <span className="text-[var(--color-danger)] line-through">
                                {formatHistoryValue(field, entry.old_values[field])}
                              </span>
                              <span className="text-[var(--color-text-muted)] mx-1">→</span>
                              <span className="text-[var(--color-primary)]">
                                {formatHistoryValue(field, entry.new_values[field])}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showToast && <Toast message="已复制到剪贴板" onClose={() => setShowToast(false)} />}
    </div>
  );
}
