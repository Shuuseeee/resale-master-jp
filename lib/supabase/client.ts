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
 * 上传图片到 Supabase Storage
 * @param file - 要上传的文件
 * @param bucket - 存储桶名称
 * @returns 上传后的签名 URL（有效期1年）
 */
export async function uploadImage(
  file: File,
  bucket: string = STORAGE_BUCKETS.RECEIPTS
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

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

/**
 * 为已存在的图片生成新的签名 URL
 * @param filePath - 文件路径或完整URL
 * @param bucket - 存储桶名称
 * @param expiresIn - 有效期（秒），默认1年
 * @returns 签名 URL
 */
export async function getSignedImageUrl(
  filePath: string,
  bucket: string = STORAGE_BUCKETS.RECEIPTS,
  expiresIn: number = 31536000
): Promise<string> {
  // 如果传入的是完整URL，提取文件路径
  let path = filePath;
  if (filePath.includes('/storage/v1/object/')) {
    const urlParts = filePath.split('/');
    path = urlParts[urlParts.length - 1].split('?')[0];
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`获取签名URL失败: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * 删除 Storage 中的图片
 * @param url - 图片的公共 URL 或签名 URL
 * @param bucket - 存储桶名称
 */
export async function deleteImage(
  url: string,
  bucket: string = STORAGE_BUCKETS.RECEIPTS
): Promise<void> {
  // 从 URL 中提取文件路径
  const urlParts = url.split('/');
  const fileName = urlParts[urlParts.length - 1].split('?')[0]; // 移除查询参数

  const { error } = await supabase.storage
    .from(bucket)
    .remove([fileName]);

  if (error) {
    throw new Error(`删除失败: ${error.message}`);
  }
}