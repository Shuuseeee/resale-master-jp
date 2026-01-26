// lib/supabase/client.ts
// Supabase Client Configuration

import { createBrowserClient } from '@supabase/ssr';

// 环境变量验证
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// 创建 Supabase 浏览器客户端实例
// 使用 @supabase/ssr 确保 cookies 正确同步
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * 获取当前用户ID
 * @returns 当前登录用户的 ID，如果未登录则返回 null
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Storage bucket 名称常量
export const STORAGE_BUCKETS = {
  RECEIPTS: 'receipts',
} as const;

/**
 * 上传图片到 Supabase Storage
 * @param file - 要上传的文件
 * @param bucket - 存储桶名称
 * @returns 上传后的公共 URL
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

  // 获取公共 URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return publicUrl;
}

/**
 * 删除 Storage 中的图片
 * @param url - 图片的公共 URL
 * @param bucket - 存储桶名称
 */
export async function deleteImage(
  url: string,
  bucket: string = STORAGE_BUCKETS.RECEIPTS
): Promise<void> {
  // 从 URL 中提取文件路径
  const urlParts = url.split('/');
  const filePath = urlParts[urlParts.length - 1];

  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath]);

  if (error) {
    throw new Error(`删除失败: ${error.message}`);
  }
}