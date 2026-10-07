// lib/supabase/mutationEvents.ts
// 数据写入事件总线：Supabase 客户端在任意「成功的写请求」之后通知这里，
// QueryInvalidationBridge 据此让依赖该表的查询缓存失效。
//
// 为什么集中在请求层而不是每个写入点手动失效：写入点分散在 25 个文件里（页面、lib/api、
// 触发器联动的表），手动补 invalidate 既容易漏，又会在以后新增写入点时再次遗漏。

type Listener = (table: string) => void;

const listeners = new Set<Listener>();

export function subscribeToMutations(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** table 为 PostgREST 的表名；RPC 调用为 `rpc/<函数名>` */
export function notifyMutation(table: string) {
  listeners.forEach(l => {
    try {
      l(table);
    } catch {
      // 监听者出错不能影响业务请求
    }
  });
}

/** 从 PostgREST 请求 URL 提取表名；非 /rest/v1/ 请求（storage、auth 等）返回 null */
export function tableFromRestUrl(url: string): string | null {
  const marker = '/rest/v1/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const rest = url.slice(i + marker.length).split('?')[0];
  if (!rest) return null;
  return rest.startsWith('rpc/') ? rest : rest.split('/')[0];
}
