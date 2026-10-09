'use client';

import { useQueryClient } from '@tanstack/react-query';
import { WifiOff20Regular } from '@fluentui/react-icons/headless/svg/wifi-off';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import MessageBar from '@/components/fluent/MessageBar';

// 离线提示条（Fluent MessageBar 警示）：固定在顶栏下方、不占文档流、不拦截点击。
// 「更新于」取交易列表缓存的最后一次成功拉取时间（离线时看到的就是这份数据）。
export default function OfflineBanner() {
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  if (online) return null;

  const updatedAt = queryClient.getQueryState(['transactions'])?.dataUpdatedAt;
  const updatedText = updatedAt
    ? new Date(updatedAt).toLocaleString('zh-CN', {
        timeZone: 'Asia/Tokyo',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-[calc(63px+env(safe-area-inset-top,0px))] z-[8500] w-max max-w-[calc(100vw-24px)] -translate-x-1/2 md:top-[70px]">
      <MessageBar intent="warning" icon={<WifiOff20Regular />}>
        <span className="block truncate">
          离线中 · 仅可查看已缓存的数据{updatedText ? ` · 更新于 ${updatedText}` : ''}
        </span>
      </MessageBar>
    </div>
  );
}
