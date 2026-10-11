// lib/supabase/client.ts
// Supabase Client Configuration

import { createBrowserClient } from '@supabase/ssr';
import { notifyMutation, tableFromRestUrl } from './mutationEvents';

// 环境变量验证
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// 离线时写操作（POST/PATCH/PUT/DELETE）立即失败并给出明确提示，而不是等浏览器的
// "Failed to fetch / Load failed"。离线模式是只读的：数据来自本机缓存，写入必须联网。
// 只拦截数据 / 存储请求；认证请求（/auth/v1/）保持原有行为，以免干扰 token 刷新的重试判断。
//
// 同时在这里统一发出「写入成功」事件：QueryInvalidationBridge 据此让相关查询缓存失效，
// 写入点不需要各自处理（见 lib/queryInvalidation.ts）。
const offlineAwareFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const isWrite = method !== 'GET' && method !== 'HEAD';

  if (isWrite && typeof navigator !== 'undefined' && navigator.onLine === false && !url.includes('/auth/v1/')) {
    throw new Error('离线中，无法修改数据，请联网后重试');
  }

  const response = await fetch(input, init);

  if (isWrite && response.ok) {
    const table = tableFromRestUrl(url);
    if (table) notifyMutation(table);
  }
  return response;
};

// 创建 Supabase 浏览器客户端实例
// 使用 @supabase/ssr 确保 cookies 正确同步
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: offlineAwareFetch },
});

// Storage bucket 名称常量
export const STORAGE_BUCKETS = {
  RECEIPTS: 'receipts',
} as const;

/**
 * 上传交易收据图片到 receipts 桶
 * 路径必须是 {user_id}/{随机名}：存储策略只许本人在自己的文件夹里上传 / 删除（与原生 App 相同，见 schema.sql 第 8 节）。
 * @returns 上传后的签名 URL（有效期1年）
 */
export async function uploadImage(
  file: File,
  bucket: string = STORAGE_BUCKETS.RECEIPTS
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('上传失败: 未登录');
  const fileExt = file.name.split('.').pop();
  const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`上传失败: ${error.message}`);
  }

  // 获取签名 URL（有效期1年 = 31536000秒）
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 31536000);

  if (signedUrlError) {
    throw new Error(`获取签名URL失败: ${signedUrlError.message}`);
  }

  return signedUrlData.signedUrl;
}
