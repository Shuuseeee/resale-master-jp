import Image from 'next/image';
import { BRAND_ICONS, BRAND_MARK_RATIO } from '@/lib/brand-icons';

// 品牌标志：透明底、「買取」字本身填 Loop 渐变（scripts/generate-icons.py 生成）。
// 主屏幕图标 / favicon 是另一种（渐变底 + 白字），小尺寸更醒目。高度由调用方 className 决定，宽度按比例。
export function BrandIcon({ className = '' }: { className?: string }) {
  return (
    <Image
      src={BRAND_ICONS.mark}
      alt=""
      width={Math.round(160 * BRAND_MARK_RATIO)}
      height={160}
      unoptimized
      aria-hidden
      className={`w-auto flex-shrink-0 select-none ${className}`}
    />
  );
}
