// components/Skeleton.tsx — 页面级加载骨架屏 = Loop 切页时的文档区骨架屏（补测-2 #6；颜色 / 流光 design-spec/components/21-misc.css）
// - 13 块：文档头一行 8 块（面包屑 + 右侧按钮位）+ 正文 5 块（标题 / 段落 / 两列卡片 / 大块），没有底部渐隐遮罩
// - 块底色 --loop-skeleton（浅 rgba(0,0,0,.1) / 深 rgba(255,255,255,.1)），同色流光 3s ease-in-out 循环
// - 桌面：文档头那行渲染进 #app-doc-header；正文容器 max-width 1080 居中、上 56、左右 40（≥1600 时 80）
// - 手机外壳（<768）：只有正文 5 块，左右上下沿用页面容器的 16 / 24
'use client';

import { createPortal } from 'react-dom';
import { useDocHeaderSlot } from '@/components/shell/PageHeader';

export function SkeletonItem({ className = '' }: { className?: string }) {
  return <div className={`skeleton-item ${className}`} />;
}

function DocHeaderSkeleton() {
  const slot = useDocHeaderSlot();
  if (!slot) return null;
  return createPortal(
    <div className="doc-header-skeleton" aria-hidden="true">
      <SkeletonItem className="doc-header-skeleton__icon" />
      <SkeletonItem className="doc-header-skeleton__name" />
      <SkeletonItem className="doc-header-skeleton__dot" />
      <SkeletonItem className="doc-header-skeleton__page" />
      <div className="doc-header-skeleton__avatars">
        <SkeletonItem className="doc-header-skeleton__avatar" />
        <SkeletonItem className="doc-header-skeleton__avatar" />
      </div>
      <SkeletonItem className="doc-header-skeleton__pill" />
      <SkeletonItem className="doc-header-skeleton__more" />
    </div>,
    slot,
  );
}

/** 页面级加载：替代整页转圈 /「加载中」，loading.tsx 与各页 isPending 时共用 */
export default function PageSkeleton() {
  return (
    <>
      <DocHeaderSkeleton />
      <div className="page-skeleton" role="status" aria-label="加载中">
        <SkeletonItem className="page-skeleton__title" />
        <SkeletonItem className="page-skeleton__para" />
        <div className="page-skeleton__cols">
          <SkeletonItem />
          <SkeletonItem />
        </div>
        <SkeletonItem className="page-skeleton__block" />
      </div>
    </>
  );
}
