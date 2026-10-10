'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { TransactionFormData, Transaction } from '@/types/database.types';
import { layout, heading, button } from '@/lib/theme';
import PageSkeleton from '@/components/Skeleton';
import PageHeader from '@/components/shell/PageHeader';
import BarcodeScanner from '@/components/BarcodeScanner';
import { usePlatforms } from '@/contexts/PlatformsContext';
import { useTransactionForm } from '@/hooks/useTransactionForm';
import Spinner from '@/components/fluent/Spinner';
import {
  BasicInfoSection,
  PurchaseInfoSection,
  PurchaseCostsSection,
  ExpectedPointsSection,
  ReceiptUploadSection,
  NotesSection,
} from '@/components/TransactionForm';

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { purchasePlatforms } = usePlatforms();

  const [loading, setLoading] = useState(true);
  const [dbTransaction, setDbTransaction] = useState<Transaction | null>(null);
  const [initialData, setInitialData] = useState<Partial<TransactionFormData>>();
  const [initialIsPending, setInitialIsPending] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        alert('加载失败，请重试');
        router.back();
        return;
      }

      setDbTransaction(data);
      setInitialIsPending(data.status === 'pending');
      setInitialData({
        date: data.date,
        product_name: data.product_name,
        quantity: data.quantity,
        purchase_price_total: data.purchase_price_total,
        card_paid: data.card_paid,
        point_paid: data.point_paid,
        balance_paid: data.balance_paid,
        card_id: data.card_id || '',
        expected_platform_points: data.expected_platform_points,
        expected_card_points: data.expected_card_points,
        extra_platform_points: data.extra_platform_points || 0,
        platform_points_platform_id: data.platform_points_platform_id || '',
        card_points_platform_id: data.card_points_platform_id || '',
        extra_platform_points_platform_id: data.extra_platform_points_platform_id || '',
        jan_code: data.jan_code || '',
        unit_price: data.unit_price || 0,
        shipping_fee: data.shipping_fee ?? 0,
        purchase_platform_id: data.purchase_platform_id || '',
        order_number: data.order_number || '',
        image_url: data.image_url || '',
        notes: data.notes || '',
      });
      setLoading(false);
    })();
  }, [id]);

  const form = useTransactionForm({
    mode: 'edit',
    initialData,
    initialIsPending,
    transaction: dbTransaction,
    onPersist: async ({ formData: fd, isPending, imageUrl }) => {
      const updateData: Record<string, unknown> = {
        date: fd.date,
        product_name: fd.product_name,
        quantity: fd.quantity,
        purchase_price_total: fd.purchase_price_total,
        card_paid: fd.card_paid,
        point_paid: fd.point_paid,
        balance_paid: fd.balance_paid,
        card_id: fd.card_id || null,
        expected_platform_points: fd.expected_platform_points,
        expected_card_points: fd.expected_card_points,
        extra_platform_points: fd.extra_platform_points || 0,
        platform_points_platform_id: fd.platform_points_platform_id || null,
        card_points_platform_id: fd.card_points_platform_id || null,
        extra_platform_points_platform_id: fd.extra_platform_points_platform_id || null,
        jan_code: fd.jan_code || null,
        unit_price: fd.unit_price || null,
        purchase_platform_id: fd.purchase_platform_id || null,
        order_number: fd.order_number || null,
        image_url: imageUrl,
        notes: fd.notes,
      };
      // 运费只在有改动时提交（兼容「代码先部署、库还没加列」）
      if ((fd.shipping_fee || 0) !== (dbTransaction?.shipping_fee ?? 0)) {
        updateData.shipping_fee = fd.shipping_fee || 0;
      }

      // Only toggle status if allowed (pending/in_stock + no sales)
      if (dbTransaction && (dbTransaction.status === 'pending' || dbTransaction.status === 'in_stock') && dbTransaction.quantity_sold === 0) {
        updateData.status = isPending ? 'pending' : 'in_stock';
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Fire-and-forget: JAN 有效 → 按 JAN 入队补共享缩略图缓存
      const jan = fd.jan_code?.trim();
      if (jan && /^\d{8,13}$/.test(jan)) {
        fetch('/api/thumbnail/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jan }),
        }).catch(() => {});
      }

      router.push(`/transactions/${id}`);
    },
  });

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen md:min-h-full text-[var(--color-text)]">
      <PageHeader
        crumbs={[
          { label: '交易列表', href: '/transactions' },
          { label: '交易详情', href: `/transactions/${params.id}` },
          { label: '编辑交易' },
        ]}
      />
      <div className={"relative max-w-2xl mx-auto px-4 py-8 " + layout.narrowDesktop}>
        {/* Header（桌面用文档头的面包屑返回） */}
        <div className="mb-8 md:mb-0">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-4 md:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回</span>
          </button>

          <h1 className={'text-4xl font-bold text-[var(--color-text)] ' + heading.pageDesktop}>编辑交易</h1>
        </div>

        {/* Form */}
        <form ref={form.formRef} onSubmit={form.handleSubmit} className="space-y-6">
          <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start lg:space-y-0">
            <div className="space-y-6">
              <BasicInfoSection
                date={form.formData.date}
                productName={form.formData.product_name}
                quantity={form.formData.quantity}
                janCode={form.formData.jan_code || ''}
                errors={form.errors}
                isPending={form.isPending}
                showPendingToggle={form.showPendingToggle}
                janLooking={form.janLooking}
                showJanField={false}
                onDateChange={form.handleDateChange}
                onInputChange={form.handleInputChange}
                onQuantityChange={form.handleQuantityChange}
                onScanBarcode={() => form.setShowScanner(true)}
                onTogglePending={() => form.setIsPending(!form.isPending)}
                quantityDisabled={form.quantityLocked}
                quantityWarning={form.quantityWarning}
              />
              <PurchaseInfoSection
                orderNumber={form.formData.order_number || ''}
                unitPrice={form.formData.unit_price}
                purchasePlatformId={form.formData.purchase_platform_id || ''}
                purchasePlatforms={purchasePlatforms}
                newPlatformName={form.newPurchasePlatformName}
                janCode={form.formData.jan_code || ''}
                janLooking={form.janLooking}
                onInputChange={form.handleInputChange}
                onUnitPriceChange={form.handleUnitPriceChange}
                onNewPlatformNameChange={form.setNewPurchasePlatformName}
                onAddPlatform={form.handleAddPurchasePlatform}
                onScanBarcode={() => form.setShowScanner(true)}
              />
            </div>
            <div className="space-y-6">
              <PurchaseCostsSection
                totalPrice={form.formData.purchase_price_total}
                shippingFee={form.formData.shipping_fee || 0}
                cardPaid={form.formData.card_paid}
                pointPaid={form.formData.point_paid}
                balancePaid={form.formData.balance_paid}
                cardId={form.formData.card_id}
                paymentMethods={form.paymentMethods}
                errors={form.errors}
                onTotalPriceChange={form.handleTotalPriceChange}
                onShippingFeeChange={form.handleShippingFeeChange}
                onInputChange={form.handleInputChange}
                onPaymentChange={form.handlePaymentChange}
              />
              <ExpectedPointsSection
                expectedPlatformPoints={form.formData.expected_platform_points}
                platformPointsPlatformId={form.formData.platform_points_platform_id || ''}
                extraPlatformPoints={form.formData.extra_platform_points || 0}
                extraPlatformPointsPlatformId={form.formData.extra_platform_points_platform_id || ''}
                expectedCardPoints={form.formData.expected_card_points}
                cardPointsPlatformId={form.formData.card_points_platform_id || ''}
                cardId={form.formData.card_id}
                pointsPlatforms={form.pointsPlatforms}
                paymentMethods={form.paymentMethods}
                errors={form.errors}
                onInputChange={form.handleInputChange}
                onNumberChange={form.handleNumberChange}
                getCardPointRateLabel={form.getCardPointRateLabel}
              />
              <ReceiptUploadSection
                imagePreview={form.imagePreview}
                error={form.errors.image}
                onImageSelect={form.handleImageSelect}
                onClearImage={form.clearImage}
              />
              <NotesSection
                notes={form.formData.notes || ''}
                onInputChange={form.handleInputChange}
              />
            </div>
          </div>

          {/* Submit error */}
          {form.errors.submit && (
            <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-danger-border)] bg-[var(--color-danger-subtle)]">
              <p className="text-sm text-[var(--color-danger)]">{form.errors.submit}</p>
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={form.isSubmitting}
              className={button.primary + ' flex-1 max-md:py-3'}
            >
              {form.isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  保存中...
                </span>
              ) : (
                '保存更改'
              )}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className={button.secondary + ' max-md:py-3'}
            >
              取消
            </button>
          </div>
        </form>
      </div>
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
