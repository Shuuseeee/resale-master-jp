'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlatformsProvider } from '@/contexts/PlatformsContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SWUpdatePrompt } from '@/components/SWUpdatePrompt';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
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
          <PlatformsProvider>
            <BfcacheRefreshListener />
            <SWUpdatePrompt />
            {children}
          </PlatformsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
