'use client';

import React from 'react';
import type { PurchasePlatform } from '@/types/database.types';
import { JanField } from './JanField';

interface PurchaseInfoSectionProps {
  orderNumber: string;
  unitPrice: number | undefined;
  purchasePlatformId: string;
  purchasePlatforms: PurchasePlatform[];
  newPlatformName: string;
  janCode?: string;
  janLooking?: boolean;

  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onUnitPriceChange: (value: string) => void;
  onNewPlatformNameChange: (name: string) => void;
  onAddPlatform: () => void;
  onScanBarcode?: () => void;
}

export function PurchaseInfoSection({
  orderNumber,
  unitPrice,
  purchasePlatformId,
  purchasePlatforms,
  newPlatformName,
  janCode,
  janLooking,
  onInputChange,
  onUnitPriceChange,
  onNewPlatformNameChange,
  onAddPlatform,
  onScanBarcode,
}: PurchaseInfoSectionProps) {
  const showJan = janCode !== undefined;

  return (
    <div className="sn-form-card">
      <div className="space-y-5">
        <h2 className="sn-form-title">
          <div className="sn-form-title-bar"></div>
          采购信息
        </h2>

        {/* JAN + Order number (edit: 2-col; add: order standalone) */}
        {showJan ? (
          <div className="grid grid-cols-2 gap-4">
            <JanField janCode={janCode!} janLooking={janLooking!} onInputChange={onInputChange} onScanBarcode={onScanBarcode!} />
            <div>
              <label className="sn-form-label">订单号</label>
              <input
                type="text"
                name="order_number"
                value={orderNumber}
                onChange={onInputChange}
                placeholder="订单号"
                className="w-full sn-form-input"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="sn-form-label">订单号</label>
            <input
              type="text"
              name="order_number"
              value={orderNumber}
              onChange={onInputChange}
              placeholder="订单号"
              className="w-full sn-form-input"
            />
          </div>
        )}

        {/* Unit price */}
        <div>
          <label className="sn-form-label">单价 (¥)</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              name="unit_price"
              value={unitPrice || ''}
              onChange={(e) => onUnitPriceChange(e.target.value)}
              placeholder="0.00"
              className="w-full sn-form-input pr-12"
            />
            <span className="sn-form-addon">¥</span>
          </div>
          <p className="sn-form-muted">
            {showJan ? '输入单价后会自动计算总价和余额支付金额' : '输入后采购总价将自动计算（单价 × 数量）'}
          </p>
        </div>

        {/* Purchase platform */}
        <div>
          <label className="sn-form-label">采购平台</label>
          <div className="flex gap-2">
            <select
              name="purchase_platform_id"
              value={purchasePlatformId}
              onChange={onInputChange}
              className="flex-1 sn-form-input"
            >
              <option value="">请选择</option>
              {purchasePlatforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.is_builtin ? '' : ' （自定义）'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newPlatformName}
              onChange={(e) => onNewPlatformNameChange(e.target.value)}
              placeholder="添加新的采购平台..."
              className="flex-1 sn-form-input py-2"
            />
            <button
              type="button"
              onClick={onAddPlatform}
              disabled={!newPlatformName.trim()}
              className="px-3 py-2 bg-[var(--color-primary)] active:opacity-80 disabled:opacity-50 text-white text-sm rounded-lg transition-all disabled:cursor-not-allowed"
            >
              添加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
