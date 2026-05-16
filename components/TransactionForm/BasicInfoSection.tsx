'use client';

import React from 'react';
import DatePicker from '@/components/DatePicker';
import { parseDateFromLocal } from '@/lib/utils/dateUtils';
import { JanField } from './JanField';

interface BasicInfoSectionProps {
  date: string;
  productName: string;
  quantity: number | undefined;
  janCode: string;
  errors: { product_name?: string; quantity?: string };
  isPending: boolean;
  showPendingToggle: boolean;
  janLooking: boolean;
  showJanField: boolean;

  onDateChange: (date: Date | null) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScanBarcode: () => void;
  onTogglePending: () => void;

  quantityDisabled?: boolean;
  quantityWarning?: string | null;
}

export function BasicInfoSection({
  date,
  productName,
  quantity,
  janCode,
  errors,
  isPending,
  showPendingToggle,
  janLooking,
  showJanField,
  onDateChange,
  onInputChange,
  onNumberChange,
  onScanBarcode,
  onTogglePending,
  quantityDisabled,
  quantityWarning,
}: BasicInfoSectionProps) {
  return (
    <div className="sn-form-card">
      <div className="space-y-5">
        <h2 className="sn-form-title">
          <div className="sn-form-title-bar"></div>
          基本信息
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {/* Date */}
          <div>
            <label className="sn-form-label">
              日期 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <DatePicker
              selected={date ? parseDateFromLocal(date) : null}
              onChange={onDateChange}
              className="w-full sn-form-input"
            />
          </div>

          {/* JAN (add page) */}
          {showJanField && (
            <JanField
              janCode={janCode}
              janLooking={janLooking}
              onInputChange={onInputChange}
              onScanBarcode={onScanBarcode}
            />
          )}

          {/* Product name */}
          <div>
            <label className="sn-form-label">
              商品名称 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              type="text"
              name="product_name"
              value={productName}
              onChange={onInputChange}
              placeholder="例: Nintendo Switch OLED"
              className="w-full sn-form-input"
              required
            />
            {errors.product_name && (
              <p className="sn-form-error">{errors.product_name}</p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="sn-form-label">
              数量 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              name="quantity"
              value={quantity ?? ''}
              onChange={onNumberChange}
              placeholder="1"
              className="w-full sn-form-input"
              required
              disabled={quantityDisabled}
            />
            {!quantityDisabled && (
              <p className="sn-form-muted">批量进货时填写总数量，如30个</p>
            )}
            {errors.quantity && (
              <p className="sn-form-error">{errors.quantity}</p>
            )}
            {quantityWarning && (
              <p className="text-[var(--color-warning)] text-sm mt-1">{quantityWarning}</p>
            )}
          </div>

          {/* Pending toggle */}
          {showPendingToggle && (
            <div className="sn-form-subtle-panel flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">未到货</label>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">商品尚未到达</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPending}
                onClick={onTogglePending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPending ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-border)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPending ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
