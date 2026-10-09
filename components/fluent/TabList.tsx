// components/fluent/TabList.tsx — 横向 Tab（Fluent TabList；design-spec/components/14-tabs-horizontal.css）
// 选中指示条从旧 Tab 的位置滑到新 Tab：translateX(中心差) scaleX(旧宽 / 新宽) → 原位，300ms cubic-bezier(0.1,0.9,0.2,1)
'use client';

import { useLayoutEffect, useRef } from 'react';

interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabListProps<T extends string> {
  items: readonly TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
}

/** 指示条左右各缩进 12px */
const INDICATOR_INSET = 24;

export default function TabList<T extends string>({ items, selected, onSelect, ariaLabel }: TabListProps<T>) {
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const prevRef = useRef(selected);

  useLayoutEffect(() => {
    const prev = prevRef.current;
    prevRef.current = selected;
    if (prev === selected) return;
    const from = tabRefs.current.get(prev);
    const to = tabRefs.current.get(selected);
    if (!from || !to) return;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const scale = (a.width - INDICATOR_INSET) / (b.width - INDICATOR_INSET);
    to.classList.add('no-anim');
    to.style.setProperty('--ind', `translateX(${dx}px) scaleX(${scale})`);
    void to.offsetWidth;
    to.classList.remove('no-anim');
    to.style.setProperty('--ind', 'translateX(0px) scaleX(1)');
  }, [selected]);

  return (
    <div className="htabs" role="tablist" aria-label={ariaLabel}>
      {items.map(item => (
        <button
          key={item.id}
          ref={el => {
            if (el) tabRefs.current.set(item.id, el);
            else tabRefs.current.delete(item.id);
          }}
          type="button"
          role="tab"
          aria-selected={item.id === selected}
          className="htab"
          onClick={() => onSelect(item.id)}
        >
          <span className="htab__label">
            {item.label}
            <span className="htab__reserved" aria-hidden="true">
              {item.label}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
