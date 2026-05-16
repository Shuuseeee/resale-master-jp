'use client';

import React from 'react';
import type { PaymentMethod } from '@/types/database.types';

interface PurchaseCostsSectionProps {
  totalPrice: number;
  cardPaid: number;
  pointPaid: number;
  balancePaid: number;
  cardId: string;
  paymentMethods: PaymentMethod[];
  errors: { purchase_price_total?: string; card_id?: string; payment?: string };

  onTotalPriceChange: (value: string) => void;
  onInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onPaymentChange: (field: 'card_paid' | 'point_paid', value: string) => void;
}

export function PurchaseCostsSection({
  totalPrice,
  cardPaid,
  pointPaid,
  balancePaid,
  cardId,
  paymentMethods,
  errors,
  onTotalPriceChange,
  onInputChange,
  onPaymentChange,
}: PurchaseCostsSectionProps) {
  return (
    <div className="sn-form-card">
      <div className="space-y-5">
        <h2 className="sn-form-title">
          <div className="sn-form-title-bar"></div>
          采购成本
        </h2>

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
              placeholder="0.00 或 3,000"
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
                <label className="sn-form-label">信用卡支付</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cardPaid || ''}
                    onChange={(e) => onPaymentChange('card_paid', e.target.value)}
                    placeholder="0.00 或 3,000"
                    className="w-full sn-form-input pr-12"
                  />
                  <span className="sn-form-addon">¥</span>
                </div>
              </div>
              <div className="min-w-0">
                <label className="sn-form-label">支付卡片</label>
                <select
                  name="card_id"
                  value={cardId}
                  onChange={onInputChange}
                  className="w-full sn-form-input"
                  disabled={cardPaid === 0}
                >
                  <option value="">选择卡片</option>
                  {paymentMethods
                    .filter((pm) => pm.type === 'card')
                    .map((pm) => (
                      <option key={pm.id} value={pm.id}>{pm.name}</option>
                    ))}
                </select>
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
                placeholder="0.00 或 3,000"
                className="w-full sn-form-input pr-12"
              />
              <span className="sn-form-addon">¥</span>
            </div>
          </div>

          <div>
            <label className="sn-form-label">余额支付</label>
            <div className="relative">
              <input
                type="number"
                value={balancePaid || ''}
                readOnly
                className="w-full px-4 py-3 pr-12 bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-muted)] cursor-not-allowed"
              />
              <span className="sn-form-addon">¥</span>
            </div>
            <p className="sn-form-muted">自动计算</p>
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
