'use client'

import { useSWUpdate } from '@/hooks/useSWUpdate'

/**
 * Inline toast that appears when a new Service Worker version is detected.
 * Rendered inside ClientProviders so it is available on every page.
 *
 * Uses a simple inline UI (not the existing Modal/Toast components) because:
 *   - No import dependency on the app's Toast component (which may not be mounted)
 *   - The prompt is ephemeral — it shows once per update cycle
 */
export function SWUpdatePrompt() {
  const { hasUpdate, updateSW } = useSWUpdate()

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: hasUpdate ? '1rem' : '-6rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        transition: 'bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'var(--color-bg-elevated)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.5rem',
        padding: '0.75rem 1.25rem',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        maxWidth: 'calc(100vw - 2rem)',
        whiteSpace: 'nowrap',
      }}
    >
      <span>有新版本可用</span>
      <button
        onClick={updateSW}
        style={{
          appearance: 'none',
          border: 'none',
          background: 'var(--color-primary)',
          color: 'var(--color-text-inverted)',
          borderRadius: '0.375rem',
          padding: '0.375rem 0.875rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        刷新
      </button>
    </div>
  )
}
