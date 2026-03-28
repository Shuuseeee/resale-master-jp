'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const THRESHOLD = 72; // px needed to trigger refresh
const MAX_PULL = 100; // max visual pull distance

interface Props {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canPull = useCallback(() => {
    // Only allow pull when already at top of scroll
    return (containerRef.current?.scrollTop ?? 0) === 0;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!canPull()) return;
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) { startYRef.current = null; return; }
      if (!canPull()) return;
      e.preventDefault();
      // Apply rubber-band feel: diminishing returns past threshold
      const clamped = Math.min(dy * 0.5, MAX_PULL);
      setPullY(clamped);
    };

    const onTouchEnd = async () => {
      if (startYRef.current === null) return;
      startYRef.current = null;
      if (pullY >= THRESHOLD) {
        setRefreshing(true);
        setPullY(THRESHOLD); // hold at threshold while refreshing
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullY(0);
        }
      } else {
        setPullY(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullY, refreshing, onRefresh, canPull]);

  const progress = Math.min(pullY / THRESHOLD, 1);
  const showIndicator = pullY > 4;

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: showIndicator ? `${pullY}px` : 0 }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-teal-500 flex items-center justify-center transition-transform"
          style={{ transform: `rotate(${progress * 360}deg)`, opacity: progress }}
        >
          {refreshing ? (
            <svg className="w-4 h-4 text-teal-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 100 10z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-teal-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              style={{ transform: progress >= 1 ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
