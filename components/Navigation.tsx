// components/Navigation.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ScanArrivalModal from '@/components/ScanArrivalModal';
import { triggerHaptic } from '@/lib/haptic';

export default function Navigation() {
  const pathname = usePathname();
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showScanArrival, setShowScanArrival] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const { user, signOut } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
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
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: '交易列表',
      href: '/transactions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      name: '记录交易',
      href: '/transactions/add',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      highlight: true,
    },
    {
      name: '优惠券',
      href: '/coupons',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
    },
    {
      name: '设置',
      href: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      name: '耗材管理',
      href: '/supplies',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      name: '数据分析',
      href: '/analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: '通知',
      href: '/notifications',
      icon: (
        <div className="relative">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      ),
    },
    {
      name: '税务申报',
      href: '/tax-report',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  // 移动端"もっと"抽屉中的次要项目
  const moreItems = [
    {
      name: '設定',
      href: '/settings',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      name: '耗材管理',
      href: '/supplies',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      name: '数据分析',
      href: '/analytics',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: '税务申报',
      href: '/tax-report',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* ── 桌面端侧边栏 ── */}
      <aside className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:bg-white dark:lg:bg-gray-800 lg:border-r lg:border-gray-200 dark:lg:border-gray-700 transition-all duration-300 ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center border-b border-gray-200 dark:border-gray-700 px-3 gap-2">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-gray-900 dark:text-white font-bold text-base truncate">管理系统</div>
                <div className="text-gray-500 dark:text-gray-400 text-xs truncate">仅供内部使用</div>
              </div>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="flex-1 flex justify-center">
              <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </Link>
          )}
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {desktopNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                  ${collapsed ? 'justify-center' : ''}
                  ${active
                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-medium'
                    : item.highlight
                      ? 'text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors justify-center"
            title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            <svg className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          {!collapsed && (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400">当前用户</div>
              <div className="text-sm text-gray-900 dark:text-white font-medium truncate">
                {mounted ? (user?.email || '未登录') : '加载中...'}
              </div>
            </div>
          )}
          {mounted && (
            <button
              onClick={handleLogout}
              title={collapsed ? '退出登录' : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20 rounded-lg transition-colors ${collapsed ? 'justify-center' : ''}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!collapsed && <span className="text-sm font-medium">退出登录</span>}
            </button>
          )}
        </div>
      </aside>

      {/* 桌面端侧边栏占位 */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${collapsed ? 'lg:w-16' : 'lg:w-64'}`} aria-hidden="true" />

      {/* ── 移动端顶部栏（精简版） ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[9999] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between h-12 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-teal-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-gray-900 dark:text-white font-bold text-sm">管理系统</span>
          </Link>

          {/* 通知铃铛 */}
          <Link href="/notifications" className="relative p-2 -mr-2 text-gray-600 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* 移动端顶部占位 */}
      <div className="lg:hidden h-12" />

      {/* ── 移动端底部导航栏 (iOS 26 Floating Glass Style) ── */}
      <div
        className="lg:hidden fixed bottom-5 left-4 right-4 z-[9999] rounded-[32px] overflow-hidden"
        style={{
          marginBottom: 'env(safe-area-inset-bottom)',
          background: isDark
            ? 'rgba(20, 20, 30, 0.45)'
            : 'rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(48px) saturate(220%) brightness(108%) contrast(108%)',
          WebkitBackdropFilter: 'blur(48px) saturate(220%) brightness(108%) contrast(108%)',
          border: isDark
            ? '1px solid rgba(255,255,255,0.12)'
            : '1px solid rgba(255,255,255,0.55)',
          boxShadow: isDark
            ? '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 8px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.75), inset 0 -1px 0 rgba(0,0,0,0.04)',
        }}
      >
        {/* 5列布局：各列中心点在 10% 30% 50% 70% 90%，pill left = center% - 22px */}
        {(() => {
          const pillPos = isActive('/dashboard') ? 10
            : isActive('/transactions') ? 30
            : isActive('/coupons') ? 70
            : showMoreSheet ? 90
            : -1;
          const pillVisible = pillPos >= 0;
          return (
            <div className="relative flex items-center h-16">
              {/* 滑动玻璃 pill — 绝对定位，在图标层之下 */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  width: 44,
                  height: 44,
                  top: '50%',
                  left: `calc(${pillVisible ? pillPos : 50}% - 22px)`,
                  transform: 'translateY(-50%)',
                  transition: 'left 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease',
                  opacity: pillVisible ? 1 : 0,
                  pointerEvents: 'none',
                  borderRadius: 14,
                  zIndex: 0,
                  background: isDark
                    ? 'rgba(255,255,255,0.18)'
                    : 'rgba(255,255,255,0.72)',
                  border: isDark
                    ? '1px solid rgba(255,255,255,0.28)'
                    : '1px solid rgba(255,255,255,0.95)',
                  boxShadow: isDark
                    ? '0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.15)'
                    : '0 2px 10px rgba(0,0,0,0.1), inset 0 1.5px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,0.06)',
                }}
              />

              {/* 图标层 */}
              <Link
                href="/dashboard"
                onClick={() => triggerHaptic('light')}
                className="flex-1 flex items-center justify-center relative z-10 transition-transform active:scale-90"
                style={{ height: 44 }}
              >
                <svg className={`w-6 h-6 transition-colors duration-200 ${isActive('/dashboard') ? 'text-teal-600 dark:text-teal-300' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>

              <Link
                href="/transactions"
                onClick={() => triggerHaptic('light')}
                className="flex-1 flex items-center justify-center relative z-10 transition-transform active:scale-90"
                style={{ height: 44 }}
              >
                <svg className={`w-6 h-6 transition-colors duration-200 ${isActive('/transactions') ? 'text-teal-600 dark:text-teal-300' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </Link>

              <div className="flex-1 flex items-center justify-center relative z-10">
                <button
                  onClick={() => { triggerHaptic('medium'); setShowFabMenu(v => !v); }}
                  className={`rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                    showFabMenu
                      ? 'bg-gray-800 dark:bg-white text-white dark:text-gray-900 scale-90'
                      : 'bg-teal-500 text-white shadow-teal-500/30'
                  }`}
                  style={{ width: 48, height: 48 }}
                >
                  <svg className={`w-6 h-6 transition-transform duration-300 ${showFabMenu ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <Link
                href="/coupons"
                onClick={() => triggerHaptic('light')}
                className="flex-1 flex items-center justify-center relative z-10 transition-transform active:scale-90"
                style={{ height: 44 }}
              >
                <svg className={`w-6 h-6 transition-colors duration-200 ${isActive('/coupons') ? 'text-teal-600 dark:text-teal-300' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </Link>

              <button
                onClick={() => { triggerHaptic('light'); setShowMoreSheet(true); }}
                className="flex-1 flex items-center justify-center relative z-10 transition-transform active:scale-90"
                style={{ height: 44 }}
              >
                <svg className={`w-6 h-6 transition-colors duration-200 ${showMoreSheet ? 'text-teal-600 dark:text-teal-300' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          );
        })()}
      </div>

      {/* ── FAB 弹出菜单卡片 ── */}
      {showFabMenu && (
        <div
          className="lg:hidden fixed inset-0 z-[10000] flex items-end justify-center"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
          onClick={() => setShowFabMenu(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative mb-4 w-52 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: isDark ? 'rgba(20,20,30,0.55)' : 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(48px) saturate(200%) brightness(108%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(108%)',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.6)',
              boxShadow: isDark
                ? '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)'
                : '0 12px 40px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              {
                href: '/transactions/add',
                label: '新增交易',
                iconBg: 'bg-teal-100 dark:bg-teal-900/40',
                iconColor: 'text-teal-600 dark:text-teal-400',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                ),
              },
              {
                href: '/coupons/add',
                label: '新增优惠券',
                iconBg: 'bg-amber-100 dark:bg-amber-900/40',
                iconColor: 'text-amber-600 dark:text-amber-400',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                ),
              },
              {
                href: '/supplies/add',
                label: '新增耗材',
                iconBg: 'bg-purple-100 dark:bg-purple-900/40',
                iconColor: 'text-purple-600 dark:text-purple-400',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                ),
              },
            ].map((item, i, arr) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => triggerHaptic('light')}
                className={`flex items-center gap-3 px-4 py-3.5 active:bg-white/40 dark:active:bg-white/10 transition-colors ${
                  i < arr.length - 1 ? 'border-b border-gray-100/50 dark:border-gray-700/60' : ''
                }`}
              >
                <div className={`w-8 h-8 ${item.iconBg} ${item.iconColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  {item.icon}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
              </Link>
            ))}
            <button
              onClick={() => { triggerHaptic('light'); setShowFabMenu(false); setShowScanArrival(true); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/40 dark:active:bg-white/10 transition-colors border-t border-gray-100/50 dark:border-gray-700/60"
            >
              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">扫码到货</span>
            </button>
          </div>
        </div>
      )}

      {/* ── もっと 上滑抽屉 ── */}
      {showMoreSheet && (
        <div className="lg:hidden fixed inset-0 z-[10001]" onClick={() => setShowMoreSheet(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
          {/* 悬浮在导航栏上方，与导航栏同款间距和圆角 */}
          <div
            className="absolute left-4 right-4 rounded-[32px] overflow-hidden flex flex-col"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 96px)',
              maxHeight: '60vh',
              background: isDark ? 'rgba(20,20,30,0.65)' : 'rgba(255,255,255,0.28)',
              backdropFilter: 'blur(48px) saturate(200%) brightness(108%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(108%)',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.65)',
              boxShadow: isDark
                ? '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)'
                : '0 8px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.85)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 图标网格 — 可滚动 */}
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-4 gap-1 px-4 pt-4 pb-3">
                {moreItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => triggerHaptic('light')}
                      className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl transition-colors ${
                        active
                          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/5 active:bg-gray-100'
                      }`}
                    >
                      {item.icon}
                      <span className="text-[11px] font-medium text-center leading-tight">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* 用户信息栏 */}
            <div className="flex-shrink-0 mx-4 border-t border-gray-200/50 dark:border-gray-700/60" />
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 bg-teal-100 dark:bg-teal-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400">ログイン中</div>
                  <div className="text-sm text-gray-900 dark:text-white font-medium truncate">
                    {mounted ? (user?.email || '未登录') : '加载中...'}
                  </div>
                </div>
              </div>
              {mounted && (
                <button
                  onClick={handleLogout}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  ログアウト
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
