// components/fluent/Tooltip.tsx — Loop 的 tooltip（实测：出现延迟 ≈250ms；离开后 250ms 才隐藏，期间移到另一个目标立即接上；
// 按下鼠标立即隐藏；导航折叠态显示在目标右侧 4px 垂直居中，其他位置显示在目标下方 4px；进出无动画）
// 全页面共用一个 tooltip 节点（与 Loop 相同），样式见 globals.css .fluent-tooltip
'use client';

import { useCallback, type MouseEvent } from 'react';

export type TooltipPlacement = 'right' | 'below';

let tipNode: HTMLDivElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function node() {
  if (!tipNode) {
    tipNode = document.createElement('div');
    tipNode.className = 'fluent-tooltip';
    tipNode.setAttribute('role', 'tooltip');
    tipNode.hidden = true;
    document.body.appendChild(tipNode);
  }
  return tipNode;
}

function show(target: HTMLElement, text: string, placement: TooltipPlacement) {
  const tip = node();
  tip.textContent = text;
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  if (placement === 'right') {
    tip.style.left = `${r.right + 4}px`;
    tip.style.top = `${r.top + r.height / 2 - t.height / 2}px`;
  } else {
    tip.style.left = `${r.left + r.width / 2 - t.width / 2}px`;
    tip.style.top = `${r.bottom + 4}px`;
  }
}

/** 立即隐藏（折叠 / 展开导航时也要调用，避免 tooltip 停在旧位置） */
export function hideTooltipNow() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  if (tipNode) tipNode.hidden = true;
}

function hideLater() {
  clearTimeout(showTimer);
  hideTimer = setTimeout(() => {
    if (tipNode) tipNode.hidden = true;
  }, 250);
}

interface TooltipOptions {
  /** 返回 false 时不显示（如导航展开态只在文字被截断时显示） */
  when?: (target: HTMLElement) => boolean;
  placement?: TooltipPlacement | (() => TooltipPlacement);
}

/** 返回挂到目标元素上的鼠标事件处理器 */
export function useTooltip(text: string, { when, placement = 'below' }: TooltipOptions = {}) {
  const onMouseEnter = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      const target = e.currentTarget;
      if (when && !when(target)) return;
      showTimer = setTimeout(() => show(target, text, typeof placement === 'function' ? placement() : placement), 250);
    },
    [text, when, placement],
  );
  return { onMouseEnter, onMouseLeave: hideLater, onMouseDown: hideTooltipNow };
}
