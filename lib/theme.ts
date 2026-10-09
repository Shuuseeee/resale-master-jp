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
 * 按钮样式 — Fluent Button（样式在 globals.css 的 .fluent-btn*；桌面 32 高，手机保持 40 高触控尺寸）
 */
export const button = {
  // 品牌主按钮
  primary: 'fluent-btn fluent-btn--primary',

  // 危险按钮（StatusDanger 底 + brightness，用户确认的映射）
  danger: 'fluent-btn fluent-btn--danger',

  // 次要按钮 = Fluent 默认（描边）
  secondary: 'fluent-btn fluent-btn--default',

  // 幽灵按钮 = Fluent subtle（内容区变体：悬停 / 按下换底色）
  ghost: 'fluent-btn fluent-btn--subtle',

  // 链接按钮 = Fluent Link
  link: 'fluent-link',
};

/**
 * 徽章样式 — 去掉 border，淡底色 pill
 */
export const badge = {
  pending: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--label-warning-bg)] text-[var(--label-warning-fg)]',
  success: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--label-success-bg)] text-[var(--label-success-fg)]',
  error: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--label-danger-bg)] text-[var(--label-danger-fg)]',
  info: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--label-info-bg)] text-[var(--label-info-fg)]',
  neutral: 'px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--label-neutral-bg)] text-[var(--label-neutral-fg)]',
};

/**
 * 输入框样式 — Fluent Input filled-darker（样式在 globals.css 的 .fluent-input；下拉触发器同用）
 */
export const input = {
  base: 'fluent-input',
  error: 'fluent-input fluent-input--error w-full',
};

/**
 * 布局样式
 */
export const layout = {
  // 桌面外壳里页面在内容卡片中滚动，不能再撑满一屏（否则每页都多出一截滚动）
  page: 'min-h-screen md:min-h-full text-[var(--color-text)]',
  // 桌面：Loop 正文列最大 920 + 左右内边距 40 = 1000，居中，上下 25（列表 / 表格 / 图表页也一样，表格放不下时在表格内横向滚动）
  container: 'max-w-lg mx-auto px-4 py-6 md:max-w-[1000px] md:px-10 md:py-[25px]',
  // 手机端用各页自己的容器类、桌面同上的页面（设置、表单、详情）只取桌面部分
  narrowDesktop: 'md:max-w-[1000px] md:px-10 md:py-[25px]',
  section: 'mb-6',
};

/**
 * 标题样式
 */
export const heading = {
  h1: 'text-[28px] leading-tight font-bold tracking-tight text-[var(--color-text)]',
  // 页面大标题（每页一个）：手机沿用 h1；桌面 = Loop 页面标题 40/48/600、display 字体（design-spec/components/18-headings.css），
  // 文档头底边 → 标题顶 64（内容区上内边距 25 + 39）、标题底 → 正文 27（补测-2 #5）
  page: 'text-[28px] leading-tight font-bold tracking-tight text-[var(--color-text)] md:mt-[39px] md:mb-[27px] md:text-[40px] md:leading-[48px] md:font-semibold md:tracking-normal md:[font-family:var(--loop-font-display)]',
  // 只有桌面部分：手机端标题有自己样式的页面（详情、编辑）拼这一段
  pageDesktop: 'md:mt-[39px] md:mb-[27px] md:text-[40px] md:leading-[48px] md:font-semibold md:tracking-normal md:[font-family:var(--loop-font-display)]',
  // 正文 H2 / H3：桌面按 Loop 实测 24/32、20/28（600）；手机不变
  h2: 'text-[22px] font-bold text-[var(--color-text)] md:text-[24px] md:leading-[32px] md:font-semibold',
  h3: 'text-[17px] font-semibold text-[var(--color-text)] md:text-[20px] md:leading-[28px]',
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
    inactive: 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
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
 * 表格样式 — 供 components/DataTable 使用的统一片段
 * 对齐类（text-left 等）由 DataTable 按列 meta.align 动态附加，此处不写死
 */
export const table = {
  wrapper: 'overflow-x-auto scroll-embed',
  table: 'w-full border-collapse text-sm',
  theadTr: 'border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]',
  th: 'px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap',
  sortBtn: 'inline-flex items-center gap-1 hover:text-[var(--color-text)] transition-colors uppercase tracking-wider',
  tbody: 'divide-y divide-[var(--color-border)]',
  tr: 'transition-colors hover:bg-[var(--color-bg-hover)]',
  trSelected: 'bg-[var(--color-primary-light)]',
  trSelectable: 'cursor-pointer',
  trChild: 'bg-[var(--color-bg-subtle)]',
  td: 'px-4 py-3 text-[var(--color-text)]',
};

/**
 * 提示消息样式 — 无 border，淡底色
 */
export const alert = {
  success: 'mb-4 bg-[var(--color-success-subtle)] border border-[var(--color-success-border)] text-[var(--color-success)] px-4 py-3 rounded-[var(--radius-md)] text-sm',
  error: 'mb-4 bg-[var(--color-danger-subtle)] border border-[var(--color-danger-border)] text-[var(--color-danger)] px-4 py-3 rounded-[var(--radius-md)] text-sm',
  warning: 'mb-4 bg-[var(--color-warning-subtle)] border border-[var(--color-warning-border)] text-[var(--color-warning)] px-4 py-3 rounded-[var(--radius-md)] text-sm',
  info: 'mb-4 bg-[var(--color-info-subtle)] border border-[var(--color-info-border)] text-[var(--color-info)] px-4 py-3 rounded-[var(--radius-md)] text-sm',
};
