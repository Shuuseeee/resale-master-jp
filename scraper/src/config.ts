// 常量配置
export const CONFIG = {
  // 轮询间隔（基准值，实际会加随机抖动）
  POLL_INTERVAL_BUSY: 3_000,
  POLL_INTERVAL_IDLE: 3_000,

  // 抓取
  SCRAPE_DELAY: 2_000,
  PAGE_TIMEOUT: 30_000,
  MAX_ATTEMPTS: 3,

  // 浏览器
  HEADLESS: false,
  USER_DATA_DIR: './browser-data',

  // KaitoriX
  BASE_URL: 'https://kaitorix.app/product',
};

/** 在 base 基础上加 ±30% 随机抖动 */
export function jitter(base: number): number {
  const factor = 0.7 + Math.random() * 0.6; // 0.7 ~ 1.3
  return Math.round(base * factor);
}
