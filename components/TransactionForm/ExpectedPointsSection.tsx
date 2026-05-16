'use client';

import React from 'react';
import type { PointsPlatform, PaymentMethod } from '@/types/database.types';

interface ExpectedPointsSectionProps {
  expectedPlatformPoints: number;
  platformPointsPlatformId: string;
  extraPlatformPoints: number;
  extraPlatformPointsPlatformId: string;
  expectedCardPoints: number;
  cardPointsPlatformId: string;
  cardId: string;
  pointsPlatforms: PointsPlatform[];
  paymentMethods: PaymentMethod[];
  errors: {
    platform_points_platform_id?: string;
    extra_platform_points_platform_id?: string;
    card_points_platform_id?: string;
  };

  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getCardPointRateLabel: () => string | null;
}

export function ExpectedPointsSection({
  expectedPlatformPoints,
  platformPointsPlatformId,
  extraPlatformPoints,
  extraPlatformPointsPlatformId,
  expectedCardPoints,
  cardPointsPlatformId,
  cardId,
  pointsPlatforms,
  paymentMethods,
  errors,
  onInputChange,
  onNumberChange,
  getCardPointRateLabel,
}: ExpectedPointsSectionProps) {
  const rateLabel = getCardPointRateLabel();

  return (
    <div className="sn-form-card">
      <div className="space-y-5">
        <h2 className="sn-form-title">
          <div className="sn-form-title-bar"></div>
          预期积分
        </h2>

        {/* Platform points */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="sn-form-label">平台积分数量</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                name="expected_platform_points"
                value={expectedPlatformPoints || ''}
                onChange={onNumberChange}
                placeholder="0 或 1,000"
                className="w-full sn-form-input pr-12"
              />
              <span className="sn-form-addon">P</span>
            </div>
          </div>
          <div>
            <label className="sn-form-label">积分平台</label>
            <select
              name="platform_points_platform_id"
              value={platformPointsPlatformId}
              onChange={onInputChange}
              disabled={expectedPlatformPoints === 0}
              className="w-full sn-form-input disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">选择平台</option>
              {pointsPlatforms.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.display_name}</option>
              ))}
            </select>
            {errors.platform_points_platform_id && (
              <p className="sn-form-error">{errors.platform_points_platform_id}</p>
            )}
          </div>
        </div>

        {/* Extra platform points */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="sn-form-label">
              额外积分数量
              <span className="text-xs text-[var(--color-text-muted)] ml-2">(如d point)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                name="extra_platform_points"
                value={extraPlatformPoints || ''}
                onChange={onNumberChange}
                placeholder="0 或 1,000"
                className="w-full sn-form-input pr-12"
              />
              <span className="sn-form-addon">P</span>
            </div>
          </div>
          <div>
            <label className="sn-form-label">额外积分平台</label>
            <select
              name="extra_platform_points_platform_id"
              value={extraPlatformPointsPlatformId}
              onChange={onInputChange}
              disabled={!extraPlatformPoints || extraPlatformPoints === 0}
              className="w-full sn-form-input disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">选择平台</option>
              {pointsPlatforms.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.display_name}</option>
              ))}
            </select>
            {errors.extra_platform_points_platform_id && (
              <p className="sn-form-error">{errors.extra_platform_points_platform_id}</p>
            )}
          </div>
        </div>

        {/* Card points */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="sn-form-label">
              信用卡积分数量
              {rateLabel && (
                <span className="ml-2 text-xs text-[var(--color-primary)]">{rateLabel}</span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                name="expected_card_points"
                value={expectedCardPoints || ''}
                onChange={onNumberChange}
                placeholder="0 或 1,000"
                className="w-full sn-form-input pr-12"
              />
              <span className="sn-form-addon">P</span>
            </div>
            <p className="sn-form-muted">根据卡片返点率自动计算，可手动调整</p>
          </div>
          <div>
            <label className="sn-form-label">信用卡积分平台</label>
            <select
              name="card_points_platform_id"
              value={cardPointsPlatformId}
              onChange={onInputChange}
              disabled={expectedCardPoints === 0 || !cardId}
              className="w-full sn-form-input disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">选择平台</option>
              {pointsPlatforms.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.display_name}</option>
              ))}
            </select>
            {errors.card_points_platform_id && (
              <p className="sn-form-error">{errors.card_points_platform_id}</p>
            )}
            {cardId && cardPointsPlatformId && (
              <p className="sn-form-muted">已从支付方式自动设置</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
