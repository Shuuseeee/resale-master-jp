'use client';

import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 72; // px to trigger refresh
const MAX_PULL = 100; // max visual pull distance

interface Props {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Refs hold mutable values so touch handlers are registered once (empty deps)
  const startYRef = useRef<number | null>(null);
  const pullYRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (window.scrollY > 0) return;
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
      setPullY(clamped);
    };

    const onTouchEnd = async () => {
      if (startYRef.current === null) return;
      const captured = pullYRef.current;
      startYRef.current = null;
      if (captured >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullY(THRESHOLD);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          pullYRef.current = 0;
          setPullY(0);
        }
      } else {
        pullYRef.current = 0;
        setPullY(0);
      }
    };

    // Listen on window — works regardless of which element is the scroll container
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []); // Empty — refs handle all dynamic values, no re-registration needed

  const progress = Math.min(pullY / THRESHOLD, 1);
  const showIndicator = pullY > 4;

  return (
    <div>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: showIndicator ? `${pullY}px` : 0 }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-teal-500 flex items-center justify-center"
          style={{ opacity: progress }}
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
