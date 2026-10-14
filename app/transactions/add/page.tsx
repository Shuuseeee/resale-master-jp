'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { TransactionFormData } from '@/types/database.types';
import { useRouter, useSearchParams } from 'next/navigation';
import { layout, heading, button } from '@/lib/theme';
import PageSkeleton from '@/components/Skeleton';
import PageHeader from '@/components/shell/PageHeader';
import BarcodeScanner from '@/components/BarcodeScanner';
import { loadAmazonPointConfig } from '@/lib/amazon-point-config';
import { useTransactionForm } from '@/hooks/useTransactionForm';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import Spinner from '@/components/fluent/Spinner';
import MessageBar from '@/components/fluent/MessageBar';
import { ConfirmModal, UNSAVED_CHANGES_CONFIRM } from '@/components/Modal';
import { TransactionFormFields } from '@/components/TransactionForm';

/** 运费 / 优惠券为 0 时不提交该列（库默认 0），兼容「代码先部署、库还没加列」 */
// 运费 / 优惠券为 0、账号为空时不提交（兼容「代码先部署、库还没加列」）
function withoutZeroShipping(fd: TransactionFormData) {
  const { shipping_fee, coupon_amount, purchase_account, ...rest } = fd;
  const account = purchase_account?.trim();
  return {
    ...rest,
    ...(shipping_fee ? { shipping_fee } : {}),
    ...(coupon_amount ? { coupon_amount } : {}),
    ...(account ? { purchase_account: account } : {}),
  };
}

function AddTransactionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyId = searchParams.get('copy');
  const [copyData, setCopyData] = useState<Partial<TransactionFormData>>();
  // 复制源的读取状态：首次读取时显示骨架屏（避免先填的内容被随后到达的数据覆盖），失败时提示
  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'error'>(copyId ? 'loading' : 'idle');

  // Stable Amazon config (read once from localStorage)
  const amazonConfig = useMemo(() => loadAmazonPointConfig(), []);

  // Load copy source data
  useEffect(() => {
    if (!copyId) return;

    setCopyStatus('loading');
    (async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', copyId)
        .single();

      if (error || !data) {
        setCopyStatus('error');
        return;
      }

      setCopyStatus('idle');
      // 不复制：日期（直接打开 = 今天，「保存并继续添加」= 沿用上一笔）、订单号、收据（新的一笔各自不同）
      setCopyData({
        product_name: data.product_name,
        quantity: data.quantity,
        purchase_price_total: data.purchase_price_total,
        card_paid: data.card_paid,
        point_paid: data.point_paid,
        balance_paid: data.balance_paid,
        card_id: data.card_id || '',
        expected_platform_points: data.expected_platform_points,
        expected_card_points: data.expected_card_points,
        extra_platform_points: data.extra_platform_points,
        platform_points_platform_id: data.platform_points_platform_id || '',
        card_points_platform_id: data.card_points_platform_id || '',
        extra_platform_points_platform_id: data.extra_platform_points_platform_id || '',
        jan_code: data.jan_code || '',
        unit_price: data.unit_price || 0,
        shipping_fee: data.shipping_fee ?? 0,
        coupon_amount: data.coupon_amount ?? 0,
        purchase_platform_id: data.purchase_platform_id || '',
        purchase_account: data.purchase_account || '',
        notes: data.notes || '',
        order_number: '',
        image_url: '',
      });
    })();
  }, [copyId]);

  const form = useTransactionForm({
    mode: 'create',
    initialData: copyData,
    initialIsPending: true,
    amazonConfig,
    onPersist: async ({ formData: fd, isPending, imageUrl, continueAdding }) => {
      const { data: newRecord, error } = await supabase
        .from('transactions')
        .insert([{
          ...withoutZeroShipping(fd),
          status: isPending ? 'pending' : 'in_stock',
          image_url: imageUrl || null,
          card_id: fd.card_id || null,
          platform_points_platform_id: fd.platform_points_platform_id || null,
          card_points_platform_id: fd.card_points_platform_id || null,
          extra_platform_points: fd.extra_platform_points || 0,
          extra_platform_points_platform_id: fd.extra_platform_points_platform_id || null,
          jan_code: fd.jan_code || null,
          unit_price: fd.unit_price || null,
          purchase_platform_id: fd.purchase_platform_id || null,
          order_number: fd.order_number || null,
        }])
        .select()
        .single();

      if (error) throw error;

      // Fire-and-forget: seed JAN → product_name into cache
      const jan = fd.jan_code?.trim();
      const pName = fd.product_name?.trim();
      if (jan && /^\d+$/.test(jan) && pName) {
        fetch(`/api/jan-product/${jan}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_name: pName }),
        }).catch(() => {});
      }

      // Fire-and-forget: JAN 有效 → 按 JAN 入队，scraper 抓 1-chome 主图存共享缓存
      // （JAN 维度去重，同 JAN 已缓存/已在队列则 RPC 内部跳过）
      if (jan && /^\d{8,13}$/.test(jan)) {
        fetch('/api/thumbnail/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jan }),
        }).catch(() => {});
      }

      if (continueAdding && newRecord) {
        router.push(`/transactions/add?copy=${newRecord.id}`);
      } else {
        router.push('/transactions');
      }
    },
  });

  // 有未保存的修改时，离开页面前确认（导航、面包屑、返回 / 取消、关闭标签页）
  const leaveGuard = useLeaveGuard(form.isDirty && !form.isSubmitting);

  // 「保存并继续添加」时页面不会重新挂载：上一笔选的收据图片要清掉，免得被上传到下一笔
  const { clearImage } = form;
  useEffect(() => {
    if (copyId) clearImage();
  }, [copyId, clearImage]);

  if (copyStatus === 'loading' && !copyData) {
    return <PageSkeleton />;
  }

  return (
    <div className={layout.page}>
      <PageHeader crumbs={[{ label: '交易列表', href: '/transactions' }, { label: '记录新交易' }]} />
      <div className={"relative max-w-2xl mx-auto px-4 py-8 " + layout.narrowDesktop}>
        {/* Header（桌面用文档头的面包屑返回） */}
        <div className={layout.section + ' md:mb-0'}>
          <button
            onClick={() => leaveGuard.requestLeave(() => router.back())}
            className={button.ghost + ' flex items-center gap-2 mb-4 md:hidden'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回</span>
          </button>

          <h1 className={heading.page}>记录新交易</h1>
        </div>

        {copyStatus === 'error' && (
          <div className="mb-6">
            <MessageBar intent="warning">读取要复制的交易失败，已打开空白表单。</MessageBar>
          </div>
        )}

        {/* Form */}
        <form ref={form.formRef} onSubmit={form.handleSubmit} className="space-y-6">
          <TransactionFormFields form={form} />

          {/* Submit error */}
          {form.errors.submit && (
            <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-danger-border)] bg-[var(--color-danger-subtle)]">
              <p className="text-sm text-[var(--color-danger)]">{form.errors.submit}</p>
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={form.isSubmitting}
              className={button.primary + ' flex-1 max-md:py-3'}
            >
              {form.isSubmitting && !form.continueAdding ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  保存中...
                </span>
              ) : (
                '保存'
              )}
            </button>
            <button
              type="button"
              disabled={form.isSubmitting}
              onClick={form.triggerSubmitAndContinue}
              className={button.secondary + ' flex-1 max-md:py-3'}
            >
              {form.isSubmitting && form.continueAdding ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  保存中...
                </span>
              ) : (
                '保存并继续添加'
              )}
            </button>
            <button
              type="button"
              onClick={() => leaveGuard.requestLeave(() => router.back())}
              className={button.secondary + ' max-md:py-3'}
            >
              取消
            </button>
          </div>
        </form>
      </div>
      <ConfirmModal
        isOpen={leaveGuard.showConfirm}
        onClose={leaveGuard.cancelLeave}
        onConfirm={leaveGuard.confirmLeave}
        title={UNSAVED_CHANGES_CONFIRM.title}
        message={UNSAVED_CHANGES_CONFIRM.message}
        confirmText={UNSAVED_CHANGES_CONFIRM.confirmText}
        cancelText={UNSAVED_CHANGES_CONFIRM.cancelText}
      />
      {form.showScanner && (
        <BarcodeScanner
          onDetected={(code) => {
            form.setFormData(prev => ({ ...prev, jan_code: code }));
            form.setShowScanner(false);
          }}
          onClose={() => form.setShowScanner(false)}
        />
      )}
    </div>
  );
}

export default function AddTransactionPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AddTransactionPageContent />
    </Suspense>
  );
}
