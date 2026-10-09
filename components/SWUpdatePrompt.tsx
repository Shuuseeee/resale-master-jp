'use client'

import { useSWUpdate } from '@/hooks/useSWUpdate'
import MessageBar from '@/components/fluent/MessageBar'

/**
 * 有新版本 Service Worker 时，从底部滑入的提示条（Fluent MessageBar 信息样式 + 「刷新」链接按钮）。
 * 挂在 ClientProviders 里，每页都有；不依赖 Toast / Modal，提示是一次性的。
 */
export function SWUpdatePrompt() {
  const { hasUpdate, updateSW } = useSWUpdate()

  return (
    <div
      className="fixed left-1/2 z-[9999] max-w-[calc(100vw-2rem)] -translate-x-1/2 whitespace-nowrap"
      style={{ bottom: hasUpdate ? '1rem' : '-6rem', transition: 'bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      <MessageBar
        intent="info"
        role="alert"
        actions={
          <button type="button" onClick={updateSW} className="fluent-link">
            刷新
          </button>
        }
      >
        有新版本可用
      </MessageBar>
    </div>
  )
}
