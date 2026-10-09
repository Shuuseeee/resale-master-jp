// components/shell/NavRail.tsx — 桌面外壳左导航（Loop：新建胶囊 + 折叠按钮 + 分组 Tab）
// 规格：Loop 浅色复刻 css/sections/02-nav.css、js/sections/02-nav.js，深色 design-spec/dark.css，样式在 globals.css .nav-rail / .new-pill
'use client';

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, ClipboardList, FileText, Home, Package, PanelLeft, ScanBarcode, Settings } from 'lucide-react';
import { Menu, MenuItem } from '@/components/fluent/Menu';
import { hideTooltipNow, useTooltip } from '@/components/fluent/Tooltip';
import { NAV_AUTO_COLLAPSE_QUERY, applyNavCollapsed, hasStoredNavMode, isNavCollapsed, setNavCollapsed } from '@/lib/nav-mode';

interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
}

// 第一组无标题，后续分组带标题（与 Loop 相同）；「记录交易」由新建胶囊承担
const NAV_GROUPS: { caption?: string; items: NavItem[] }[] = [
  {
    items: [
      { name: '仪表盘', href: '/dashboard', icon: <Home className="h-5 w-5" /> },
      { name: '交易列表', href: '/transactions', icon: <ClipboardList className="h-5 w-5" /> },
      { name: '买取价格', href: '/kaitorix-prices', icon: <ScanBarcode className="h-5 w-5" /> },
    ],
  },
  {
    caption: '报表',
    items: [
      { name: '数据分析', href: '/analytics', icon: <BarChart3 className="h-5 w-5" /> },
      { name: '税务申报', href: '/tax-report', icon: <FileText className="h-5 w-5" /> },
    ],
  },
  {
    caption: '管理',
    items: [
      { name: '耗材管理', href: '/supplies', icon: <Package className="h-5 w-5" /> },
      { name: '设置', href: '/settings', icon: <Settings className="h-5 w-5" /> },
    ],
  },
];

const ALL_HREFS = NAV_GROUPS.flatMap(g => g.items.map(i => i.href));

function activeHrefOf(pathname: string | null) {
  if (!pathname) return null;
  return ALL_HREFS.find(href => pathname === href || pathname.startsWith(href + '/')) ?? null;
}

/** 导航上的 tooltip：折叠态全部显示；展开态只在文字被截断时显示；位置在目标右侧 */
function navTipWhen(target: HTMLElement) {
  if (isNavCollapsed()) return true;
  const label = target.querySelector<HTMLElement>('.nav-rail__label');
  return !!label && label.scrollWidth > label.clientWidth;
}

