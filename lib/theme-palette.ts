'use client';

// lib/theme-palette.ts — 配色主题切换与云同步（data-palette 轴）
// 首帧应用由 app/layout.tsx 的 theme-init 内联脚本负责（localStorage，先于 paint）；
// 本模块负责运行时切换与 user_preferences 跨设备同步。

import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_STORAGE_KEY,
  isPaletteId,
  type PaletteId,
} from '@/lib/themes';
import { getThemePalette, saveThemePalette } from '@/lib/api/user-preferences';

export function getCurrentPalette(): PaletteId {
  if (typeof document === 'undefined') return DEFAULT_PALETTE;
  const v = document.documentElement.getAttribute('data-palette');
  return isPaletteId(v) ? v : DEFAULT_PALETTE;
}

/** theme-color meta 跟随 palette × 深浅模式（浅 header 主题两种模式颜色不同） */
export function updateThemeColorMeta(id: PaletteId = getCurrentPalette()) {
  const meta = document.querySelector('meta[name="theme-color"]');
  const palette = PALETTES.find(p => p.id === id);
  if (!meta || !palette) return;
  const isDark = document.documentElement.classList.contains('dark');
  meta.setAttribute('content', isDark ? palette.headerColor.dark : palette.headerColor.light);
}

/** 切换配色主题：DOM 属性 + theme-color meta + localStorage +（可选）云端 */
export function applyPalette(id: PaletteId, { sync = true }: { sync?: boolean } = {}) {
  const root = document.documentElement;
  if (id === DEFAULT_PALETTE) {
    root.removeAttribute('data-palette');
  } else {
    root.setAttribute('data-palette', id);
  }

  updateThemeColorMeta(id);

  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, id);
  } catch {
    // 存储失败不阻塞本页切换
  }

  // fire-and-forget：云端列缺失、未登录等错误静默容错，不影响本地主题
  if (sync) void saveThemePalette(id);
}

/** 登录后拉取云端偏好；与本地不同则应用（不回写云端，避免循环） */
export async function syncPaletteFromServer() {
  const remote = await getThemePalette();
  if (!isPaletteId(remote) || remote === getCurrentPalette()) return;
  applyPalette(remote, { sync: false });
}
