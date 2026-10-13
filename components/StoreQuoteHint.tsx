// components/StoreQuoteHint.tsx — 出售表单单价下方的报价提示（照买取X：「{店}的当前收购价：¥…（时间）」+「填入该价格」）
'use client';

import { formatQuoteTime, type StoreQuote } from '@/hooks/useStoreQuotes';

export default function StoreQuoteHint({ quote, currentPrice, onApply }: { quote: StoreQuote | null; currentPrice: number; onApply: () => void }) {
  if (!quote) return null;
  return (
    <p className="mt-1 text-xs leading-normal text-[var(--color-text-muted)]">
      {quote.store}的当前收购价：¥{quote.price.toLocaleString('ja-JP')}（{formatQuoteTime(quote.updatedAt)}）
      {Number(currentPrice) !== quote.price && (
        <button type="button" onClick={onApply} className="fluent-link ml-1 text-xs">
          填入该价格
        </button>
      )}
    </p>
  );
}
