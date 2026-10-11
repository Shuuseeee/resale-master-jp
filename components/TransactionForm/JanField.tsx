'use client';

import React from 'react';
import { BarcodeScanner20Regular } from '@fluentui/react-icons/headless/svg/barcode-scanner';
import Spinner from '@/components/fluent/Spinner';

interface JanFieldProps {
  janCode: string;
  janLooking: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScanBarcode: () => void;
}

export function JanField({ janCode, janLooking, onInputChange, onScanBarcode }: JanFieldProps) {
  return (
    <div>
      <label className="sn-form-label">JAN</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          name="jan_code"
          value={janCode}
          onChange={onInputChange}
          placeholder="4901234567890"
          className="flex-1 sn-form-input"
        />
        {janLooking ? (
          <Spinner />
        ) : (
          <button
            type="button"
            onClick={onScanBarcode}
            className="fluent-btn fluent-btn--subtle shrink-0 px-2"
            aria-label="扫描条形码"
            title="扫描条形码"
          >
            <BarcodeScanner20Regular />
          </button>
        )}
      </div>
      <p className="sn-form-muted">商品名称为空时，按 JAN 自动补全（仅限部分常见商品）</p>
    </div>
  );
}
