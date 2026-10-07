'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlatformsProvider } from '@/contexts/PlatformsContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SWUpdatePrompt } from '@/components/SWUpdatePrompt';
import { ThemePaletteSync } from '@/components/ThemePaletteSync';
import OfflineCacheProvider from '@/components/OfflineCacheProvider';
import OfflineBanner from '@/components/OfflineBanner';
import { OFFLINE_CACHE_MAX_AGE } from '@/lib/offline/persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 必须 ≥ 离线缓存的最长保留时间：恢复出来的查询没有观察者，gcTime 太短会在恢复后立刻被回收
      gcTime: OFFLINE_CACHE_MAX_AGE,
      refetchOnWindowFocus: true,
    },
  },
});

// Detect bfcache restore (iOS Safari swipe back/forward) and force a data refresh
// by dispatching a custom event that pages can listen to.
function BfcacheRefreshListener() {
  useEffect(() => {
    const handler = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Page was restored from bfcache — notify all listeners to re-fetch
        window.dispatchEvent(new CustomEvent('bfcache-restore'));
      }
    };
    window.addEventListener('pageshow', handler);
    return () => window.removeEventListener('pageshow', handler);
  }, []);
  return null;
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>
          <OfflineCacheProvider>
            <PlatformsProvider>
              <BfcacheRefreshListener />
              <ThemePaletteSync />
              <SWUpdatePrompt />
              <OfflineBanner />
              {children}
            </PlatformsProvider>
          </OfflineCacheProvider>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
