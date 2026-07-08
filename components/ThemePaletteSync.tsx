'use client';

// 登录态就绪后同步一次云端配色主题（跨设备一致），详见 lib/theme-palette.ts
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { syncPaletteFromServer } from '@/lib/theme-palette';

export function ThemePaletteSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    void syncPaletteFromServer();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
