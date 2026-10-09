// lib/theme.ts
// 常用 Tailwind 片段；外观以 Microsoft Loop（Fluent 2）为蓝本，颜色只用 --color-* / --label-* 语义 token

/**
 * 卡片样式 — Loop 内容卡片（design-spec/components/16-card.css）：radius 12、1px Stroke2 边框、无阴影
 */
export const card = {
  // 主要内容卡片
  primary: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)]',

  // 次要内容卡片
  secondary: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)]',

  // 可点卡片：悬停两层 drop-shadow、无过渡（globals.css .fluent-card-interactive）
  interactive: 'fluent-card-interactive bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-lg)] cursor-pointer',

  // 统计卡 = 无边框变体（NeutralBackground2 底，用户确认的映射）
  stat: 'bg-[var(--color-bg-stat)] rounded-[var(--radius-lg)] p-4',
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
 * 徽章样式 — Loop 标签（design-spec/components/11-badge.css 表格内紧凑型：高 22、radius 4、14/22/400；深色下仍是浅底深字）
 */
export const badge = {
  pending: 'inline-flex items-center h-[22px] px-1.5 rounded-[var(--radius-sm)] text-sm leading-[22px] font-normal bg-[var(--label-warning-bg)] text-[var(--label-warning-fg)]',
  success: 'inline-flex items-center h-[22px] px-1.5 rounded-[var(--radius-sm)] text-sm leading-[22px] font-normal bg-[var(--label-success-bg)] text-[var(--label-success-fg)]',
  error: 'inline-flex items-center h-[22px] px-1.5 rounded-[var(--radius-sm)] text-sm leading-[22px] font-normal bg-[var(--label-danger-bg)] text-[var(--label-danger-fg)]',
  info: 'inline-flex items-center h-[22px] px-1.5 rounded-[var(--radius-sm)] text-sm leading-[22px] font-normal bg-[var(--label-info-bg)] text-[var(--label-info-fg)]',
  neutral: 'inline-flex items-center h-[22px] px-1.5 rounded-[var(--radius-sm)] text-sm leading-[22px] font-normal bg-[var(--label-neutral-bg)] text-[var(--label-neutral-fg)]',
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
 * 空状态 — Loop 空状态（design-spec/components/20-empty-state.css）：居中，标题 16/22/600，说明 12/16 Foreground2、上 8 下 12
 */
export const empty = {
  container: 'flex flex-col items-center justify-center px-4 py-12 text-center',
  title: 'text-base leading-[22px] font-semibold text-[var(--color-text)]',
  text: 'mt-2 mb-3 text-xs leading-4 text-[var(--color-text-secondary)]',
};

/**
 * 表格样式 — Fluent Table（design-spec/components/10-table.css）：14/20、正文 Foreground2，表头 32 高 600，
 * Stroke2 分隔线，单元格左右 8；行悬停 / 按下 / 选中为 Subtle 底色。单元格上下内边距用 --table-cell-py（用户决定暂保持 12px）
 * 对齐类（text-left 等）由 DataTable 按列 meta.align 动态附加，此处不写死
 */
export const table = {
  wrapper: 'overflow-x-auto scroll-embed',
  table: 'w-full border-collapse text-sm leading-5 text-[var(--color-text-secondary)]',
  theadTr: 'border-b border-[var(--color-border)]',
  th: 'h-8 px-2 text-sm leading-5 font-semibold text-[var(--color-text-secondary)] whitespace-nowrap',
  sortBtn: 'inline-flex items-center gap-1 hover:text-[var(--color-text)] transition-colors',
  tbody: 'divide-y divide-[var(--color-border)] border-b border-[var(--color-border)]',
  tr: 'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)] active:bg-[var(--color-bg-pressed)]',
  trSelected: 'bg-[var(--color-bg-selected)]',
  trSelectable: 'cursor-pointer',
  trChild: 'bg-[var(--color-bg-subtle)]',
  td: 'px-2 py-[var(--table-cell-py)]',
};
