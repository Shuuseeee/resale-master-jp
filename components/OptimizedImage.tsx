// components/OptimizedImage.tsx
'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps extends Omit<ImageProps, 'src' | 'alt'> {
  src: string;
  alt: string;
  fallbackSrc?: string; // 加载失败时的备用图片
  skeleton?: boolean; // 是否显示骨架屏
  aspectRatio?: '1/1' | '4/3' | '16/9' | '3/2'; // 宽高比
}

export default function OptimizedImage({
  src,
  alt,
  fallbackSrc = '/images/placeholder.svg',
  skeleton = true,
  aspectRatio,
  className = '',
  priority = false,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // 空字符串 src 等同于无图，直接走 fallback 路径
  const effectiveSrc = src || fallbackSrc;

  // 宽高比映射
  const aspectRatioClasses = {
    '1/1': 'aspect-square',
    '4/3': 'aspect-[4/3]',
    '16/9': 'aspect-video',
    '3/2': 'aspect-[3/2]',
  };

  const containerClass = aspectRatio
    ? `relative ${aspectRatioClasses[aspectRatio]} overflow-hidden ${className}`
    : `relative overflow-hidden ${className}`;

  return (
    <div className={containerClass}>
      {/* 骨架屏 */}
      {skeleton && isLoading && (
        <div className="absolute inset-0 bg-[var(--color-bg-subtle)] animate-pulse" />
      )}

      {/* 图片 */}
      <Image
        src={hasError ? fallbackSrc : effectiveSrc}
        alt={alt}
        className={`
          transition-opacity duration-300
          ${isLoading ? 'opacity-0' : 'opacity-100'}
        `}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        priority={priority}
        {...props}
      />
    </div>
  );
}

// 产品图片组件 - 针对商品列表优化
export function ProductImage({
  src,
  alt,
  priority = false,
  size = 'md',
  className = '',
}: {
  src: string;
  alt: string;
  priority?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: { width: 48, height: 48 },
    md: { width: 64, height: 64 },
    lg: { width: 128, height: 128 },
  };

  const { width, height } = sizes[size];

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      aspectRatio="1/1"
      className={className}
      sizes={`${width}px`}
      style={{ objectFit: 'cover' }}
    />
  );
}
