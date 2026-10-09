// components/shell/PageHeader.tsx — 桌面外壳的文档头工具栏（Loop .dhd：54.8px，原稿 css/sections/04-doc-header.css）
// - 左：面包屑（Loop 的「工作区 › 页面」→ 我们的「导航页 › 分区 / 子页面」）；中：40px 空列（Loop 放在线头像）；右：操作
// - 操作：一般操作是 subtle 图标按钮（tooltip 在下方居中），最多一个品牌主按钮（带文字），其余收进「…」菜单
//   （bottom-end、与按钮间距 0，补测-2 #2）；宽度不够时按 priority 从大到小依次收进「…」（Loop 768 宽时就是这样）
// - 渲染到外壳内容卡片顶部的 #app-doc-header（不随页面滚动）；手机外壳（<768）不显示，各页面在自己的标题区放按钮
'use client';

import { Fragment, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FluentIcon } from '@fluentui/react-icons/headless';
import { ChevronRight12Regular } from '@fluentui/react-icons/headless/svg/chevron-right';
import { MoreHorizontal20Filled, MoreHorizontal20Regular } from '@fluentui/react-icons/headless/svg/more-horizontal';
import DualIcon from '@/components/fluent/DualIcon';
import { Menu, MenuItem } from '@/components/fluent/Menu';
import { useTooltip } from '@/components/fluent/Tooltip';
import { DOC_HEADER_ID } from '@/lib/app-scroll';

export interface PageCrumb {
  label: string;
  href?: string;
}

export interface PageAction {
  id: string;
  /** 主按钮上的文字；图标按钮的 tooltip / 无障碍名称；菜单项文字 */
  label: string;
  icon: { regular: FluentIcon; filled: FluentIcon };
  onClick?: () => void;
  href?: string;
  /** 品牌主按钮（带文字），每页最多一个 */
  primary?: boolean;
  /** 切换型操作的当前状态 */
  pressed?: boolean;
  disabled?: boolean;
  /** 宽度不够时收起的顺序：数字越大越先收进「…」；默认主按钮 0、其余按出现顺序 1, 2, … */
  priority?: number;
  /** 只放在「…」菜单里 */
  menuOnly?: boolean;
  /** 只在满足该媒体查询时出现（如只在卡片视图里需要的操作） */
  media?: string;
}

const GAP = 8;

function subscribeNothing() {
  return () => {};
}

/** 多个媒体查询的匹配结果，拼成「0 / 1」字符串作为快照（引用稳定）；服务端渲染时都按不匹配 */
function useMediaMatches(queries: string[]) {
  const key = queries.join('\n');
  const subscribe = useCallback(
    (callback: () => void) => {
      const lists = key ? key.split('\n').map(q => window.matchMedia(q)) : [];
      lists.forEach(list => list.addEventListener('change', callback));
      return () => lists.forEach(list => list.removeEventListener('change', callback));
    },
    [key],
  );
  const getSnapshot = useCallback(() => (key ? key.split('\n').map(q => (window.matchMedia(q).matches ? '1' : '0')).join('') : ''), [key]);
  const getServerSnapshot = useCallback(() => (key ? key.split('\n').map(() => '0').join('') : ''), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function outerWidth(el: Element) {
  const style = getComputedStyle(el);
  return el.getBoundingClientRect().width + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
}

function IconAction({ action, measure }: { action: PageAction; measure?: boolean }) {
  const tip = useTooltip(action.label, { placement: 'bottom' });
  const icon = <DualIcon regular={action.icon.regular} filled={action.icon.filled} />;
  if (measure) return <span className="shell-icon-btn">{icon}</span>;
  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className="shell-icon-btn" aria-label={action.label} {...tip}>
        {icon}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="shell-icon-btn"
      aria-label={action.label}
      aria-pressed={action.pressed}
      disabled={action.disabled}
      onClick={action.onClick}
      {...tip}
    >
      {icon}
    </button>
  );
}

function PrimaryAction({ action, measure }: { action: PageAction; measure?: boolean }) {
  const content = (
    <>
      <span className="doc-header__primary-icon">
        <DualIcon regular={action.icon.regular} filled={action.icon.filled} />
      </span>
      {action.label}
    </>
  );
  if (measure) return <span className="doc-header__primary">{content}</span>;
  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className="doc-header__primary">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className="doc-header__primary" disabled={action.disabled} onClick={action.onClick}>
      {content}
    </button>
  );
}

function ActionView({ action, measure }: { action: PageAction; measure?: boolean }) {
  return action.primary ? <PrimaryAction action={action} measure={measure} /> : <IconAction action={action} measure={measure} />;
}

