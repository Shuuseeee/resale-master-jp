// components/fluent/Tooltip.tsx — Loop 的 tooltip（实测：出现延迟 ≈250ms；离开后 250ms 才隐藏，期间移到另一个目标立即接上；
// 按下鼠标立即隐藏；进出无动画）。位置（实测，补测-2 #1）：
//   right        导航折叠态：目标右侧 4px，垂直居中
//   bottom-start 顶栏按钮：目标下方 4px，左边缘与目标左边缘对齐
//   bottom-end   顶栏最右侧按钮（头像）、文档头最右侧按钮：下方 4px，右边缘对齐
//   bottom       文档头按钮：下方 4px，水平居中
//   放不下时翻转为另一侧对齐（超出右边 → 右边缘对齐，超出左边 → 左边缘对齐）
// 全页面共用一个 tooltip 节点（与 Loop 相同），样式见 globals.css .fluent-tooltip
'use client';

import { useCallback, type MouseEvent } from 'react';

export type TooltipPlacement = 'right' | 'bottom' | 'bottom-start' | 'bottom-end';

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
    return;
  }
  tip.style.top = `${r.bottom + 4}px`;
  const startLeft = r.left;
  const endLeft = r.right - t.width;
  let left = placement === 'bottom-start' ? startLeft : placement === 'bottom-end' ? endLeft : r.left + r.width / 2 - t.width / 2;
  // 超出视口时翻转对齐（实测：顶栏最右侧按钮左对齐会超出，于是改为右对齐；文档头最右侧按钮同理）
  if (left + t.width > window.innerWidth) left = endLeft;
  if (left < 0) left = startLeft;
  tip.style.left = `${left}px`;
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
  placement?: TooltipPlacement;
}

/** 返回挂到目标元素上的鼠标事件处理器 */
export function useTooltip(text: string, { when, placement = 'bottom' }: TooltipOptions = {}) {
  const onMouseEnter = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      const target = e.currentTarget;
      if (when && !when(target)) return;
      showTimer = setTimeout(() => show(target, text, placement), 250);
    },
    [text, when, placement],
  );
  return { onMouseEnter, onMouseLeave: hideLater, onMouseDown: hideTooltipNow };
}
