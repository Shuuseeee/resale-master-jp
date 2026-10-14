// app/transactions/[id]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Transaction, PaymentMethod, PointsPlatform, PurchasePlatform } from '@/types/database.types';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import { confirmPaymentReceived } from '@/lib/api/financial';
import { notArrivedQty, sellableQty } from '@/lib/utils/arrivals';
import ArrivalsPanel from '@/components/transactions/ArrivalsPanel';
import Image from 'next/image';
import Link from 'next/link';
import { button, card, heading, layout } from '@/lib/theme';
import { TransactionStatusBadge } from '@/components/transactions/StatusBadge';
import { Open16Regular } from '@fluentui/react-icons/headless/svg/open';
import PageSkeleton from '@/components/Skeleton';
import BatchSaleForm from '@/components/BatchSaleForm';
import SalesRecordsList from '@/components/SalesRecordsList';
import ReturnRecordsList from '@/components/ReturnRecordsList';
import ReturnForm from '@/components/ReturnForm';
import Modal, { ConfirmModal, UNSAVED_CHANGES_CONFIRM } from '@/components/Modal';
import { useModalCloseGuard } from '@/hooks/useModalCloseGuard';
import Toast from '@/components/Toast';
import { ArrowCounterclockwise20Filled, ArrowCounterclockwise20Regular } from '@fluentui/react-icons/headless/svg/arrow-counterclockwise';
import { ArrowUndo20Filled, ArrowUndo20Regular } from '@fluentui/react-icons/headless/svg/arrow-undo';
import { Copy20Filled, Copy20Regular } from '@fluentui/react-icons/headless/svg/copy';
import { Delete20Filled, Delete20Regular } from '@fluentui/react-icons/headless/svg/delete';
import { Edit20Filled, Edit20Regular } from '@fluentui/react-icons/headless/svg/edit';
import { MoneyHand20Filled, MoneyHand20Regular } from '@fluentui/react-icons/headless/svg/money-hand';
import { ReceiptMoney20Filled, ReceiptMoney20Regular } from '@fluentui/react-icons/headless/svg/receipt-money';
import PageHeader, { type PageAction } from '@/components/shell/PageHeader';
import { formatPointRate, paymentMethodDisplayName } from '@/lib/utils/paymentMethods';

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
  shipping_fee: '运费',
  coupon_amount: '优惠券',
  quantity: '数量',
  card_paid: '信用卡 / 其他支付',
  point_paid: '积分抵扣',
  balance_paid: '余额支付',
  expected_platform_points: '平台积分',
  expected_card_points: '支付返点积分',
  extra_platform_points: '额外积分',
  jan_code: 'JAN 码',
  order_number: '订单号',
  purchase_account: '账号',
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
  if (['purchase_price_total', 'unit_price', 'shipping_fee', 'coupon_amount', 'card_paid', 'point_paid', 'balance_paid',
    'expected_platform_points', 'expected_card_points', 'extra_platform_points'].includes(field)) {
    return `¥${Number(value).toLocaleString()}`;
  }
  return String(value);
}

