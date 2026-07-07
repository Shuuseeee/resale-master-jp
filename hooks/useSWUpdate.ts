'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook that detects when a new Service Worker version is available and
 * provides a way to trigger the update.
 *
 * Two detection paths:
 *   1. `updatefound` on initial registration — fires when a new SW
 *      finishes installing while a previous SW is still controlling the page.
 *   2. `message` event from the active SW — fires after skipWaiting +
 *      clientsClaim when the new SW takes over.
 */
export function useSWUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    // Path 1: listen for the custom event dispatched by the registration script
    const onUpdateAvailable = () => setHasUpdate(true)
    window.addEventListener('sw-update-available', onUpdateAvailable)

    // Path 2: listen for postMessage from the SW after it activates
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setHasUpdate(true)
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)

    // Also check if there's already a waiting SW on initial load
    navigator.serviceWorker?.getRegistration().then((reg) => {
      if (reg?.waiting) {
        setHasUpdate(true)
      }
    })

    return () => {
      window.removeEventListener('sw-update-available', onUpdateAvailable)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [])

  /** Tell the waiting SW to activate immediately, then reload the page. */
  const updateSW = useCallback(() => {
    navigator.serviceWorker?.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      // Reload after a short delay so the new SW has time to activate and
      // claim clients. Without this, the reload may still pick up the old SW.
      setTimeout(() => {
        window.location.reload()
      }, 300)
    })
  }, [])

  return { hasUpdate, updateSW } as const
}
