// lib/theme.ts
// Apple HIG 风格设计系统

/**
 * 卡片样式 — 去掉 border，用极浅阴影区分层级
 */
export const card = {
  // 主要内容卡片
  primary: 'bg-white dark:bg-apple-cardDark rounded-xl shadow-card',

  // 次要内容卡片
  secondary: 'bg-white dark:bg-apple-cardDark rounded-xl shadow-card',

  // 交互卡片（带 active 反馈）
  interactive: 'bg-white dark:bg-apple-cardDark rounded-xl shadow-card active:bg-apple-gray-6 dark:active:bg-white/5 transition-colors cursor-pointer',

  // 统计卡片
  stat: 'bg-white dark:bg-apple-cardDark rounded-xl shadow-card p-4',
};

/**
 * 按钮样式 — Apple 风格：active:opacity 替代 hover 变色
 */
export const button = {
  // 主要按钮
  primary: 'px-4 py-2 text-[15px] bg-apple-blue text-white rounded-[10px] font-semibold transition-opacity active:opacity-70 disabled:opacity-40 min-h-[44px] flex items-center justify-center',

  // 成功按钮
  success: 'px-4 py-2 text-[15px] bg-apple-green text-white rounded-[10px] font-semibold transition-opacity active:opacity-70 disabled:opacity-40 min-h-[44px] flex items-center justify-center',

  // 危险按钮
  danger: 'px-4 py-2 text-[15px] bg-apple-red text-white rounded-[10px] font-semibold transition-opacity active:opacity-70 disabled:opacity-40 min-h-[44px] flex items-center justify-center',

  // 次要按钮
  secondary: 'px-4 py-2 text-[15px] bg-apple-gray-5 dark:bg-white/10 text-apple-blue dark:text-apple-blue rounded-[10px] font-semibold transition-opacity active:opacity-70 disabled:opacity-40 min-h-[44px] flex items-center justify-center',

  // 幽灵按钮
  ghost: 'px-4 py-2 text-[15px] text-apple-blue active:opacity-70 rounded-[10px] font-medium transition-opacity',

  // 链接按钮
  link: 'text-[15px] text-apple-blue active:opacity-70 font-medium transition-opacity',
};

/**
 * 徽章样式 — 去掉 border，淡底色 pill
 */
export const badge = {
  pending: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-apple-orange/15 text-apple-orange',
  success: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-apple-green/15 text-apple-green',
  error: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-apple-red/15 text-apple-red',
  info: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-apple-blue/15 text-apple-blue',
  neutral: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-apple-gray-5 dark:bg-white/10 text-apple-gray-1 dark:text-apple-gray-3',
  awaiting: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400',
};

/**
 * 输入框样式 — 无边框，极浅阴影
 */
export const input = {
  base: 'px-4 py-2 text-sm bg-white dark:bg-apple-cardDark rounded-lg border border-apple-separator dark:border-apple-sepDark text-gray-900 dark:text-white placeholder-apple-gray-2 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-transparent transition-shadow',
  error: 'w-full px-4 py-2 text-sm bg-white dark:bg-apple-cardDark rounded-lg border border-apple-red/40 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-red/30 transition-shadow',
};

/**
 * 布局样式
 */
export const layout = {
  page: 'min-h-screen bg-apple-bg dark:bg-apple-bgDark',
  container: 'max-w-lg mx-auto px-4 py-6 lg:max-w-5xl',
  section: 'mb-6',
};

/**
 * 标题样式
 */
export const heading = {
  h1: 'text-[28px] leading-tight font-bold tracking-tight text-gray-900 dark:text-white',
  h2: 'text-[22px] font-bold text-gray-900 dark:text-white',
  h3: 'text-[17px] font-semibold text-gray-900 dark:text-white',
  h4: 'text-[15px] font-semibold text-gray-900 dark:text-white',
};

/**
 * Tab 导航样式 — iOS segmented control 风格
 */
export const tabs = {
  container: 'bg-apple-gray-5 dark:bg-white/10 rounded-[10px] p-0.5',
  tab: {
    base: 'flex-1 px-3 py-1.5 rounded-[8px] font-medium text-[13px] transition-all',
    active: 'bg-white dark:bg-apple-cardDark shadow-card text-gray-900 dark:text-white',
    inactive: 'text-apple-gray-1 dark:text-apple-gray-3',
  },
};

/**
 * 加载状态样式
 */
export const loading = {
  spinner: 'inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-apple-blue',
  container: 'text-center py-12',
  text: 'text-apple-gray-1 mt-4 text-[15px]',
};

/**
 * 空状态样式
 */
export const empty = {
  container: 'bg-white dark:bg-apple-cardDark rounded-xl shadow-card p-12 text-center',
  text: 'text-apple-gray-1 text-[15px]',
};

/**
 * 提示消息样式 — 无 border，淡底色
 */
export const alert = {
  success: 'mb-4 bg-apple-green/10 text-apple-green px-4 py-3 rounded-xl text-[15px]',
  error: 'mb-4 bg-apple-red/10 text-apple-red px-4 py-3 rounded-xl text-[15px]',
  warning: 'mb-4 bg-apple-orange/10 text-apple-orange px-4 py-3 rounded-xl text-[15px]',
  info: 'mb-4 bg-apple-blue/10 text-apple-blue px-4 py-3 rounded-xl text-[15px]',
};