/** 详情卡片里的一行：左标签（可带小字说明），右数值 */
function DetailRow({ label, value, hint, strong = false }: { label: string; value: string; hint?: string | null; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-[var(--color-text-secondary)]">
        {label}
        {hint && <span className="ml-1.5 text-xs text-[var(--color-text-muted)]">{hint}</span>}
      </dt>
      <dd className={`shrink-0 text-right tabular-nums text-[var(--color-text)] ${strong ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  );
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
  const [showReturnForm, setShowReturnForm] = useState(false); // 退货表单
  const [salesListKey, setSalesListKey] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastText, setToastText] = useState('已复制到剪贴板');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setToastText('已复制到剪贴板');
      setShowToast(true);
    });
  };


  const closeReturn = useCallback(() => setShowReturnForm(false), []);
  const closeSale = useCallback(() => setShowSaleForm(false), []);
  const returnGuard = useModalCloseGuard(closeReturn);
  const saleGuard = useModalCloseGuard(closeSale);

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
      if (autoSale && data && data.status === 'in_stock') {
        setShowSaleForm(true);
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

  const confirmPayment = async () => {
    if (!transaction) return;
    const success = await confirmPaymentReceived(transaction.id);
    if (success) {
      setTransaction({ ...transaction, status: 'sold' });
      setSalesListKey(k => k + 1); // 名下出售都标成了已入账，销售记录重新读
    } else {
      alert('入金确认失败');
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (!transaction) {
    return null;
  }

  // 只能出售已到货的数量（分批到货，lib/utils/arrivals.ts）
  const canSell = !showSaleForm && sellableQty(transaction) > 0;
  const canReturn = transaction.quantity_in_stock > 0 && !showReturnForm;
  const canCancelSale = transaction.status === 'sold' || transaction.status === 'awaiting_payment';
  // 桌面文档头：流程操作里第一个适用的做品牌主按钮（Loop 工具栏最多一个），其余与编辑 / 复制 / 删除等为图标按钮
  const workflowActions: PageAction[] = [
    ...(transaction.status === 'awaiting_payment'
      ? [{ id: 'paid', label: '确认入账', icon: { regular: MoneyHand20Regular, filled: MoneyHand20Filled }, onClick: confirmPayment }]
      : []),
    ...(canSell ? [{ id: 'sell', label: '记录销售', icon: { regular: ReceiptMoney20Regular, filled: ReceiptMoney20Filled }, onClick: () => setShowSaleForm(true) }] : []),
  ];
  const [primaryWorkflow, ...otherWorkflow] = workflowActions;
  const headerActions: PageAction[] = [
    ...otherWorkflow.map((action, i) => ({ ...action, priority: 2 + i })),
    ...(canReturn ? [{ id: 'return', label: '退货', icon: { regular: ArrowUndo20Regular, filled: ArrowUndo20Filled }, onClick: () => setShowReturnForm(true), priority: 4 }] : []),
    ...(canCancelSale
      ? [{ id: 'cancel-sale', label: '取消销售', icon: { regular: ArrowCounterclockwise20Regular, filled: ArrowCounterclockwise20Filled }, onClick: cancelSale, priority: 5 }]
      : []),
    { id: 'edit', label: '编辑', icon: { regular: Edit20Regular, filled: Edit20Filled }, href: `/transactions/${id}/edit`, priority: 1 },
    { id: 'copy', label: '复制为新交易', icon: { regular: Copy20Regular, filled: Copy20Filled }, href: `/transactions/add?copy=${id}`, priority: 7 },
    { id: 'delete', label: '删除', icon: { regular: Delete20Regular, filled: Delete20Filled }, onClick: deleteTransaction, priority: 8 },
    ...(primaryWorkflow ? [{ ...primaryWorkflow, primary: true, priority: 0 }] : []),
  ];

  // 关键数字（与库里的利润口径一致：单位成本 =（采购总价 − 全部积分）÷ 数量）
  const pointsTotal = (transaction.expected_platform_points || 0) + (transaction.expected_card_points || 0) + (transaction.extra_platform_points || 0);
  const unitCost = transaction.quantity > 0 ? (transaction.purchase_price_total - pointsTotal) / transaction.quantity : 0;
  const unitPrice = transaction.unit_price ?? Math.round((transaction.purchase_price_total - (transaction.shipping_fee || 0)) / Math.max(transaction.quantity, 1));
  const showArrivals = (transaction.quantity > 1 || transaction.status === 'pending') && (transaction.status === 'pending' || transaction.status === 'in_stock');
  const hasProgress = showArrivals || transaction.quantity_returned > 0 || !!transaction.notes;

  // 订单历史链接（按采购平台）
  const orderHistory = (() => {
    const platform = transaction.purchase_platform?.name;
    if (!transaction.order_number || !platform) return null;
    if (platform === 'Amazon') return { url: `https://www.amazon.co.jp/gp/your-account/order-details?orderID=${transaction.order_number}`, label: 'Amazon' };
    if (platform === '楽天市場') return { url: 'https://order.my.rakuten.co.jp/', label: '乐天市场' };
    if (platform === 'Yahoo!ショッピング') return { url: 'https://odhistory.shopping.yahoo.co.jp/order-history/details', label: 'Yahoo!购物' };
    return null;
  })();

  const purchaseDetail = (
    <div className="sn-detail-card">
      <h2 className="sn-detail-title">采购明细</h2>
      <dl className="space-y-2.5 text-sm">
        <DetailRow label="单价" value={formatCurrency(unitPrice)} />
        <DetailRow label="数量" value={String(transaction.quantity)} />
        {!!transaction.shipping_fee && <DetailRow label="运费" value={formatCurrency(transaction.shipping_fee)} />}
        {!!transaction.coupon_amount && <DetailRow label="已用优惠券" hint="单价已扣" value={formatCurrency(transaction.coupon_amount)} />}
        <div className="border-t border-[var(--color-border)] pt-2.5">
          <DetailRow label="采购总价" value={formatCurrency(transaction.purchase_price_total)} strong />
        </div>
      </dl>
      <h3 className="mb-2.5 mt-5 text-sm font-semibold text-[var(--color-text)]">支付</h3>
      <dl className="space-y-2.5 text-sm">
        {transaction.payment_method && (
          <DetailRow
            label="支付方式"
            value={paymentMethodDisplayName(transaction.payment_method)}
            hint={`返点 ${formatPointRate(transaction.payment_method.point_rate)}`}
          />
        )}
        <DetailRow label="信用卡 / 其他支付" value={formatCurrency(transaction.card_paid)} />
        <DetailRow label="积分抵扣" value={formatCurrency(transaction.point_paid)} />
        <DetailRow label="余额支付" value={formatCurrency(transaction.balance_paid)} />
      </dl>
    </div>
  );

  return (
    <div className={layout.page}>
      <PageHeader crumbs={[{ label: '交易列表', href: '/transactions' }, { label: transaction.product_name }]} actions={headerActions} />
      <div className={'relative mx-auto max-w-lg px-4 py-6 ' + layout.narrowDesktop}>
        {/* 标题（桌面的返回在文档头面包屑、操作在文档头工具栏） */}
        <div className="mb-6 md:mb-0">
          <button
            onClick={() => router.back()}
            className={button.ghost + ' mb-4 flex items-center gap-2 md:hidden'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回</span>
          </button>

          <h1 className={heading.page + ' line-clamp-3 break-cjk-normal md:line-clamp-none md:!mb-3'}>{transaction.product_name}</h1>
          {/* 一行概要：状态 · 进货日 · 采购平台 · JAN（点击复制） */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[var(--color-text-secondary)]">
            <TransactionStatusBadge tx={transaction} />
            <span className="whitespace-nowrap">{transaction.date.replace(/-/g, '/')}</span>
            {transaction.purchase_platform && <span className="whitespace-nowrap">{transaction.purchase_platform.name}</span>}
            {transaction.jan_code && (
              <button
                type="button"
                onClick={() => copyToClipboard(transaction.jan_code!)}
                className="font-mono hover:text-[var(--color-primary)]"
                title="点击复制 JAN"
              >
                JAN {transaction.jan_code}
              </button>
            )}
          </div>

          {/* 操作按钮（手机；桌面在文档头工具栏） */}
          <div className="mt-4 flex flex-wrap items-center gap-2 md:hidden">
            {canSell && (
              <button onClick={() => setShowSaleForm(true)} className={button.primary + ' gap-1.5 whitespace-nowrap'}>
                <ReceiptMoney20Regular />
                记录销售
              </button>
            )}
            {transaction.status === 'awaiting_payment' && (
              <button onClick={confirmPayment} className={button.primary + ' gap-1.5 whitespace-nowrap'}>
                <MoneyHand20Regular />
                确认入账
              </button>
            )}
            {canReturn && (
              <button onClick={() => setShowReturnForm(true)} className={button.secondary + ' gap-1.5 whitespace-nowrap'}>
                <ArrowUndo20Regular />
                退货
              </button>
            )}
            {canCancelSale && (
              <button onClick={cancelSale} className={button.secondary + ' gap-1.5 whitespace-nowrap'}>
                <ArrowCounterclockwise20Regular />
                取消销售
              </button>
            )}
            {/* 编辑 / 复制 / 删除放一组靠右，放不下时整组换行（不会只剩一个删除掉到下一行） */}
            <div className="ml-auto flex items-center gap-2">
            <Link href={`/transactions/${id}/edit`} className="sn-icon-button" title="编辑" aria-label="编辑">
              <Edit20Regular />
            </Link>
            <Link href={`/transactions/add?copy=${id}`} className="sn-icon-button" title="复制为新交易" aria-label="复制为新交易">
              <Copy20Regular />
            </Link>
            <button
              onClick={deleteTransaction}
              className="sn-icon-button text-[var(--color-danger)] hover:border-[var(--color-danger-border)] hover:bg-[var(--color-danger-subtle)]"
              title="删除"
              aria-label="删除"
            >
              <Delete20Regular />
            </button>
            </div>
          </div>
        </div>

        <Modal
          isOpen={showReturnForm}
          onClose={returnGuard.doClose}
          beforeClose={returnGuard.handleCloseRequest}
          closeOnEsc={!returnGuard.showConfirm}
          closeOnOverlayClick={!returnGuard.showConfirm}
          title="记录退货"
          size="lg"
        >
          <ReturnForm
            transaction={transaction}
            onSuccess={handleReturnSuccess}
            onCancel={returnGuard.doClose}
            onDirtyChange={returnGuard.setIsDirty}
          />
        </Modal>

        <Modal
          isOpen={showSaleForm}
          onClose={saleGuard.doClose}
          beforeClose={saleGuard.handleCloseRequest}
          closeOnEsc={!saleGuard.showConfirm}
          closeOnOverlayClick={!saleGuard.showConfirm}
          title="记录销售"
          size="lg"
        >
          <BatchSaleForm
            transaction={transaction}
            onSuccess={() => {
              setShowSaleForm(false);
              loadTransaction();
            }}
            onDataRefresh={loadTransaction}
            onCancel={saleGuard.doClose}
            onDirtyChange={saleGuard.setIsDirty}
          />
        </Modal>

        <ConfirmModal
          isOpen={returnGuard.showConfirm}
          onClose={returnGuard.cancelConfirm}
          onConfirm={returnGuard.doClose}
          title={UNSAVED_CHANGES_CONFIRM.title}
          message={UNSAVED_CHANGES_CONFIRM.message}
          confirmText={UNSAVED_CHANGES_CONFIRM.confirmText}
          cancelText={UNSAVED_CHANGES_CONFIRM.cancelText}
        />
        <ConfirmModal
          isOpen={saleGuard.showConfirm}
          onClose={saleGuard.cancelConfirm}
          onConfirm={saleGuard.doClose}
          title={UNSAVED_CHANGES_CONFIRM.title}
          message={UNSAVED_CHANGES_CONFIRM.message}
          confirmText={UNSAVED_CHANGES_CONFIRM.confirmText}
          cancelText={UNSAVED_CHANGES_CONFIRM.cancelText}
        />

        {/* 正文按内容区宽度（不是窗口宽度）排版：分区抽屉开着时内容区可能只有 600 左右（globals.css .sn-detail-layout） */}
        <div className="sn-detail-layout space-y-6">
          {/* 关键数字 */}
          <div className="sn-detail-stats">
            <div className={card.stat}>
              <div className="text-xs text-[var(--color-text-secondary)]">采购总价</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)]">{formatCurrency(transaction.purchase_price_total)}</div>
              <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {formatCurrency(unitPrice)} × {transaction.quantity}
                {!!transaction.shipping_fee && ` + 运费 ${formatCurrency(transaction.shipping_fee)}`}
              </div>
            </div>
            <div className={card.stat}>
              <div className="text-xs text-[var(--color-text-secondary)]">单位成本</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)]">{formatCurrency(unitCost)}</div>
              <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">已扣积分 {pointsTotal.toLocaleString('ja-JP')} P</div>
            </div>
            <div className={card.stat}>
              <div className="text-xs text-[var(--color-text-secondary)]">确定利润</div>
              {transaction.total_profit == null ? (
                <>
                  <div className="mt-1 text-xl font-semibold text-[var(--color-text-muted)]">—</div>
                  <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">尚未出售</div>
                </>
              ) : (
                <>
                  <div
                    className="mt-1 text-xl font-semibold tabular-nums"
                    style={{ color: transaction.total_profit >= 0 ? 'var(--chart-up)' : 'var(--chart-down)' }}
                  >
                    {transaction.total_profit >= 0 ? '+' : ''}{formatCurrency(transaction.total_profit)}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">利润率 {formatROI(transaction.roi)}</div>
                </>
              )}
            </div>
            <div className={card.stat}>
              <div className="text-xs text-[var(--color-text-secondary)]">库存</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)]">
                {transaction.quantity_in_stock}
                <span className="text-sm font-normal text-[var(--color-text-muted)]"> / {transaction.quantity}</span>
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                已售 {transaction.quantity_sold}
                {transaction.quantity_returned > 0 && ` · 退货 ${transaction.quantity_returned}`}
                {notArrivedQty(transaction) > 0 && ` · 未到 ${notArrivedQty(transaction)}`}
              </div>
            </div>
          </div>

          {/* 销售记录是多列表格，放整宽 */}
          {transaction.quantity_sold > 0 && (
            <div className="sn-detail-card">
              <h2 className="sn-detail-title">销售记录</h2>
              <SalesRecordsList key={salesListKey} transactionId={transaction.id} transaction={transaction} onUpdate={loadTransaction} />
            </div>
          )}

          <div className="sn-detail-columns">
            {/* 左：这笔货的进展（到货 / 退货 / 备注） */}
            <div className="space-y-6">
              {showArrivals && (
                <ArrivalsPanel transaction={transaction} onChange={loadTransaction} />
              )}

              {transaction.quantity_returned > 0 && (
                <div className="sn-detail-card">
                  <h2 className="sn-detail-title">退货记录</h2>
                  <ReturnRecordsList transactionId={transaction.id} onUpdate={loadTransaction} />
                </div>
              )}

              {transaction.notes && (
                <div className="sn-detail-card">
                  <h2 className="sn-detail-title">备注</h2>
                  <p className="whitespace-pre-wrap text-sm text-[var(--color-text)]">{transaction.notes}</p>
                </div>
              )}

              {/* 没有进展类内容时（单件、已到货、未出售）左列为空：采购明细放这里，避免一边空着 */}
              {!hasProgress && purchaseDetail}
            </div>

            {/* 右：采购明细 / 预期积分 / 订单 / 凭证 */}
            <div className="space-y-6">
              {hasProgress && purchaseDetail}

              <div className="sn-detail-card">
                <h2 className="sn-detail-title">预期积分</h2>
                <dl className="space-y-2.5 text-sm">
                  <DetailRow label="平台积分" hint={transaction.platform_points_platform?.display_name} value={`${transaction.expected_platform_points.toLocaleString('ja-JP')} P`} />
                  {transaction.extra_platform_points > 0 && (
                    <DetailRow label="额外积分" hint={transaction.extra_platform_points_platform?.display_name} value={`${transaction.extra_platform_points.toLocaleString('ja-JP')} P`} />
                  )}
                  <DetailRow label="支付返点" hint={transaction.card_points_platform?.display_name} value={`${transaction.expected_card_points.toLocaleString('ja-JP')} P`} />
                  <div className="border-t border-[var(--color-border)] pt-2.5">
                    <DetailRow label="合计" value={`${pointsTotal.toLocaleString('ja-JP')} P`} strong />
                  </div>
                </dl>
              </div>

              {(transaction.order_number || transaction.purchase_account) && (
                <div className="sn-detail-card">
                  <h2 className="sn-detail-title">订单</h2>
                  <dl className="space-y-2.5 text-sm">
                    {transaction.purchase_account && (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-[var(--color-text-secondary)]">账号</dt>
                        <dd className="break-all text-right text-[var(--color-text)]">{transaction.purchase_account}</dd>
                      </div>
                    )}
                    {transaction.order_number && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[var(--color-text-secondary)]">订单号</dt>
                      <dd>
                        <button
                          onClick={() => copyToClipboard(transaction.order_number!)}
                          className="break-all text-right font-mono text-[var(--color-text)] hover:text-[var(--color-primary)]"
                          title="点击复制"
                        >
                          {transaction.order_number}
                        </button>
                      </dd>
                    </div>
                    )}
                    {orderHistory && (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-[var(--color-text-secondary)]">订单历史</dt>
                        <dd>
                          <a href={orderHistory.url} target="_blank" rel="noopener noreferrer" className="fluent-link inline-flex items-center gap-1">
                            在{orderHistory.label}查看
                            <Open16Regular />
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {transaction.image_url && (
                <div className="sn-detail-card">
                  <h2 className="sn-detail-title">采购凭证</h2>
                  <a href={transaction.image_url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]">
                    <Image src={transaction.image_url} alt="采购凭证" fill className="object-contain" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 编辑历史 + 创建 / 更新时间 */}
          {history.length > 0 && (
            <div className="sn-detail-card">
              <h2 className="sn-detail-title">编辑历史</h2>
              <div className="space-y-4">
                {history.map((entry) => {
                  const changedFields = Object.keys(entry.new_values);
                  return (
                    <div key={entry.id} className="relative border-l-2 border-[var(--color-border)] pl-5">
                      <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[var(--color-border)]" />
                      <p className="mb-1.5 text-xs text-[var(--color-text-muted)]">
                        {new Date(entry.changed_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="space-y-1">
                        {changedFields.map((field) => (
                          <div key={field} className="text-xs">
                            <span className="font-medium text-[var(--color-text-muted)]">{FIELD_LABELS[field] || field}</span>
                            <span className="mx-1 text-[var(--color-text-muted)]">:</span>
                            <span className="text-[var(--color-danger)] line-through">{formatHistoryValue(field, entry.old_values[field])}</span>
                            <span className="mx-1 text-[var(--color-text-muted)]">→</span>
                            <span className="text-[var(--color-primary)]">{formatHistoryValue(field, entry.new_values[field])}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <p className="text-xs text-[var(--color-text-muted)]">
            创建于 {new Date(transaction.created_at).toLocaleString('zh-CN')} · 更新于 {new Date(transaction.updated_at).toLocaleString('zh-CN')}
          </p>
        </div>
      </div>
      {showToast && <Toast message={toastText} onClose={() => setShowToast(false)} />}
    </div>
  );
}
