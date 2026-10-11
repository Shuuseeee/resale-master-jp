// 应用图标与品牌标志的地址（由 scripts/generate-icons.py 生成）。
// 目录带版本：Service Worker 对 /icons/ 是 CacheFirst 30 天，换图时必须换地址，否则旧设备一直用旧图。
// 换图：改脚本里的 ICON_VERSION 并运行，再改这里的 ICON_DIR。
const ICON_DIR = '/icons/v2';

export const BRAND_ICONS = {
  /** 圆角渐变底 + 白字（purpose=any） */
  app192: `${ICON_DIR}/app-icon-192.png`,
  app512: `${ICON_DIR}/app-icon-512.png`,
  /** 满铺、字缩到 80%（purpose=maskable） */
  maskable192: `${ICON_DIR}/app-icon-maskable-192.png`,
  maskable512: `${ICON_DIR}/app-icon-maskable-512.png`,
  /** iOS 主屏幕：满铺不透明，iOS 自己加圆角 */
  appleTouch: `${ICON_DIR}/apple-touch-icon.png`,
  /** 品牌标志：透明底、字本身填渐变（左上角、登录页） */
  mark: `${ICON_DIR}/brand-mark.png`,
} as const;

/** brand-mark.png 的宽高比（313×160） */
export const BRAND_MARK_RATIO = 313 / 160;
