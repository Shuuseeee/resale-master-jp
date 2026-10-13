'use client'

import { useState } from 'react'
import { useSWUpdate } from '@/hooks/useSWUpdate'
import MessageBar from '@/components/fluent/MessageBar'

/**
 * 有新版本 Service Worker 时的提示条（信息样式 +「刷新」+ 关闭）。放在外壳的提示条栈里，与离线提示同一处
 * （Loop 的提示条都在文档头下方、没有动画；之前是从底部滑入的浮层）。关闭只是这次不再提示。
 */
export function SWUpdatePrompt() {
  const { hasUpdate, updateSW } = useSWUpdate()
  const [dismissed, setDismissed] = useState(false)
  if (!hasUpdate || dismissed) return null

  return (
    <MessageBar
      intent="info"
      role="alert"
      title="有新版本可用。"
      actions={
        <button type="button" onClick={updateSW} className="fluent-link">
          刷新
        </button>
      }
      onDismiss={() => setDismissed(true)}
    >
      刷新后生效
    </MessageBar>
  )
}
