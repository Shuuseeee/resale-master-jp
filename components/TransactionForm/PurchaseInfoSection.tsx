'use client';

import React, { useState } from 'react';
import { Add16Regular } from '@fluentui/react-icons/headless/svg/add';
import Select from '@/components/Select';
import type { PurchasePlatform } from '@/types/database.types';

interface PurchaseInfoSectionProps {
  orderNumber: string;
  purchasePlatformId: string;
  purchasePlatforms: PurchasePlatform[];
  newPlatformName: string;

  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onNewPlatformNameChange: (name: string) => void;
  onAddPlatform: () => void;
}

export function PurchaseInfoSection({
  orderNumber,
  purchasePlatformId,
  purchasePlatforms,
  newPlatformName,
  onInputChange,
  onNewPlatformNameChange,
  onAddPlatform,
}: PurchaseInfoSectionProps) {
  // 新建平台不常用：默认收起，点「新增平台」再展开输入框
  const [adding, setAdding] = useState(false);

  return (
    <div className="sn-form-card">
      <div className="space-y-5">
        <h2 className="sn-form-title">
          采购信息
        </h2>

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

        <div>
          <label className="sn-form-label">采购平台</label>
          <Select
            value={purchasePlatformId}
            onChange={(v) => onInputChange({ target: { name: 'purchase_platform_id', value: v } } as unknown as React.ChangeEvent<HTMLSelectElement>)}
            options={purchasePlatforms.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="请选择"
            clearable
            className="w-full sn-form-input"
          />
          {adding ? (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newPlatformName}
                onChange={(e) => onNewPlatformNameChange(e.target.value)}
                onKeyDown={(e) => {
                  // 回车只添加平台，不提交整张表单
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newPlatformName.trim()) onAddPlatform();
                  }
                }}
                placeholder="新平台名称"
                className="flex-1 sn-form-input"
                autoFocus
              />
              <button
                type="button"
                onClick={async () => {
                  await onAddPlatform();
                  setAdding(false);
                }}
                disabled={!newPlatformName.trim()}
                className="fluent-btn fluent-btn--primary shrink-0"
              >
                添加
              </button>
              <button
                type="button"
                onClick={() => {
                  onNewPlatformNameChange('');
                  setAdding(false);
                }}
                className="fluent-btn fluent-btn--subtle shrink-0"
              >
                取消
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="fluent-link mt-2 inline-flex items-center gap-1 text-sm">
              <Add16Regular />
              新增平台
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