function NavTab({
  item,
  selected,
  tabRef,
  onSelect,
}: {
  item: NavItem;
  selected: boolean;
  tabRef: (el: HTMLAnchorElement | null) => void;
  onSelect: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const tip = useTooltip(item.name, { when: navTipWhen, placement: 'right' });
  return (
    <Link
      ref={tabRef}
      href={item.href}
      onClick={onSelect}
      className="nav-rail__tab"
      data-selected={selected || undefined}
      aria-current={selected ? 'page' : undefined}
      aria-label={item.name}
      {...tip}
    >
      <span className="nav-rail__icon">{item.icon}</span>
      <span className="nav-rail__label">{item.name}</span>
    </Link>
  );
}

export default function NavRail({ onScanArrival }: { onScanArrival: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>());
  const prevActiveRef = useRef<string | null>(null);
  // 点击当下就切换选中（Loop 实测如此），不等路由切换完成；路由到位后以实际路径为准
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const routeHref = activeHrefOf(pathname);
  const activeHref = pendingHref ?? routeHref;

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const pillTip = useTooltip('新建', { when: navTipWhen, placement: 'right' });
  const collapseTip = useTooltip('展开导航栏', { when: navTipWhen, placement: 'right' });

  // 首屏的折叠状态由 theme-init 写在 <html data-nav>；没有手动记录时随窗口宽度自动折叠
  useEffect(() => {
    const media = window.matchMedia(NAV_AUTO_COLLAPSE_QUERY);
    // 首屏之后窗口宽度可能已变（如从登录页进来时），没有手动记录就按当前宽度重新判断
    if (!hasStoredNavMode()) applyNavCollapsed(media.matches);
    setCollapsed(isNavCollapsed());
    const handleChange = () => {
      if (hasStoredNavMode()) return;
      applyNavCollapsed(media.matches);
      setCollapsed(media.matches);
      hideTooltipNow();
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  // 选中条从上一个 Tab 滑到新 Tab：先无过渡放到起点，回流后撤掉偏移，触发 0.3s 过渡（Loop 02-nav.js selectTab）
  useLayoutEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = activeHref;
    if (!prev || !activeHref || prev === activeHref) return;
    const from = tabRefs.current.get(prev);
    const to = tabRefs.current.get(activeHref);
    if (!from || !to) return;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    to.classList.add('no-anim');
    to.style.setProperty('--ind', `translateY(${a.top - b.top}px) scaleY(${a.height / b.height})`);
    void to.offsetWidth;
    to.classList.remove('no-anim');
    to.style.setProperty('--ind', 'translateY(0px) scaleY(1)');
  }, [activeHref]);

  const toggleCollapsed = () => {
    const next = !isNavCollapsed();
    setNavCollapsed(next);
    setCollapsed(next);
    hideTooltipNow();
  };

  const goTo = (href: string) => {
    setNewMenuOpen(false);
    router.push(href);
  };

  return (
    <nav className="nav-rail" aria-label="主导航">
      <button
        ref={newButtonRef}
        type="button"
        className="new-pill"
        aria-label="新建"
        aria-haspopup="menu"
        aria-expanded={newMenuOpen}
        onClick={() => setNewMenuOpen(v => !v)}
        {...pillTip}
      >
        {/* 边缘高光：按 Loop 高光的原参数内联绘制（0.5px 圆角描边 + 右端白色渐变 + 0.125 模糊），不引用微软的素材文件 */}
        <svg className="new-pill__edge" width="153" height="35" viewBox="0 0 153 35" fill="none" aria-hidden="true">
          <defs>
            <filter id="new-pill-edge-blur" x="0.75" y="0.75" width="151.5" height="33.5" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="0.125" />
            </filter>
            <linearGradient id="new-pill-edge-gradient" x1="156.5" y1="11.5" x2="150.089" y2="20.3059" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="1.25" y="1.25" width="150.5" height="32.5" rx="16.25" stroke="url(#new-pill-edge-gradient)" strokeWidth="0.5" filter="url(#new-pill-edge-blur)" />
        </svg>
        <span className="new-pill__inner">
          <span className="new-pill__plus" aria-hidden="true" />
          <span className="new-pill__text">新建</span>
        </span>
      </button>
      <Menu open={newMenuOpen} onClose={() => setNewMenuOpen(false)} anchorRef={newButtonRef} placement="bottom-start" variant="glass" ariaLabel="新建">
        <MenuItem icon={<ClipboardList className="h-5 w-5" />} onSelect={() => goTo('/transactions/add')}>
          新增交易
        </MenuItem>
        <MenuItem icon={<Package className="h-5 w-5" />} onSelect={() => goTo('/supplies/add')}>
          新增耗材
        </MenuItem>
        <MenuItem
          icon={<ScanBarcode className="h-5 w-5" />}
          onSelect={() => {
            setNewMenuOpen(false);
            onScanArrival();
          }}
        >
          扫码到货
        </MenuItem>
      </Menu>

      <div className="nav-rail__col">
        <div className="nav-rail__collapse-wrap">
          <button
            type="button"
            className="shell-icon-btn nav-rail__collapse"
            aria-label={collapsed ? '展开导航栏' : '折叠导航栏'}
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
            {...collapseTip}
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="nav-rail__tablist">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="nav-rail__group" role="group" aria-label={group.caption}>
              {group.caption && (
                <>
                  <span className="nav-rail__caption">{group.caption}</span>
                  <div className="nav-rail__divider" role="separator" />
                </>
              )}
              {group.items.map(item => (
                <NavTab
                  key={item.href}
                  item={item}
                  selected={item.href === activeHref}
                  onSelect={e => {
                    // 修饰键 / 非左键点击会在新标签页打开，当前页的选中不变
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    if (item.href !== routeHref) setPendingHref(item.href);
                  }}
                  tabRef={el => {
                    if (el) tabRefs.current.set(item.href, el);
                    else tabRefs.current.delete(item.href);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
