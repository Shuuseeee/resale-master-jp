// lib/api/expense-attachments.ts — 经费凭证附件（收据照片 / PDF）
// 文件放私有桶 expense-receipts，路径 {user_id}/{expense_id}/{随机名}（存储策略按第一层 = auth.uid() 校验），
// 元数据存 expense_attachments；查看用 10 分钟的签名地址。图片上传前压缩成 JPEG（长边 2000，收据小字还看得清）。
import { supabase } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/api/fetchAll';
import type { ExpenseAttachment } from '@/types/database.types';

export const EXPENSE_RECEIPTS_BUCKET = 'expense-receipts';
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = 'image/*,.heic,.heif,application/pdf';
const SIGNED_URL_TTL = 600;

export const isPdf = (file: { type?: string; mime_type?: string; name?: string; file_name?: string }) =>
  (file.type ?? file.mime_type) === 'application/pdf' || /\.pdf$/i.test(file.name ?? file.file_name ?? '');

/** 每笔经费的附件数。库未升级（表不存在）或失败时返回空表，列表照常显示 */
export async function getAttachmentCounts(): Promise<Record<string, number>> {
  try {
    const rows = await fetchAllRows<Pick<ExpenseAttachment, 'id' | 'expense_id'>>((from, to, opts) =>
      supabase.from('expense_attachments').select('id, expense_id', opts).order('id').range(from, to),
    );
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.expense_id] = (counts[r.expense_id] ?? 0) + 1;
    return counts;
  } catch (err) {
    console.warn('读取经费附件数失败:', err);
    return {};
  }
}

export async function listAttachments(expenseId: string): Promise<ExpenseAttachment[]> {
  const { data, error } = await supabase
    .from('expense_attachments')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at')
    .order('id');
  if (error) throw error;
  return data ?? [];
}

/** 校验并预处理：图片压缩成 JPEG，PDF 原样；不支持的类型 / 超过 10MB 抛错 */
async function prepare(file: File): Promise<File> {
  if (isPdf(file)) {
    if (file.size > ATTACHMENT_MAX_BYTES) throw new Error(`「${file.name}」超过 10MB`);
    return new File([file], file.name, { type: 'application/pdf' });
  }
  const { isValidImageFile, processImageForUpload } = await import('@/lib/image-utils');
  if (!isValidImageFile(file)) throw new Error(`「${file.name}」不是图片或 PDF`);
  const out = await processImageForUpload(file, 2000, 2000, 0.85);
  if (out.size > ATTACHMENT_MAX_BYTES) throw new Error(`「${file.name}」压缩后仍超过 10MB`);
  return out;
}

export async function uploadAttachment(expenseId: string, file: File): Promise<ExpenseAttachment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const prepared = await prepare(file);
  const ext = isPdf(prepared) ? 'pdf' : 'jpg';
  const path = `${user.id}/${expenseId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(EXPENSE_RECEIPTS_BUCKET)
    .upload(path, prepared, { contentType: prepared.type, upsert: false });
  if (upErr) throw new Error(`上传失败：${upErr.message}`);

  const { data, error } = await supabase
    .from('expense_attachments')
    .insert({ expense_id: expenseId, path, file_name: file.name, mime_type: prepared.type, size: prepared.size })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(EXPENSE_RECEIPTS_BUCKET).remove([path]);
    throw error;
  }
  return data;
}

export async function deleteAttachment(att: Pick<ExpenseAttachment, 'id' | 'path'>): Promise<void> {
  const { error } = await supabase.storage.from(EXPENSE_RECEIPTS_BUCKET).remove([att.path]);
  if (error) throw new Error(`删除文件失败：${error.message}`);
  const { error: rowErr } = await supabase.from('expense_attachments').delete().eq('id', att.id);
  if (rowErr) throw rowErr;
}

/** 删除经费前调用：先删存储里的文件（附件行会随经费级联删除）。库未升级时没有附件，直接跳过 */
export async function removeExpenseFiles(expenseId: string): Promise<void> {
  const { data, error } = await supabase.from('expense_attachments').select('path').eq('expense_id', expenseId);
  if (error || !data?.length) return;
  const { error: rmErr } = await supabase.storage.from(EXPENSE_RECEIPTS_BUCKET).remove(data.map(r => r.path));
  if (rmErr) throw new Error(`删除凭证文件失败：${rmErr.message}`);
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(EXPENSE_RECEIPTS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  return map;
}
