// components/expenses/ExpenseAttachments.tsx — 经费表单里的「凭证」区块（收据照片 / PDF，可多张）
// - 编辑页传 expenseId：选了文件立即上传、× 立即删除
// - 新增页传 pending / onPendingChange：先暂存在本地，经费保存后由页面逐个上传（lib/api/expense-attachments.ts）
// 缩略图与打开都用签名地址（私有桶）；图片不走 Next 图片优化（unoptimized），避免私人凭证进优化缓存。
'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Add20Regular } from '@fluentui/react-icons/headless/svg/add';
import { Dismiss16Regular } from '@fluentui/react-icons/headless/svg/dismiss';
import { DocumentPdf24Regular } from '@fluentui/react-icons/headless/svg/document-pdf';
import Spinner from '@/components/fluent/Spinner';
import MessageBar from '@/components/fluent/MessageBar';
import { card, heading } from '@/lib/theme';
import {
  ATTACHMENT_ACCEPT,
  deleteAttachment,
  isPdf,
  listAttachments,
  signedUrls,
  uploadAttachment,
} from '@/lib/api/expense-attachments';
import type { ExpenseAttachment } from '@/types/database.types';

type Props =
  | { expenseId: string; pending?: never; onPendingChange?: never }
  | { expenseId?: never; pending: File[]; onPendingChange: (files: File[]) => void };

const tile = 'relative h-28 w-28 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)]';
const removeBtn = 'absolute right-1 top-1 rounded-full bg-[var(--color-bg-elevated)] p-1 text-[var(--color-text)] shadow-[var(--shadow-sm)] hover:text-[var(--color-danger)]';

export default function ExpenseAttachments(props: Props) {
  return (
    <section className={card.primary + ' p-6'}>
      <h2 className={heading.h3 + ' mb-1'}>凭证</h2>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">收据照片或 PDF，可多张；只有你自己能看到。</p>
      {props.pending ? <Pending files={props.pending} onChange={props.onPendingChange} /> : <Saved expenseId={props.expenseId} />}
    </section>
  );
}

function AddTile({ onFiles, busy }: { onFiles: (files: File[]) => void; busy?: boolean }) {
  return (
    <label className={tile + ' flex cursor-pointer flex-col items-center justify-center gap-1 border-dashed text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}>
      {busy ? <Spinner /> : <Add20Regular />}
      <span className="text-xs">{busy ? '上传中…' : '添加'}</span>
      <input
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        disabled={busy}
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}

function Thumb({ name, pdf, src, onOpen, onRemove }: { name: string; pdf: boolean; src?: string; onOpen: () => void; onRemove: () => void }) {
  return (
    <div className={tile} title={name}>
      <button type="button" onClick={onOpen} className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-[var(--color-text-secondary)]">
        {pdf || !src ? (
          <>
            {pdf && <DocumentPdf24Regular />}
            <span className="line-clamp-2 break-all text-center text-xs">{name}</span>
          </>
        ) : (
          <Image src={src} alt={name} fill unoptimized className="object-cover" />
        )}
      </button>
      <button type="button" onClick={onRemove} className={removeBtn} aria-label={`删除 ${name}`}>
        <Dismiss16Regular />
      </button>
    </div>
  );
}

/** 新增页：本地暂存 */
function Pending({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const previews = useMemo(() => files.map(f => (isPdf(f) ? '' : URL.createObjectURL(f))), [files]);
  useEffect(() => () => previews.forEach(u => u && URL.revokeObjectURL(u)), [previews]);

  return (
    <div className="flex flex-wrap gap-3">
      {files.map((f, i) => (
        <Thumb
          key={`${f.name}-${f.lastModified}-${i}`}
          name={f.name}
          pdf={isPdf(f)}
          src={previews[i] || undefined}
          onOpen={() => window.open(URL.createObjectURL(f), '_blank')}
          onRemove={() => onChange(files.filter((_, j) => j !== i))}
        />
      ))}
      <AddTile onFiles={added => onChange([...files, ...added])} />
    </div>
  );
}

/** 编辑页：已保存的附件，增删立即生效 */
function Saved({ expenseId }: { expenseId: string }) {
  const queryClient = useQueryClient();
  const key = ['expense-attachments', expenseId];
  const { data: items = [], error: loadError } = useQuery({ queryKey: key, queryFn: () => listAttachments(expenseId) });
  const { data: urls = {} } = useQuery({
    queryKey: [...key, 'urls', items.map(i => i.path).join('|')],
    queryFn: () => signedUrls(items.filter(i => !isPdf(i)).map(i => i.path)),
    enabled: items.length > 0,
    staleTime: 5 * 60_000,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['expense-attachment-counts'] });
  };

  const upload = async (files: File[]) => {
    setBusy(true);
    setError('');
    const failed: string[] = [];
    for (const f of files) {
      try {
        await uploadAttachment(expenseId, f);
      } catch (e) {
        failed.push(e instanceof Error ? e.message : f.name);
      }
    }
    setBusy(false);
    if (failed.length) setError(failed.join('；'));
    refresh();
  };

  const remove = async (att: ExpenseAttachment) => {
    if (!confirm(`删除凭证「${att.file_name}」？`)) return;
    setError('');
    try {
      await deleteAttachment(att);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败，请重试');
    }
  };

  // 先同步开一个空白页再填地址：Safari 只允许在点击的同步部分打开新窗口
  const open = async (att: ExpenseAttachment) => {
    const w = window.open('about:blank', '_blank');
    try {
      const url = (await signedUrls([att.path]))[att.path];
      if (w && url) w.location.href = url;
    } catch (e) {
      w?.close();
      setError(e instanceof Error ? e.message : '打开失败');
    }
  };

  if (loadError) {
    return <MessageBar intent="error">读取凭证失败：{loadError.message}（数据库未升级时需先执行 24_expense_attachments.sql）</MessageBar>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {items.map(att => (
          <Thumb key={att.id} name={att.file_name} pdf={isPdf(att)} src={urls[att.path]} onOpen={() => open(att)} onRemove={() => remove(att)} />
        ))}
        <AddTile onFiles={upload} busy={busy} />
      </div>
      {error && <MessageBar intent="error">{error}</MessageBar>}
    </div>
  );
}
