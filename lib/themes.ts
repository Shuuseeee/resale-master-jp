// lib/themes.ts — 配色主题注册表
// 主题机制：<html data-palette="..."> 属性 + app/themes.css 中按属性作用域的 token 覆盖块。
// 深浅色（data-theme）与配色（data-palette）是两个正交轴，可自由组合。
// ⚠️ app/layout.tsx 的 theme-init 内联脚本中有一份 headerColor 精简副本
//    （该脚本必须零依赖、先于 paint 执行），新增主题时需同步两处。

export type PaletteId = 'emerald' | 'horizon';

export const PALETTE_STORAGE_KEY = 'snutils-palette';
export const DEFAULT_PALETTE: PaletteId = 'emerald';

export interface PaletteMeta {
  id: PaletteId;
  label: string;
  description: string;
  /** <meta name="theme-color"> 用（Android/桌面浏览器 chrome 颜色） */
  headerColor: string;
  /** 选择器色板预览：[primary, header, bg] */
  preview: [string, string, string];
}

export const PALETTES: PaletteMeta[] = [
  {
    id: 'emerald',
    label: '翡翠绿',
    description: '默认主题',
    headerColor: '#1b1b26',
    preview: ['#10b981', '#1b1b26', '#f8fafc'],
  },
  {
    id: 'horizon',
    label: 'Horizon 蓝',
    description: 'SAP Horizon 风格',
    headerColor: '#354a5f',
    preview: ['#0070f2', '#354a5f', '#f5f6f7'],
  },
];

export function isPaletteId(v: unknown): v is PaletteId {
  return PALETTES.some(p => p.id === v);
}
