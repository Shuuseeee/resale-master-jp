'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to detect media query matches
 * Prevents SSR hydration mismatch by starting with false
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Create event listener
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    mediaQuery.addEventListener('change', handler);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

/**
 * Convenience hook to detect desktop viewport (>=768px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
