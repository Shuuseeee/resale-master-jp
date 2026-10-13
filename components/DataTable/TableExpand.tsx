// components/DataTable/TableExpand.tsx — 表格「展开」（Loop 表格上方工具条的「表の展開」，补测-3 #14 + 追加）
// 正文列限宽 920 的例外：展开后表格突破正文列，撑满内容卡片。
// - 按钮只在桌面、正文列已到最大宽 920 且卡片两侧还有余量时出现（分区抽屉开着、≤1024 时没有）
// - 展开：表格从卡片左缘 +20 到右缘 −30；工具条和按钮位置不动（仍在正文列里）
// - 已展开但没有余量（如之后打开了抽屉）：左缘仍对齐正文列，只向右扩到离卡片右缘 32，按钮不显示
// - 宽度瞬间跳变、没有动画；状态按表格记在本机（Loop 存在文档里）
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowFit20Filled, ArrowFit20Regular } from '@fluentui/react-icons/headless/svg/arrow-fit';
import { ArrowFitIn20Filled } from '@fluentui/react-icons/headless/svg/arrow-fit-in';
import DualIcon from '@/components/fluent/DualIcon';
import { useTooltip } from '@/components/fluent/Tooltip';
import { APP_SCROLL_ID } from '@/lib/app-scroll';

const COLUMN_MAX = 920;

function readExpanded(key: string): boolean {
  try {
    return window.localStorage.getItem(`tableExpanded:${key}`) === '1';
  } catch {
    return false;
  }
}

function writeExpanded(key: string, value: boolean) {
  try {
    if (value) window.localStorage.setItem(`tableExpanded:${key}`, '1');
    else window.localStorage.removeItem(`tableExpanded:${key}`);
  } catch {
    // 存储不可用时只是不记住
  }
}

/**
 * 包住表格：上方工具条放「展开」按钮，展开时给表格加宽度与左偏移。
 * storageKey 区分不同表格的展开状态。手机（<768）不参与（表格在手机上是卡片列表）。
 */
export function ExpandableTable({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [available, setAvailable] = useState(false);
  const [style, setStyle] = useState<CSSProperties | undefined>();

  useEffect(() => {
    setExpanded(readExpanded(storageKey));
  }, [storageKey]);

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    const card = document.getElementById(APP_SCROLL_ID);
    if (!anchor || !card || window.innerWidth < 768) {
      setAvailable(false);
      setStyle(undefined);
      return;
    }
    const c = card.getBoundingClientRect();
    const cardWidth = card.clientWidth; // 不含滚动条
    const a = anchor.getBoundingClientRect();
    const canExpand = a.width >= COLUMN_MAX - 0.5 && cardWidth - 50 > a.width;
    setAvailable(canExpand);
    if (!expanded) {
      setStyle(undefined);
    } else if (canExpand) {
      setStyle({ marginLeft: c.left + 20 - a.left, width: cardWidth - 50 });
    } else {
      setStyle({ width: Math.max(a.width, c.left + cardWidth - 32 - a.left) });
    }
  }, [expanded]);

  useLayoutEffect(() => {
    measure();
    const card = document.getElementById(APP_SCROLL_ID);
    const observer = new ResizeObserver(measure);
    if (card) observer.observe(card);
    if (anchorRef.current) observer.observe(anchorRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    writeExpanded(storageKey, next);
  };

  const label = expanded ? '收起表格' : '展开表格';
  const tip = useTooltip(label, { placement: 'top', delay: 300 });

  return (
    <div ref={anchorRef}>
      {available && (
        <div className="table-toolbar" role="toolbar" aria-label="表格操作">
          <button type="button" className="table-expand-btn" aria-label={label} data-expanded={expanded || undefined} onClick={toggle} {...tip}>
            {/* 展开前：常规 / 实心两态（悬停、按下显示实心）；展开后只有一个实心「向内」图标（实测） */}
            {expanded ? <ArrowFitIn20Filled /> : <DualIcon regular={ArrowFit20Regular} filled={ArrowFit20Filled} />}
          </button>
        </div>
      )}
      <div style={style}>{children}</div>
    </div>
  );
}
