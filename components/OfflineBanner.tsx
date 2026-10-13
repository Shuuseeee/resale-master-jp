'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Info20Regular } from '@fluentui/react-icons/headless/svg/info';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import MessageBar from '@/components/fluent/MessageBar';

// 离线提示条：照 Loop 的断网提示（补测-4 实例 A）——警告色、圆圈 i 图标、粗体标题 + 正文、没有关闭按钮，
// 联网后直接消失。放在外壳的提示条栈里（components/shell/AppShell.tsx：桌面在文档头下方、手机在顶栏下方）。
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
    <MessageBar intent="warning" icon={<Info20Regular />} title="离线中。">
      只能查看已缓存的数据，修改不会保存{updatedText ? `（数据更新于 ${updatedText}）` : ''}。
    </MessageBar>
  );
}
