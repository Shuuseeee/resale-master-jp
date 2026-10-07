import Image from 'next/image';

// 应用品牌图标（与 favicon / PWA 图标同源，见 scripts/generate-icons.py）。尺寸由调用方 className 决定。
export function BrandIcon({ className = '' }: { className?: string }) {
  return (
    <Image
      src="/icons/app-icon-192.png"
      alt=""
      width={192}
      height={192}
      unoptimized
      aria-hidden
      className={`flex-shrink-0 select-none ${className}`}
    />
  );
}
