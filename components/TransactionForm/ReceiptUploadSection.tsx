'use client';

import React from 'react';
import Image from 'next/image';

interface ReceiptUploadSectionProps {
  imagePreview: string;
  error?: string;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
}

export function ReceiptUploadSection({
  imagePreview,
  error,
  onImageSelect,
  onClearImage,
}: ReceiptUploadSectionProps) {
  return (
    <div className="sn-form-card">
      <div className="space-y-5">
        <h2 className="sn-form-title">
          <div className="sn-form-title-bar"></div>
          凭证上传
        </h2>

        <div>
          <label className="sn-form-label">采购截图</label>

          {imagePreview ? (
            <div className="relative group">
              <div className="relative h-48 w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                <Image
                  src={imagePreview}
                  alt="预览"
                  fill
                  className="object-contain"
                />
              </div>
              <button
                type="button"
                onClick={onClearImage}
                className="absolute top-2 right-2 p-2 bg-[var(--color-danger)] active:opacity-80 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-[var(--color-border)] rounded-xl cursor-pointer bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-elevated)] transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-12 h-12 mb-3 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="mb-2 text-sm text-[var(--color-text-muted)]">
                  <span className="font-semibold">点击上传</span>
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">PNG, JPG 或 WEBP (最大 5MB)</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={onImageSelect}
                className="hidden"
              />
            </label>
          )}
          {error && (
            <p className="sn-form-error">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
