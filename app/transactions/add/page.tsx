'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { TransactionFormData } from '@/types/database.types';
import { useRouter, useSearchParams } from 'next/navigation';
import { layout, heading, button } from '@/lib/theme';
import BarcodeScanner from '@/components/BarcodeScanner';
import { usePlatforms } from '@/contexts/PlatformsContext';
import { loadAmazonPointConfig } from '@/lib/amazon-point-config';
import { useTransactionForm } from '@/hooks/useTransactionForm';
import {
  BasicInfoSection,
  PurchaseInfoSection,
  PurchaseCostsSection,
  ExpectedPointsSection,
  ReceiptUploadSection,
  NotesSection,
} from '@/components/TransactionForm';

function AddTransactionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyId = searchParams.get('copy');
  const [copyData, setCopyData] = useState<Partial<TransactionFormData>>();
  const { purchasePlatforms } = usePlatforms();

  // Stable Amazon config (read once from localStorage)
  const amazonConfig = useMemo(() => loadAmazonPointConfig(), []);

  // Load copy source data
  useEffect(() => {
    if (!copyId) return;

    (async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', copyId)
        .single();

      if (error || !data) return;

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
        purchase_platform_id: data.purchase_platform_id || '',
        notes: data.notes || '',
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
          ...fd,
          status: isPending ? 'pending' : 'in_stock',
          image_url: imageUrl,
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

      if (continueAdding && newRecord) {
        router.push(`/transactions/add?copy=${newRecord.id}`);
      } else {
        router.push('/transactions');
      }
    },
  });

  return (
    <div className={layout.page}>
      <div className="relative max-w-2xl lg:max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className={layout.section}>
          <button
            onClick={() => router.back()}
            className={button.ghost + ' flex items-center gap-2 mb-4'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回</span>
          </button>

          <h1 className={heading.h1 + ' mb-2'}>记录新交易</h1>
          <p className="text-[var(--color-text-muted)]">快速录入您的转卖商品信息</p>
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
                showJanField={true}
                onDateChange={form.handleDateChange}
                onInputChange={form.handleInputChange}
                onNumberChange={form.handleNumberChange}
                onScanBarcode={() => form.setShowScanner(true)}
                onTogglePending={() => form.setIsPending(!form.isPending)}
              />
              <PurchaseInfoSection
                orderNumber={form.formData.order_number || ''}
                unitPrice={form.formData.unit_price}
                purchasePlatformId={form.formData.purchase_platform_id || ''}
                purchasePlatforms={purchasePlatforms}
                newPlatformName={form.newPurchasePlatformName}
                onInputChange={form.handleInputChange}
                onUnitPriceChange={form.handleUnitPriceChange}
                onNewPlatformNameChange={form.setNewPurchasePlatformName}
                onAddPlatform={form.handleAddPurchasePlatform}
              />
            </div>
            <div className="space-y-6">
              <PurchaseCostsSection
                totalPrice={form.formData.purchase_price_total}
                cardPaid={form.formData.card_paid}
                pointPaid={form.formData.point_paid}
                balancePaid={form.formData.balance_paid}
                cardId={form.formData.card_id}
                paymentMethods={form.paymentMethods}
                errors={form.errors}
                onTotalPriceChange={form.handleTotalPriceChange}
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
            <div className="p-4 rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]">
              <p className="text-sm text-[var(--color-danger)]">{form.errors.submit}</p>
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={form.isSubmitting}
              className={button.primary + ' flex-1 py-3'}
            >
              {form.isSubmitting && !form.continueAdding ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
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
              className={button.secondary + ' flex-1 py-3'}
            >
              {form.isSubmitting && form.continueAdding ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </span>
              ) : (
                '保存并继续添加'
              )}
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

export default function AddTransactionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text)]">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xl">加载中...</span>
        </div>
      </div>
    }>
      <AddTransactionPageContent />
    </Suspense>
  );
}
