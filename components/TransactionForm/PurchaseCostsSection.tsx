'use client';

import React from 'react';
import Select from '@/components/Select';
import type { PaymentMethod } from '@/types/database.types';
import { comparePaymentMethods, paymentMethodDisplayName } from '@/lib/utils/paymentMethods';

interface PurchaseCostsSectionProps {
  unitPrice: number | undefined;
  totalPrice: number;
  shippingFee: number;
  couponAmount: number;
  cardPaid: number;
  pointPaid: number;
  balancePaid: number;
  cardId: string;
  paymentMethods: PaymentMethod[];
  errors: { purchase_price_total?: string; card_id?: string; payment?: string };

  onUnitPriceChange: (value: string) => void;
  onTotalPriceChange: (value: string) => void;
  onShippingFeeChange: (value: string) => void;
  onCouponChange: (value: string) => void;
  onInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onPaymentChange: (field: 'card_paid' | 'point_paid', value: string) => void;
}

export function PurchaseCostsSection({
  unitPrice,
  totalPrice,
  shippingFee,
  couponAmount,
  cardPaid,
  pointPaid,
  balancePaid,
  cardId,
  paymentMethods,
  errors,
  onUnitPriceChange,
  onTotalPriceChange,
  onShippingFeeChange,
  onCouponChange,
  onInputChange,
  onPaymentChange,
}: PurchaseCostsSectionProps) {
  return (
    <div className="sn-form-card">
      <div className="space-y-5">
        <h2 className="sn-form-title">
          采购成本
        </h2>

        {/* 单价 → 运费 / 优惠券 → 采购总价：同一串计算放在一起 */}
        <div>
          <label className="sn-form-label">单价</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              name="unit_price"
              value={unitPrice || ''}
              onChange={(e) => onUnitPriceChange(e.target.value)}
              placeholder="0"
              className="w-full sn-form-input pr-12"
            />
            <span className="sn-form-addon">¥</span>
          </div>
          <p className="sn-form-muted">填了单价，采购总价按「单价 × 数量 + 运费」自动计算</p>
        </div>

        {/* Shipping fee：计入采购总价 */}
        <div>
          <label className="sn-form-label">运费</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              name="shipping_fee"
              value={shippingFee || ''}
              onChange={(e) => onShippingFeeChange(e.target.value)}
              placeholder="0"
              className="w-full sn-form-input pr-12"
            />
            <span className="sn-form-addon">¥</span>
          </div>
          <p className="sn-form-muted">计入采购总价</p>
        </div>

        {/* 优惠券：单价已是扣后价，只做记录 */}
        <div>
          <label className="sn-form-label">优惠券</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              name="coupon_amount"
              value={couponAmount || ''}
              onChange={(e) => onCouponChange(e.target.value)}
              placeholder="0"
              className="w-full sn-form-input pr-12"
            />
            <span className="sn-form-addon">¥</span>
          </div>
          <p className="sn-form-muted">这笔用掉的优惠券金额。单价填扣完优惠后的价格，这里只做记录，不影响成本和利润</p>
        </div>

        {/* Total price */}
        <div>
          <label className="sn-form-label">
            采购总价 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              name="purchase_price_total"
              value={totalPrice || ''}
              onChange={(e) => onTotalPriceChange(e.target.value)}
              placeholder="0"
              className="w-full sn-form-input pr-12"
              required
            />
            <span className="sn-form-addon">¥</span>
          </div>
          {errors.purchase_price_total && (
            <p className="sn-form-error">{errors.purchase_price_total}</p>
          )}
        </div>

        {/* Mixed payment */}
        <div className="grid grid-cols-1 gap-4 pt-4 border-t border-[var(--color-border)]">
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label className="sn-form-label">信用卡 / 其他支付</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cardPaid || ''}
                    onChange={(e) => onPaymentChange('card_paid', e.target.value)}
                    placeholder="0"
                    className="w-full sn-form-input pr-12"
                  />
                  <span className="sn-form-addon">¥</span>
                </div>
              </div>
              <div className="min-w-0">
                <label className="sn-form-label">支付方式</label>
                <Select
                  value={cardId}
                  onChange={(v) => onInputChange({ target: { name: 'card_id', value: v } } as unknown as React.ChangeEvent<HTMLSelectElement>)}
                  options={paymentMethods
                    .filter((pm) => pm.is_active || pm.id === cardId)
                    .sort(comparePaymentMethods)
                    .map((pm) => ({ value: pm.id, label: paymentMethodDisplayName(pm) }))}
                  placeholder="选择支付方式"
                  clearable
                  className="w-full sn-form-input"
                  disabled={cardPaid === 0}
                />
              </div>
            </div>
            {errors.card_id && (
              <p className="sn-form-error">{errors.card_id}</p>
            )}
          </div>

          <div>
            <label className="sn-form-label">积分抵扣</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={pointPaid || ''}
                onChange={(e) => onPaymentChange('point_paid', e.target.value)}
                placeholder="0"
                className="w-full sn-form-input pr-12"
              />
              <span className="sn-form-addon">¥</span>
            </div>
          </div>

          <div>
            <label className="sn-form-label">余额支付</label>
            <div className="relative">
              <input
                type="text"
                value={balancePaid ? balancePaid.toLocaleString('ja-JP') : '0'}
                readOnly
                tabIndex={-1}
                className="w-full sn-form-input pr-12 cursor-default text-[var(--color-text-secondary)]"
              />
              <span className="sn-form-addon">¥</span>
            </div>
            <p className="sn-form-muted">采购总价 − 信用卡 / 其他支付 − 积分抵扣，自动计算</p>
          </div>

          {errors.payment && (
            <div className="sn-form-alert-error">
              <p className="text-sm text-[var(--color-danger)]">{errors.payment}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
