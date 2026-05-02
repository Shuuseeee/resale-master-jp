// components/Navigation.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Menu,
  Package,
  Plus,
  ScanBarcode,
  Settings,
  Ticket,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ScanArrivalModal from '@/components/ScanArrivalModal';
import { triggerHaptic } from '@/lib/haptic';
import ThemeToggleButton from '@/components/ThemeToggleButton';

export default function Navigation() {
  const pathname = usePathname();
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showScanArrival, setShowScanArrival] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const { user, signOut } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    import('@/lib/supabase/client').then(({ supabase }) => {
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('read', false)
        .then(({ count }) => setUnreadCount(count ?? 0));
    });
  }, [user, pathname]);

  // Realtime: keep unread badge in sync without needing page navigation
  useEffect(() => {
    if (!user) return;
    let cleanup: (() => void) | null = null;
    import('@/lib/supabase/client').then(({ supabase }) => {
      const refresh = () =>
        supabase.from('notifications').select('id', { count: 'exact', head: true })
          .eq('read', false)
          .then(({ count }) => setUnreadCount(count ?? 0));

      const channel = supabase
        .channel('nav-notifications-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, refresh)
        .subscribe();

      cleanup = () => { supabase.removeChannel(channel); };
    });
    return () => { cleanup?.(); };
  }, [user]);

  // 路由变化时关闭抽屉和 FAB 菜单
  useEffect(() => {
    setShowMoreSheet(false);
    setShowFabMenu(false);
  }, [pathname]);


  const isAuthPage = pathname?.startsWith('/auth');
  if (isAuthPage) return null;

  const isActive = (href: string) => {
    if (href === '/transactions' && pathname?.startsWith('/transactions/')) {
      return pathname === '/transactions';
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const handleLogout = async () => {
    if (confirm('确定要退出登录吗？')) {
      await signOut();
    }
  };

  // 桌面端完整导航项
  const desktopNavItems = [
    {
      name: '仪表盘',
      href: '/dashboard',
      icon: <Home className="h-5 w-5" strokeWidth={2} />,
    },
    {
      name: '交易列表',
      href: '/transactions',
      icon: <ClipboardList className="h-5 w-5" strokeWidth={2} />,
    },
    {
      name: '记录交易',
      href: '/transactions/add',
      icon: <Plus className="h-5 w-5" strokeWidth={2} />,
      highlight: true,
    },
    {
      name: '优惠券',
      href: '/coupons',
      icon: <Ticket className="h-5 w-5" strokeWidth={2} />,
    },
    {
      name: '设置',
      href: '/settings',
      icon: <Settings className="h-5 w-5" strokeWidth={2} />,
    },
    {
      name: '耗材管理',
      href: '/supplies',
      icon: <Package className="h-5 w-5" strokeWidth={2} />,
    },
    {
      name: '数据分析',
      href: '/analytics',
      icon: <BarChart3 className="h-5 w-5" strokeWidth={2} />,
    },
    {
      name: '通知',
      href: '/notifications',
      icon: (
        <div className="relative">
          <Bell className="h-5 w-5" strokeWidth={2} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-danger)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      ),
    },
    {
      name: '税务申报',
      href: '/tax-report',
      icon: <FileText className="h-5 w-5" strokeWidth={2} />,
    },
  ];

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
      {/* 桌面端顶部栏 — SNUtils manage shell */}
      <header className="hidden lg:flex fixed top-0 left-0 right-0 z-[9000] h-[60px] bg-[#1B1B26] shadow-[var(--shadow-md)] items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <div className="text-white text-base font-bold tracking-[-0.3px]">Resale Master</div>
            <div className="text-[var(--color-primary)] text-xs font-medium uppercase tracking-[0.5px]">财务控制台</div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-white/15 bg-white/10 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            title="通知"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 bg-[var(--color-danger)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <ThemeToggleButton />

          <div className="hidden xl:flex items-center h-9 overflow-hidden rounded-[var(--radius-md)] border border-white/15 bg-white/10 text-white/70">
            <div className="flex h-full items-center gap-2 px-3 transition-colors hover:bg-white/10">
              <User className="h-4 w-4 flex-shrink-0 opacity-70" strokeWidth={2} />
              <span className="max-w-[240px] truncate text-[13px] font-medium">
                {mounted ? (user?.email || '未登录') : '加载中...'}
              </span>
            </div>
            {mounted && (
              <button
                onClick={handleLogout}
                title="退出登录"
                className="flex h-full w-9 flex-shrink-0 items-center justify-center border-l border-white/10 text-white/70 transition-colors hover:bg-[rgba(239,68,68,0.2)] hover:text-[#fca5a5]"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="hidden lg:block fixed top-[60px] left-0 right-0 h-[3px] z-[9001] bg-gradient-to-r from-[var(--color-primary)] to-[#34d399]" />

      {/* ── 桌面端侧边栏 ── */}
      <aside className={`hidden lg:flex lg:flex-col lg:fixed lg:top-[63px] lg:bottom-0 lg:left-0 lg:bg-[var(--color-bg-elevated)] lg:border-r lg:border-[var(--color-border)] transition-all duration-300 ${collapsed ? 'lg:w-[72px]' : 'lg:w-[250px]'}`}>
        {/* Logo */}
        <div className="h-14 flex items-center border-b border-[var(--color-border)] px-3 gap-2">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 bg-[var(--color-primary-light)] rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="text-[var(--color-text)] font-semibold text-sm truncate">管理系统</div>
                <div className="text-[var(--color-text-muted)] text-[11px] truncate">内部财务控制台</div>
              </div>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="flex-1 flex justify-center">
              <div className="w-10 h-10 bg-[var(--color-primary-light)] rounded-[var(--radius-lg)] flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={2} />
              </div>
            </Link>
          )}
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {desktopNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-all text-sm
                  ${collapsed ? 'justify-center h-12 w-12 mx-auto' : ''}
                  ${active
                    ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-semibold'
                    : item.highlight
                      ? 'text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]'
                  }
                `}
              >
                {item.icon}
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* 用户信息和退出 */}
        <div className="p-2 border-t border-[var(--color-border)] space-y-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)] transition-colors justify-center"
            title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            <ChevronLeft className={`h-5 w-5 flex-shrink-0 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>
          {!collapsed && (
            <div className="px-3 py-2 bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)]">
              <div className="text-xs text-[var(--color-text-muted)]">当前用户</div>
              <div className="text-sm text-[var(--color-text)] font-medium truncate">
                {mounted ? (user?.email || '未登录') : '加载中...'}
              </div>
            </div>
          )}
          {mounted && (
            <button
              onClick={handleLogout}
              title={collapsed ? '退出登录' : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.1)] rounded-[var(--radius-md)] transition-colors ${collapsed ? 'justify-center' : ''}`}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
              {!collapsed && <span className="text-sm font-medium">退出登录</span>}
            </button>
          )}
        </div>
      </aside>

      {/* 桌面端侧边栏占位 */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${collapsed ? 'lg:w-[72px]' : 'lg:w-[250px]'}`} aria-hidden="true" />

      {/* ── 移动端顶部栏：SNUtils compact header ── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-[9999] bg-[var(--color-header)] shadow-[var(--shadow-md)]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[var(--radius-md)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/15 flex items-center justify-center">
              <TrendingUp className="h-[18px] w-[18px] text-[var(--color-primary)]" strokeWidth={2} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-white">Resale Master</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--color-primary)]">财务控制台</div>
            </div>
          </Link>

          {/* 通知铃铛 */}
          <Link
            href="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-white/15 bg-white/10 text-white/70 active:bg-white/15"
            onClick={() => triggerHaptic('light')}
            aria-label="通知"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[var(--color-danger)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-[var(--color-primary)] to-[#34d399]" />
      </div>

      {/* 移动端顶部占位 */}
      <div className="lg:hidden h-[calc(59px+env(safe-area-inset-top,0px))]" />

      {/* ── 移动端底部导航栏：SNUtils touch adaptation ── */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[0_-10px_24px_rgba(15,23,42,0.08)]"
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
                : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)]'
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
                : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)]'
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
              className={`flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border font-semibold shadow-[0_6px_14px_rgba(16,185,129,0.28)] transition-colors active:opacity-80 ${
                    showFabMenu
                  ? 'border-[var(--color-primary-hover)] bg-[var(--color-primary-hover)] text-white'
                  : 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  }`}
              aria-label="新增"
                >
              <Plus className={`h-[22px] w-[22px] transition-transform duration-200 ${showFabMenu ? 'rotate-45' : ''}`} strokeWidth={2.5} />
                </button>
              </div>

              <Link
                href="/coupons"
                onClick={() => triggerHaptic('light')}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] text-[11px] font-semibold transition-colors ${
              isActive('/coupons')
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)]'
            }`}
              >
            <span className={`flex h-8 w-10 items-center justify-center rounded-[var(--radius-md)] ${isActive('/coupons') ? 'bg-[var(--color-primary-light)]' : ''}`}>
              <Ticket className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <span>优惠券</span>
              </Link>

              <button
                onClick={() => { triggerHaptic('light'); setShowMoreSheet(true); }}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] text-[11px] font-semibold transition-colors ${
              showMoreSheet
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)]'
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
          className="lg:hidden fixed inset-0 z-[10000] flex items-end justify-center"
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
                href: '/coupons/add',
                label: '新增优惠券',
                iconBg: 'bg-[rgba(245,158,11,0.12)]',
                iconColor: 'text-[var(--color-warning)]',
                icon: <Ticket className="h-4 w-4" strokeWidth={2} />,
              },
              {
                href: '/supplies/add',
                label: '新增耗材',
                iconBg: 'bg-[rgba(59,130,246,0.12)]',
                iconColor: 'text-[var(--color-info)]',
                icon: <Package className="h-4 w-4" strokeWidth={2} />,
              },
            ].map((item, i, arr) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => triggerHaptic('light')}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-[var(--color-bg-subtle)] ${
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
              className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-[var(--color-bg-subtle)] border-t border-[var(--color-border)]"
            >
              <div className="w-8 h-8 bg-[rgba(245,158,11,0.12)] text-[var(--color-warning)] rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0">
                <ScanBarcode className="h-4 w-4" strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-[var(--color-text)]">扫码到货</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 更多上滑抽屉 ── */}
      {showMoreSheet && (
        <div className="lg:hidden fixed inset-0 z-[10001]" onClick={() => setShowMoreSheet(false)}>
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
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)]"
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
                          : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)]'
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
                    {mounted ? (user?.email || '未登录') : '加载中...'}
                  </div>
                </div>
              </div>
              {mounted && (
                <button
                  onClick={handleLogout}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.1)] rounded-[var(--radius-md)] transition-colors"
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
