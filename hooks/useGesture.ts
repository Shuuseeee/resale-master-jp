// hooks/useGesture.ts
'use client';

import { useRef, useEffect, useCallback } from 'react';

interface GestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  threshold?: number; // 滑动阈值（像素）
  longPressDelay?: number; // 长按延迟（毫秒）
  doubleTapDelay?: number; // 双击延迟（毫秒）
}

export function useGesture<T extends HTMLElement = HTMLElement>(
  config: GestureConfig
) {
  const elementRef = useRef<T>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);

  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onLongPress,
    onDoubleTap,
    threshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300,
  } = config;

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      // 启动长按计时器
      if (onLongPress) {
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          onLongPress();
          touchStartRef.current = null; // 触发后清空，防止后续滑动事件
        }, longPressDelay);
      }
    },
    [onLongPress, longPressDelay, clearLongPressTimer]
  );

  const handleTouchMove = useCallback(() => {
    // 移动时取消长按
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      clearLongPressTimer();

      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // 检测滑动
      const isSwipe = Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold;

      if (isSwipe) {
        // 判断滑动方向
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // 水平滑动
          if (deltaX > threshold && onSwipeRight) {
            onSwipeRight();
          } else if (deltaX < -threshold && onSwipeLeft) {
            onSwipeLeft();
          }
        } else {
          // 垂直滑动
          if (deltaY > threshold && onSwipeDown) {
            onSwipeDown();
          } else if (deltaY < -threshold && onSwipeUp) {
            onSwipeUp();
          }
        }
      } else if (onDoubleTap) {
        // 检测双击
        const now = Date.now();
        if (now - lastTapRef.current < doubleTapDelay) {
          onDoubleTap();
          lastTapRef.current = 0; // 重置以防三击
        } else {
          lastTapRef.current = now;
        }
      }

      touchStartRef.current = null;
    },
    [
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      onDoubleTap,
      threshold,
      doubleTapDelay,
      clearLongPressTimer,
    ]
  );

  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    touchStartRef.current = null;
  }, [clearLongPressTimer]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // 添加被动监听以提升滚动性能
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
      clearLongPressTimer();
    };
  }, [
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    clearLongPressTimer,
  ]);

  return elementRef;
}

// 专用 Hook：滑动删除
export function useSwipeToDelete(onDelete: () => void, threshold = 80) {
  return useGesture({
    onSwipeLeft: onDelete,
    threshold,
  });
}

// 专用 Hook：长按菜单
export function useLongPressMenu(onShow: () => void, delay = 500) {
  return useGesture({
    onLongPress: onShow,
    longPressDelay: delay,
  });
}

// 专用 Hook：双击缩放
export function useDoubleTapZoom(onZoom: () => void) {
  return useGesture({
    onDoubleTap: onZoom,
  });
}
