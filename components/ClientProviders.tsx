'use client';

import { useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlatformsProvider } from '@/contexts/PlatformsContext';
import ErrorBoundary from '@/components/ErrorBoundary';

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
    <ErrorBoundary>
      <AuthProvider>
        <PlatformsProvider>
          <BfcacheRefreshListener />
          {children}
        </PlatformsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
