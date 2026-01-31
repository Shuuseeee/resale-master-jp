// lib/theme.ts
// 统一的设计系统配置

/**
 * 卡片样式
 */
export const card = {
  // 主要内容卡片（实心）
  primary: 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm',

  // 次要内容卡片（半透明）
  secondary: 'bg-gray-100/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50',

  // 交互卡片（带hover效果）
  interactive: 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer',

  // 统计卡片
  stat: 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6',
};

/**
 * 按钮样式
 */
export const button = {
  // 主要按钮（实心）
  primary: 'px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-all shadow-sm min-h-[44px] flex items-center justify-center',

  // 成功按钮
  success: 'px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-all shadow-sm min-h-[44px] flex items-center justify-center',

  // 危险按钮
  danger: 'px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-95 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-all shadow-sm min-h-[44px] flex items-center justify-center',

  // 次要按钮（半透明）
  secondary: 'px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 active:scale-95 text-gray-900 dark:text-white rounded-lg font-medium transition-all border border-gray-200 dark:border-gray-700 min-h-[44px] flex items-center justify-center',

  // 幽灵按钮
  ghost: 'px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 active:scale-95 rounded-lg font-medium transition-all',

  // 链接按钮
  link: 'text-sm md:text-base text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors',
};

/**
 * 徽章样式
 */
export const badge = {
  pending: 'px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400',
  success: 'px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  error: 'px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-600 dark:text-red-400',
  info: 'px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400',
  neutral: 'px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-600 dark:text-gray-400',
};

/**
 * 输入框样式
 */
export const input = {
  base: 'px-3 py-2 md:px-4 text-sm md:text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors min-h-[44px]',
  error: 'w-full px-3 py-2 md:px-4 text-sm md:text-base bg-white dark:bg-gray-800 border border-red-500 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors min-h-[44px]',
};

/**
 * 布局样式
 */
export const layout = {
  page: 'min-h-screen bg-gray-50 dark:bg-gray-900',
  container: 'max-w-7xl mx-auto px-4 py-8',
  section: 'mb-8',
};

/**
 * 标题样式
 */
export const heading = {
  h1: 'text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white',
  h2: 'text-xl md:text-2xl font-bold text-gray-900 dark:text-white',
  h3: 'text-lg md:text-xl font-semibold text-gray-900 dark:text-white',
  h4: 'text-base md:text-lg font-semibold text-gray-900 dark:text-white',
};

/**
 * Tab导航样式
 */
export const tabs = {
  container: 'bg-white dark:bg-gray-800 rounded-xl p-2 border border-gray-200 dark:border-gray-700',
  tab: {
    base: 'flex-1 px-4 py-2 rounded-lg font-medium transition-colors',
    active: 'bg-blue-600 text-white',
    inactive: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700',
  },
};

/**
 * 加载状态样式
 */
export const loading = {
  spinner: 'inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600',
  container: 'text-center py-12',
  text: 'text-gray-600 dark:text-gray-400 mt-4',
};

/**
 * 空状态样式
 */
export const empty = {
  container: 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center',
  text: 'text-gray-600 dark:text-gray-400 text-base md:text-lg',
};

/**
 * 提示消息样式
 */
export const alert = {
  success: 'mb-6 bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-lg',
  error: 'mb-6 bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg',
  warning: 'mb-6 bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-4 py-3 rounded-lg',
  info: 'mb-6 bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 px-4 py-3 rounded-lg',
};