function MoreButton({ open, onToggle, buttonRef }: { open: boolean; onToggle: () => void; buttonRef: RefObject<HTMLButtonElement | null> }) {
  const tip = useTooltip('更多操作', { placement: 'bottom' });
  return (
    <div className="doc-header__more">
      <button
        ref={buttonRef}
        type="button"
        className="shell-icon-btn"
        aria-label="更多操作"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        {...tip}
      >
        <DualIcon regular={MoreHorizontal20Regular} filled={MoreHorizontal20Filled} />
      </button>
    </div>
  );
}

export default function PageHeader({ crumbs, actions = [] }: { crumbs: PageCrumb[]; actions?: PageAction[] }) {
  const router = useRouter();
  const slot = useSyncExternalStore(subscribeNothing, () => document.getElementById(DOC_HEADER_ID), () => null);
  const queries = Array.from(new Set(actions.flatMap(a => (a.media ? [a.media] : []))));
  const matches = useMediaMatches(queries);
  const available = actions.filter(a => !a.media || matches[queries.indexOf(a.media)] === '1');
  const candidates = available.filter(a => !a.menuOnly);
  const menuOnly = available.filter(a => a.menuOnly);

  const rightRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // 测量每个操作的宽度（隐藏的测量层与实际按钮同样式），放不下时按 priority 从大到小收进「…」
  const layoutKey = candidates.map(a => `${a.id}:${a.primary ? a.label : ''}`).join('|') + `#${menuOnly.length}`;
  useLayoutEffect(() => {
    const right = rightRef.current;
    const measure = measureRef.current;
    if (!right || !measure) return;
    const compute = () => {
      const items = Array.from(measure.children);
      const widths = candidates.map((_, i) => outerWidth(items[i]));
      const moreWidth = outerWidth(items[candidates.length]);
      const available = right.clientWidth;
      const order = candidates
        .map((action, index) => ({ index, priority: action.priority ?? (action.primary ? 0 : index + 1) }))
        .sort((a, b) => b.priority - a.priority);
      const hidden = new Set<number>();
      const fits = () => {
        const shown = candidates.map((_, i) => i).filter(i => !hidden.has(i));
        const needMore = menuOnly.length > 0 || hidden.size > 0;
        const count = shown.length + (needMore ? 1 : 0);
        const width = shown.reduce((sum, i) => sum + widths[i], 0) + (needMore ? moreWidth : 0) + Math.max(0, count - 1) * GAP;
        return width <= available;
      };
      for (const { index } of order) {
        if (fits()) break;
        hidden.add(index);
      }
      const next = candidates.filter((_, i) => hidden.has(i)).map(a => a.id).join('|');
      setCollapsed(prev => (prev === next ? prev : next));
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(right);
    return () => observer.disconnect();
    // candidates / menuOnly 的变化都体现在 layoutKey 里
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, layoutKey]);

  if (!slot) return null;

  const collapsedIds = new Set(collapsed ? collapsed.split('|') : []);
  const inline = candidates.filter(a => !collapsedIds.has(a.id));
  // Loop：被收起的操作排在「…」菜单原有项之后
  const menuItems = [...menuOnly, ...candidates.filter(a => collapsedIds.has(a.id))];

  const runAction = (action: PageAction) => {
    setMenuOpen(false);
    if (action.disabled) return;
    if (action.href) router.push(action.href);
    else action.onClick?.();
  };

  const crumbView: ReactNode = crumbs.map((crumb, i) => (
    <Fragment key={`${i}-${crumb.label}`}>
      {i > 0 && <ChevronRight12Regular className="doc-header__chev" />}
      {crumb.href ? (
        <Link href={crumb.href} className="doc-header__crumb doc-header__crumb--link">
          <span className="doc-header__crumb-text">{crumb.label}</span>
        </Link>
      ) : (
        <span className="doc-header__crumb" aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
          <span className="doc-header__crumb-text">{crumb.label}</span>
        </span>
      )}
    </Fragment>
  ));

  return createPortal(
    <>
      <div className="doc-header" role="toolbar" aria-label="页面工具栏">
        <nav className="doc-header__left" aria-label="当前位置">
          {crumbView}
        </nav>
        <div className="doc-header__center" />
        <div ref={rightRef} className="doc-header__right">
          {inline.map(action => (
            <ActionView key={action.id} action={action} />
          ))}
          {menuItems.length > 0 && <MoreButton open={menuOpen} onToggle={() => setMenuOpen(v => !v)} buttonRef={moreRef} />}
        </div>
        <div ref={measureRef} className="doc-header__measure" aria-hidden="true">
          {candidates.map(action => (
            <ActionView key={action.id} action={action} measure />
          ))}
          <div className="doc-header__more">
            <span className="shell-icon-btn" />
          </div>
        </div>
      </div>
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={moreRef} placement="bottom-end" ariaLabel="更多操作" width={240}>
        {menuItems.map(action => (
          <MenuItem
            key={action.id}
            icon={<DualIcon regular={action.icon.regular} filled={action.icon.filled} />}
            disabled={action.disabled}
            checked={action.pressed}
            onSelect={() => runAction(action)}
          >
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </>,
    slot,
  );
}
