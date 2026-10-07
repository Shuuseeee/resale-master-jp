'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToMutations } from '@/lib/supabase/mutationEvents';
import { queryKeysForTable } from '@/lib/queryInvalidation';

/**
 * 任意成功的数据写入之后，把依赖该表的查询标记为过期。
 *
 * 用 refetchType: 'none'（只标记、不立即重新请求）：
 *  - 交易页的快速编辑等操作会自己 setQueryData 精准打补丁，立即全量重拉 565 行会浪费，
 *    且 setQueryData 会清除过期标记；
 *  - 其它页面（仪表盘、分析…）下次挂载时发现已过期，会先显示缓存再后台刷新，不会看到过期数据停留 30 秒。
 * 需要「写完立刻刷新当前页」的页面，在自己的写入逻辑后显式 invalidateQueries 即可。
 */
export default function QueryInvalidationBridge() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeToMutations(table => {
        for (const key of queryKeysForTable(table)) {
          void queryClient.invalidateQueries({ queryKey: [key], refetchType: 'none' });
        }
      }),
    [queryClient],
  );

  return null;
}
