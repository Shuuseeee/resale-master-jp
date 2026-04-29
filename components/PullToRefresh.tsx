'use client';

import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '@/lib/haptic';

const THRESHOLD = 72;
const MAX_PULL = 100;

interface Props {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  // Refs for DOM manipulation — no React re-renders during drag
  const indicatorRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const pullYRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Directly update indicator DOM — zero React overhead
  const setIndicator = (py: number) => {
    if (!indicatorRef.current) return;
    indicatorRef.current.style.height = py > 4 ? `${py}px` : '0px';
    if (iconRef.current) {
      const progress = Math.min(py / THRESHOLD, 1);
      iconRef.current.style.opacity = String(progress);
      iconRef.current.style.transform = progress >= 1 ? 'rotate(180deg)' : `rotate(${progress * 180}deg)`;
    }
  };

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || window.scrollY > 0) return;
      // 滑动起点在 Modal 内时不参与下拉刷新,避免与 Modal 内滚动冲突
      const target = e.target as HTMLElement | null;
      if (target?.closest('[role="dialog"]')) return;
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshingRef.current) return;
      if (window.scrollY > 0) { startYRef.current = null; return; }
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) { startYRef.current = null; return; }
      e.preventDefault();
      const clamped = Math.min(dy * 0.5, MAX_PULL);
      pullYRef.current = clamped;
      setIndicator(clamped); // direct DOM, no setState
    };

    const onTouchEnd = async () => {
      if (startYRef.current === null) return;
      const captured = pullYRef.current;
      startYRef.current = null;
      pullYRef.current = 0;

      if (captured >= THRESHOLD) {
        triggerHaptic('medium');
        refreshingRef.current = true;
        setRefreshing(true); // only now we use setState
        // Hold indicator open while refreshing
        if (indicatorRef.current) indicatorRef.current.style.height = `${THRESHOLD}px`;
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setIndicator(0);
        }
      } else {
        // Animate back to 0
        if (indicatorRef.current) indicatorRef.current.style.transition = 'height 0.2s ease';
        setIndicator(0);
        setTimeout(() => {
          if (indicatorRef.current) indicatorRef.current.style.transition = '';
        }, 200);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div>
      <div ref={indicatorRef} style={{ height: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-8 h-8 rounded-full border-2 border-apple-gray-3 flex items-center justify-center">
          {refreshing ? (
            <svg className="w-4 h-4 text-apple-gray-1 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 100 10z" />
            </svg>
          ) : (
            <div ref={iconRef} style={{ opacity: 0, transition: 'transform 0.15s' }}>
              <svg className="w-4 h-4 text-apple-gray-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
