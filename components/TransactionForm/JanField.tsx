'use client';

import React from 'react';

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
          name="jan_code"
          value={janCode}
          onChange={onInputChange}
          placeholder="4901234567890"
          className="flex-1 sn-form-input"
        />
        {janLooking ? (
          <svg className="animate-spin h-5 w-5 text-[var(--color-primary)] flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <button
            type="button"
            onClick={onScanBarcode}
            className="flex-shrink-0 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded-lg transition-colors"
            title="扫描条形码"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </button>
        )}
      </div>
      <p className="sn-form-muted">
        输入JAN码后如果商品名称为空会自动补全（仅限部分常见商品）
      </p>
    </div>
  );
}
