'use client';

import React from 'react';
import Image from 'next/image';
import { Dismiss20Regular } from '@fluentui/react-icons/headless/svg/dismiss';
import { ImageAdd24Regular } from '@fluentui/react-icons/headless/svg/image-add';

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
          凭证上传
        </h2>

        <div>
          <label className="sn-form-label">采购截图</label>

          {imagePreview ? (
            <div className="relative">
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
                className="fluent-btn fluent-btn--default fluent-btn--icon absolute right-2 top-2"
                aria-label="删除截图"
                title="删除截图"
              >
                <Dismiss20Regular />
              </button>
            </div>
          ) : (
            <label className="flex h-48 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] transition-colors hover:bg-[var(--color-bg-hover)]">
              <ImageAdd24Regular className="text-[var(--color-text-muted)]" />
              <span className="text-sm font-semibold text-[var(--color-text)]">点击上传</span>
              <span className="text-xs text-[var(--color-text-muted)]">支持 JPG、PNG、HEIC 等图片，上传前自动压缩</span>
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
