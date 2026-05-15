'use client';

export default function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base leading-none">🥇</span>;
  if (rank === 2) return <span className="text-base leading-none">🥈</span>;
  if (rank === 3) return <span className="text-base leading-none">🥉</span>;
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-xs font-medium text-[var(--color-text-muted)]">{rank}</span>;
}
