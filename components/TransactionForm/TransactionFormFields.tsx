'use client';

// 新增 / 编辑交易共用的表单主体：两页的字段与排布只在这里维护（之前各写一份，JAN 位置等逐渐不一致）

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { useTransactionForm } from '@/hooks/useTransactionForm';
import type { Transaction } from '@/types/database.types';
import { BasicInfoSection } from './BasicInfoSection';
import { PurchaseInfoSection } from './PurchaseInfoSection';
import { PurchaseCostsSection } from './PurchaseCostsSection';
import { ExpectedPointsSection } from './ExpectedPointsSection';
import { ReceiptUploadSection } from './ReceiptUploadSection';
import { NotesSection } from './NotesSection';

type Form = ReturnType<typeof useTransactionForm>;

export function TransactionFormFields({ form, onTogglePending }: { form: Form; onTogglePending?: () => void }) {
  const fd = form.formData;
  // 账号候选 = 交易列表缓存里用过的账号（没进过列表时为空，照样可以手输）
  const queryClient = useQueryClient();
  const accountSuggestions = useMemo(() => {
    const txs = queryClient.getQueryData<Transaction[]>(['transactions']) ?? [];
    return [...new Set(txs.map(t => t.purchase_account?.trim()).filter((a): a is string => !!a))].sort();
  }, [queryClient]);
  return (
    // 两栏按内容区宽度切换（容器查询，globals.css .sn-form-layout）：分区抽屉开着时内容区可能只有 600 左右。
    // 左：基本信息 / 采购信息 / 凭证；右：采购成本 / 预期积分 / 备注（两栏高度大致相当）。
    // 单栏时栏容器 display: contents，按 order 排成填写顺序：基本 → 采购信息 → 成本 → 积分 → 凭证 → 备注
    <div className="sn-form-layout">
    <div className="sn-form-columns">
      <div className="sn-form-col">
        <div className="order-1">
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
        </div>
        <div className="order-2">
        <PurchaseInfoSection
          orderNumber={fd.order_number || ''}
          purchaseAccount={fd.purchase_account || ''}
          accountSuggestions={accountSuggestions}
          purchasePlatformId={fd.purchase_platform_id || ''}
          purchasePlatforms={form.purchasePlatforms}
          newPlatformName={form.newPurchasePlatformName}
          onInputChange={form.handleInputChange}
          onNewPlatformNameChange={form.setNewPurchasePlatformName}
          onAddPlatform={form.handleAddPurchasePlatform}
        />
        </div>
        <div className="order-5">
        <ReceiptUploadSection
          imagePreview={form.imagePreview}
          error={form.errors.image}
          onImageSelect={form.handleImageSelect}
          onClearImage={form.clearImage}
        />
        </div>
      </div>
      <div className="sn-form-col">
        <div className="order-3">
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
        </div>
        <div className="order-4">
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
        </div>
        <div className="order-6">
        <NotesSection
          notes={fd.notes || ''}
          onInputChange={form.handleInputChange}
        />
        </div>
      </div>
    </div>
    </div>
  );
}
