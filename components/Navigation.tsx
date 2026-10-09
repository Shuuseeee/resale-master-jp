// components/Navigation.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Menu,
  Package,
  Plus,
  ScanBarcode,
  Settings,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ScanArrivalModal from '@/components/ScanArrivalModal';
import { triggerHaptic } from '@/lib/haptic';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import { readLastUser } from '@/lib/offline/persister';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { BrandIcon } from '@/components/BrandIcon';
import NavRail from '@/components/shell/NavRail';
import SectionDrawer from '@/components/shell/SectionDrawer';
import { Menu as FluentMenu, MenuDivider, MenuInfo, MenuItem } from '@/components/fluent/Menu';
import { useTooltip } from '@/components/fluent/Tooltip';

/** 头像首字母：没有姓名，取邮箱 @ 前的前 2 个字符 */
function initialsOf(email: string | null | undefined) {
  return email ? email.split('@')[0].slice(0, 2).toUpperCase() : '';
}

/** 顶栏账户按钮：首字母头像（Loop 实测规格），点击弹出菜单显示邮箱与退出登录 */
function AccountButton({ email, canLogout, onLogout }: { email: string; canLogout: boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tip = useTooltip('账户', { placement: 'bottom-end' });
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="shell-icon-btn"
        aria-label="账户"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        {...tip}
      >
        <span className="shell-avatar">{initialsOf(canLogout ? email : null)}</span>
      </button>
      <FluentMenu open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} placement="bottom-end" ariaLabel="账户">
        <MenuInfo icon={<User className="h-5 w-5" />}>{email}</MenuInfo>
        {canLogout && (
          <>
            <MenuDivider />
            <MenuItem
              icon={<LogOut className="h-5 w-5" />}
              onSelect={() => {
                setOpen(false);
                onLogout();
              }}
            >
              退出登录
            </MenuItem>
          </>
        )}
      </FluentMenu>
    </>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showScanArrival, setShowScanArrival] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, signOut } = useAuth();
  const online = useOnlineStatus();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 路由变化时关闭抽屉和 FAB 菜单
  useEffect(() => {
    setShowMoreSheet(false);
    setShowFabMenu(false);
  }, [pathname]);


  const isAuthPage = pathname?.startsWith('/auth');
  if (isAuthPage) return null;

  // 离线且 token 已过期时 user 为 null，但这不代表被登出：显示最近一次登录的邮箱，而不是「未登录」
  const displayEmail = mounted
    ? user?.email || (!online ? readLastUser()?.email : null) || '未登录'
    : '加载中...';

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  const handleLogout = async () => {
    if (confirm('确定要退出登录吗？')) {
      await signOut();
    }
  };

  // 移动端更多抽屉中的次要项目
  const moreItems = [
    {
      name: '设置',
      href: '/settings',
      icon: <Settings className="h-6 w-6" strokeWidth={2} />,
    },
    {
      name: '耗材管理',
      href: '/supplies',
      icon: <Package className="h-6 w-6" strokeWidth={2} />,
    },
    {
      name: '数据分析',
      href: '/analytics',
      icon: <BarChart3 className="h-6 w-6" strokeWidth={2} />,
    },
    {
      name: '税务申报',
      href: '/tax-report',
      icon: <FileText className="h-6 w-6" strokeWidth={2} />,
    },
  ];

  return (
    <>
      {/* 桌面端顶部栏：Loop 外壳顶栏（grid 第一行，60px，内部 40px 工具栏；透明，露出应用背景） */}
      <header className="app-shell__header hidden md:block h-[60px]">
        <div className="mt-[10px] grid h-10 grid-cols-2 items-center gap-x-2 pl-[3px] pr-[2px]">
          <div className="flex h-10 items-center gap-0.5">
            <Link href="/dashboard" className="shell-brand">
              <BrandIcon className="shell-brand__logo" />
              <span className="shell-brand__text">Resale Master</span>
            </Link>
          </div>
          <div className="flex h-8 items-center justify-end gap-2">
            <ThemeToggleButton />
            <AccountButton email={displayEmail} canLogout={mounted && displayEmail !== '未登录'} onLogout={handleLogout} />
          </div>
        </div>
      </header>

      {/* ── 桌面端左导航（grid 第二行第一列，padding-left 8） ── */}
      <aside className="app-shell__aside hidden md:flex">
        <NavRail onScanArrival={() => setShowScanArrival(true)} />
        {/* 分区抽屉（交易列表 / 买取价格 / 税务申报 / 耗材管理 / 设置）：≥1025 内嵌在导航右侧，768–1024 以浮层渲染到 body */}
        <SectionDrawer />
      </aside>

      {/* ── 移动端顶部栏：SNUtils compact header ── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-[9999] app-bg"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandIcon className="h-8 w-8" />
            <div className="leading-tight">
              <div className="text-sm font-bold text-[var(--color-text)]">Resale Master</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--color-primary)]">财务控制台</div>
            </div>
          </Link>
        </div>
      </div>

      {/* 移动端顶部占位 */}
      <div className="md:hidden h-[calc(56px+env(safe-area-inset-top,0px))]" />

      {/* ── 移动端底部导航栏：SNUtils touch adaptation ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[9999] border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="grid h-16 grid-cols-5 px-1">
              <Link
                href="/dashboard"
                onClick={() => triggerHaptic('light')}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] text-[11px] font-semibold transition-colors ${
              isActive('/dashboard')
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-pressed)]'
            }`}
              >
            <span className={`flex h-8 w-10 items-center justify-center rounded-[var(--radius-md)] ${isActive('/dashboard') ? 'bg-[var(--color-primary-light)]' : ''}`}>
              <Home className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <span>仪表盘</span>
              </Link>

              <Link
                href="/transactions"
                onClick={() => triggerHaptic('light')}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] text-[11px] font-semibold transition-colors ${
              isActive('/transactions')
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-pressed)]'
            }`}
              >
            <span className={`flex h-8 w-10 items-center justify-center rounded-[var(--radius-md)] ${isActive('/transactions') ? 'bg-[var(--color-primary-light)]' : ''}`}>
              <ClipboardList className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <span>交易</span>
              </Link>

          <div className="flex items-center justify-center">
                <button
                  onClick={() => { triggerHaptic('medium'); setShowFabMenu(v => !v); }}
              className={`flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border font-semibold shadow-[0_6px_14px_var(--color-primary-border)] transition-colors active:opacity-80 ${
                    showFabMenu
                  ? 'border-[var(--color-primary-bg-hover)] bg-[var(--color-primary-bg-hover)] text-white'
                  : 'border-[var(--color-primary-bg)] bg-[var(--color-primary-bg)] text-white'
                  }`}
              aria-label="新增"
                >
              <Plus className={`h-[22px] w-[22px] transition-transform duration-200 ${showFabMenu ? 'rotate-45' : ''}`} strokeWidth={2.5} />
                </button>
              </div>

              <Link
                href="/kaitorix-prices"
                onClick={() => triggerHaptic('light')}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] text-[11px] font-semibold transition-colors ${
              isActive('/kaitorix-prices')
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-pressed)]'
            }`}
              >
            <span className={`flex h-8 w-10 items-center justify-center rounded-[var(--radius-md)] ${isActive('/kaitorix-prices') ? 'bg-[var(--color-primary-light)]' : ''}`}>
              <ScanBarcode className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <span>买取价</span>
              </Link>

              <button
                onClick={() => { triggerHaptic('light'); setShowMoreSheet(true); }}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] text-[11px] font-semibold transition-colors ${
              showMoreSheet
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-pressed)]'
            }`}
            aria-label="更多"
              >
            <span className={`flex h-8 w-10 items-center justify-center rounded-[var(--radius-md)] ${showMoreSheet ? 'bg-[var(--color-primary-light)]' : ''}`}>
              <Menu className="h-5 w-5" strokeWidth={2} />
            </span>
            <span>更多</span>
              </button>
            </div>
      </div>

      {/* ── FAB 弹出菜单卡片 ── */}
      {showFabMenu && (
        <div
          className="md:hidden fixed inset-0 z-[10000] flex items-end justify-center"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
          onClick={() => setShowFabMenu(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative mb-3 w-56 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            {[
              {
                href: '/transactions/add',
                label: '新增交易',
                iconBg: 'bg-[var(--color-primary-light)]',
                iconColor: 'text-[var(--color-primary)]',
                icon: <ClipboardList className="h-4 w-4" strokeWidth={2} />,
              },
              {
                href: '/supplies/add',
                label: '新增耗材',
                iconBg: 'bg-[var(--color-info-subtle)]',
                iconColor: 'text-[var(--color-info)]',
                icon: <Package className="h-4 w-4" strokeWidth={2} />,
              },
            ].map((item, i, arr) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => triggerHaptic('light')}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-[var(--color-bg-pressed)] ${
                  i < arr.length - 1 ? 'border-b border-[var(--color-border)]' : ''
                }`}
              >
                <div className={`w-8 h-8 ${item.iconBg} ${item.iconColor} rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0`}>
                  {item.icon}
                </div>
                <span className="text-sm font-semibold text-[var(--color-text)]">{item.label}</span>
              </Link>
            ))}
            <button
              onClick={() => { triggerHaptic('light'); setShowFabMenu(false); setShowScanArrival(true); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-[var(--color-bg-pressed)] border-t border-[var(--color-border)]"
            >
              <div className="w-8 h-8 bg-[var(--color-warning-subtle)] text-[var(--color-warning)] rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0">
                <ScanBarcode className="h-4 w-4" strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-[var(--color-text)]">扫码到货</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 更多上滑抽屉 ── */}
      {showMoreSheet && (
        <div className="md:hidden fixed inset-0 z-[10001]" onClick={() => setShowMoreSheet(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute left-3 right-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-lg)] flex flex-col"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
              maxHeight: '68vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[var(--color-text)]">更多功能</div>
                <div className="text-xs text-[var(--color-text-muted)]">账户、报表与系统工具</div>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreSheet(false)}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] active:bg-[var(--color-bg-pressed)]"
                aria-label="关闭"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            {/* 图标网格 — 可滚动 */}
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-4 gap-2 px-4 py-4">
                {moreItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => triggerHaptic('light')}
                      className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-[var(--radius-md)] transition-colors ${
                        active
                          ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                          : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-pressed)]'
                      }`}
                    >
                      {item.icon}
                      <span className="text-[11px] font-semibold text-center leading-tight">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* 用户信息栏 */}
            <div className="flex-shrink-0 mx-4 border-t border-[var(--color-border)]" />
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 bg-[var(--color-primary-light)] rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[var(--color-text-muted)]">当前用户</div>
                  <div className="text-sm text-[var(--color-text)] font-semibold truncate">
                    {displayEmail}
                  </div>
                </div>
              </div>
              {mounted && (
                <button
                  onClick={handleLogout}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-[var(--radius-md)] transition-colors"
                >
                  <LogOut className="h-4 w-4" strokeWidth={2} />
                  退出登录
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showScanArrival && (
        <ScanArrivalModal onClose={() => setShowScanArrival(false)} />
      )}
    </>
  );
}
