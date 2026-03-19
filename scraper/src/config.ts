// 常量配置
export const CONFIG = {
  // 轮询间隔
  POLL_INTERVAL_BUSY: 10_000,   // 有任务时 10s
  POLL_INTERVAL_IDLE: 30_000,   // 空闲时 30s

  // 抓取
  SCRAPE_DELAY: 8_000,          // 两次抓取间隔 8s
  PAGE_TIMEOUT: 30_000,         // 页面加载超时 30s
  MAX_ATTEMPTS: 3,              // 最大重试次数

  // 浏览器
  HEADLESS: false,              // 非 headless 更像真人
  USER_DATA_DIR: './browser-data',

  // KaitoriX
  BASE_URL: 'https://kaitorix.app/product',
};
