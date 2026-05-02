// lib/theme.ts
// Apple HIG 风格设计系统

/**
 * 卡片样式 — 去掉 border，用极浅阴影区分层级
 */
export const card = {
  // 主要内容卡片
  primary: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]',

  // 次要内容卡片
  secondary: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]',

  // 交互卡片（带 active 反馈）
  interactive: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary)] transition-all cursor-pointer',

  // 统计卡片
  stat: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-4',
};

/**
 * 按钮样式 — Apple 风格：active:opacity 替代 hover 变色
 */
export const button = {
  // 主要按钮
  primary: 'px-5 py-2.5 text-sm bg-gradient-to-br from-[var(--color-primary)] to-[#059669] text-[var(--color-text-inverted)] rounded-[var(--radius-md)] font-semibold transition-all hover:-translate-y-px hover:shadow-[0_4px_8px_rgba(16,185,129,0.35)] active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] inline-flex items-center justify-center',

  // 成功按钮
  success: 'px-5 py-2.5 text-sm bg-[var(--color-success)] text-[var(--color-text-inverted)] rounded-[var(--radius-md)] font-semibold transition-all hover:bg-[#059669] disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] inline-flex items-center justify-center',

  // 危险按钮
  danger: 'px-5 py-2.5 text-sm bg-[var(--color-danger)] text-[var(--color-text-inverted)] rounded-[var(--radius-md)] font-semibold transition-all hover:bg-[#dc2626] disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] inline-flex items-center justify-center',

  // 次要按钮
  secondary: 'px-5 py-2.5 text-sm bg-[var(--color-bg-elevated)] text-[var(--color-text)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-semibold transition-all hover:bg-[var(--color-bg-subtle)] hover:border-[var(--color-text-muted)] disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] inline-flex items-center justify-center',

  // 幽灵按钮
  ghost: 'px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)] font-medium transition-all',

  // 链接按钮
  link: 'text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors',
};

/**
 * 徽章样式 — 去掉 border，淡底色 pill
 */
export const badge = {
  pending: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[rgba(245,158,11,0.12)] text-[var(--color-warning)]',
  success: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-subtle)] text-[var(--color-primary)]',
  error: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[rgba(239,68,68,0.12)] text-[var(--color-danger)]',
  info: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[rgba(59,130,246,0.12)] text-[var(--color-info)]',
  neutral: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]',
  awaiting: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400',
};

/**
 * 输入框样式 — 无边框，极浅阴影
 */
export const input = {
  base: 'px-3.5 py-2.5 text-sm bg-[var(--color-bg-elevated)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[color:var(--color-text-muted)] placeholder:opacity-50 focus:outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-light)] transition-all',
  error: 'w-full px-3.5 py-2.5 text-sm bg-[var(--color-bg-elevated)] rounded-[var(--radius-md)] border border-[var(--color-danger)] text-[var(--color-text)] placeholder-[color:var(--color-text-muted)] focus:outline-none focus:ring-4 focus:ring-[rgba(239,68,68,0.15)] transition-all',
};

/**
 * 布局样式
 */
export const layout = {
  page: 'min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]',
  container: 'max-w-lg mx-auto px-4 py-6 lg:max-w-none lg:px-6 lg:py-6',
  section: 'mb-6',
};

/**
 * 标题样式
 */
export const heading = {
  h1: 'text-[28px] leading-tight font-bold tracking-tight text-[var(--color-text)]',
  h2: 'text-[22px] font-bold text-[var(--color-text)]',
  h3: 'text-[17px] font-semibold text-[var(--color-text)]',
  h4: 'text-[15px] font-semibold text-[var(--color-text)]',
};

/**
 * Tab 导航样式 — iOS segmented control 风格
 */
export const tabs = {
  container: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-1',
  tab: {
    base: 'flex-1 px-3 py-1.5 rounded-[var(--radius-md)] font-medium text-[13px] transition-all',
    active: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
    inactive: 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]',
  },
};

/**
 * 加载状态样式
 */
export const loading = {
  spinner: 'inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-[var(--color-primary)]',
  container: 'text-center py-12',
  text: 'text-[var(--color-text-muted)] mt-4 text-sm',
};

/**
 * 空状态样式
 */
export const empty = {
  container: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-12 text-center',
  text: 'text-[var(--color-text-muted)] text-sm',
};

/**
 * 提示消息样式 — 无 border，淡底色
 */
export const alert = {
  success: 'mb-4 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] text-[var(--color-primary)] px-4 py-3 rounded-[var(--radius-md)] text-sm',
  error: 'mb-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[var(--color-danger)] px-4 py-3 rounded-[var(--radius-md)] text-sm',
  warning: 'mb-4 bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] text-[var(--color-warning)] px-4 py-3 rounded-[var(--radius-md)] text-sm',
  info: 'mb-4 bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.3)] text-[var(--color-info)] px-4 py-3 rounded-[var(--radius-md)] text-sm',
};
