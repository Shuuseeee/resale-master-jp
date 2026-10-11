'use client';

// 新增 / 编辑交易共用的表单主体：两页的字段与排布只在这里维护（之前各写一份，JAN 位置等逐渐不一致）

import type { useTransactionForm } from '@/hooks/useTransactionForm';
import { BasicInfoSection } from './BasicInfoSection';
import { PurchaseInfoSection } from './PurchaseInfoSection';
import { PurchaseCostsSection } from './PurchaseCostsSection';
import { ExpectedPointsSection } from './ExpectedPointsSection';
import { ReceiptUploadSection } from './ReceiptUploadSection';
import { NotesSection } from './NotesSection';

type Form = ReturnType<typeof useTransactionForm>;

export function TransactionFormFields({ form, onTogglePending }: { form: Form; onTogglePending?: () => void }) {
  const fd = form.formData;
  return (
    <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start lg:space-y-0">
      <div className="space-y-6">
        <BasicInfoSection
          date={fd.date}
          productName={fd.product_name}
          quantity={fd.quantity}
          janCode={fd.jan_code || ''}
          errors={form.errors}
          isPending={form.isPending}
          showPendingToggle={form.showPendingToggle}
          janLooking={form.janLooking}
          onDateChange={form.handleDateChange}
          onInputChange={form.handleInputChange}
          onQuantityChange={form.handleQuantityChange}
          onScanBarcode={() => form.setShowScanner(true)}
          onTogglePending={onTogglePending ?? (() => form.setIsPending(!form.isPending))}
          quantityDisabled={form.quantityLocked}
          quantityWarning={form.quantityWarning}
        />
        <PurchaseInfoSection
          orderNumber={fd.order_number || ''}
          purchasePlatformId={fd.purchase_platform_id || ''}
          purchasePlatforms={form.purchasePlatforms}
          newPlatformName={form.newPurchasePlatformName}
          onInputChange={form.handleInputChange}
          onNewPlatformNameChange={form.setNewPurchasePlatformName}
          onAddPlatform={form.handleAddPurchasePlatform}
        />
      </div>
      <div className="space-y-6">
        <PurchaseCostsSection
          unitPrice={fd.unit_price}
          totalPrice={fd.purchase_price_total}
          shippingFee={fd.shipping_fee || 0}
          couponAmount={fd.coupon_amount || 0}
          cardPaid={fd.card_paid}
          pointPaid={fd.point_paid}
          balancePaid={fd.balance_paid}
          cardId={fd.card_id}
          paymentMethods={form.paymentMethods}
          errors={form.errors}
          onUnitPriceChange={form.handleUnitPriceChange}
          onTotalPriceChange={form.handleTotalPriceChange}
          onShippingFeeChange={form.handleShippingFeeChange}
          onCouponChange={form.handleCouponChange}
          onInputChange={form.handleInputChange}
          onPaymentChange={form.handlePaymentChange}
        />
        <ExpectedPointsSection
          expectedPlatformPoints={fd.expected_platform_points}
          platformPointsPlatformId={fd.platform_points_platform_id || ''}
          extraPlatformPoints={fd.extra_platform_points || 0}
          extraPlatformPointsPlatformId={fd.extra_platform_points_platform_id || ''}
          expectedCardPoints={fd.expected_card_points}
          cardPointsPlatformId={fd.card_points_platform_id || ''}
          cardId={fd.card_id}
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
          notes={fd.notes || ''}
          onInputChange={form.handleInputChange}
        />
      </div>
    </div>
  );
}
