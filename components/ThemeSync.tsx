'use client';

import { useEffect } from 'react';
import { applyResolvedTheme, getThemePreference, systemTheme } from '@/lib/theme-mode';

/** 偏好为「跟随系统」时，系统深浅色一变就实时换肤（Loop 实测：不刷新页面立即切换） */
export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (getThemePreference() === 'system') applyResolvedTheme(systemTheme());
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return null;
}
