// components/DatePicker.tsx
// 桌面：react-datepicker，外观照 Fluent Calendar（design-spec/components/17-datepicker.css，样式在 assets/styles/date-picker.css）
// - 头部自绘：「2026年10月」标题按钮（点击进入月份视图）+ 上 / 下月箭头；底部「转到今天」（显示当月时禁用，只跳转不选中）
// - 动画：打开与往后翻月时日期行从下 20px 淡入，往前翻月从上 20px，400ms cubic-bezier(0.1,0.9,0.2,1)；打开时日期格淡入 250ms；
//   月份视图的行同样从下 20px 淡入；弹层本身无进出动画
// 手机：原生日期选择器（外观同输入框）
'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import ReactDatePicker, { registerLocale, type ReactDatePickerCustomHeaderProps } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "/assets/styles/date-picker.css";
import { ja } from "date-fns/locale/ja";
import { ArrowDown12Regular } from '@fluentui/react-icons/headless/svg/arrow-down';
import { ArrowUp12Regular } from '@fluentui/react-icons/headless/svg/arrow-up';
import { CalendarLtr16Regular } from '@fluentui/react-icons/headless/svg/calendar-ltr';
registerLocale("ja", ja);
import { input } from '@/lib/theme';

interface DatePickerProps {
  selected?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  dateFormat?: string;
  useNativeOnMobile?: boolean; // 是否在移动端使用原生选择器
}

const ROW_EASING = 'cubic-bezier(0.1, 0.9, 0.2, 1)';

function motion(ms: number) {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : ms;
}

function animateRows(rows: Iterable<Element>, dir: 1 | -1) {
  for (const row of rows) {
    row.animate(
      [{ transform: `translateY(${20 * dir}px)`, opacity: 0 }, { transform: 'translateY(0px)', opacity: 1 }],
      { duration: motion(400), easing: ROW_EASING },
    );
  }
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

/** Fluent Calendar 头部 + 月份视图 + 「转到今天」（renderCustomHeader 渲染，随日历一起挂载 / 卸载） */
function CalendarHeader({
  monthDate,
  changeMonth,
  changeYear,
  decreaseMonth,
  increaseMonth,
  decreaseYear,
  increaseYear,
  prevMonthButtonDisabled,
  nextMonthButtonDisabled,
  prevYearButtonDisabled,
  nextYearButtonDisabled,
}: ReactDatePickerCustomHeaderProps) {
  const [monthView, setMonthView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef<number | null>(null);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const today = new Date();
  const showingToday = year === today.getFullYear() && month === today.getMonth();

  // 打开时 / 翻月时：日期行按方向滑入；打开时日期格另外淡入
  useLayoutEffect(() => {
    const container = rootRef.current?.closest('.react-datepicker__month-container');
    if (!container) return;
    const key = year * 12 + month;
    const prev = shownRef.current;
    shownRef.current = key;
    if (prev === key) return;
    animateRows(container.querySelectorAll('.react-datepicker__week'), prev === null || key > prev ? 1 : -1);
    if (prev === null) {
      for (const day of container.querySelectorAll('.react-datepicker__day')) {
        day.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motion(250), easing: 'cubic-bezier(0.33, 0, 0.67, 1)' });
      }
    }
  }, [year, month]);

  useLayoutEffect(() => {
    if (!monthView) return;
    const rows = rootRef.current?.querySelectorAll('.fluent-calendar__picker-row');
    if (rows) animateRows(rows, 1);
  }, [monthView]);

  const goToday = () => {
    changeYear(today.getFullYear());
    changeMonth(today.getMonth());
  };

  return (
    <div ref={rootRef} className="fluent-calendar__header">
      <button type="button" className="fluent-calendar__title" onClick={() => setMonthView(true)} aria-label={`${year}年${month + 1}月，切换到月份视图`}>
        {year}年{month + 1}月
      </button>
      <div className="fluent-calendar__nav">
        <button type="button" className="fluent-calendar__nav-btn" onClick={decreaseMonth} disabled={prevMonthButtonDisabled} aria-label="上个月">
          <ArrowUp12Regular />
        </button>
        <button type="button" className="fluent-calendar__nav-btn" onClick={increaseMonth} disabled={nextMonthButtonDisabled} aria-label="下个月">
          <ArrowDown12Regular />
        </button>
      </div>

      <button type="button" className="fluent-calendar__go-today" onClick={goToday} disabled={showingToday}>
        转到今天
      </button>

      {monthView && (
        <div className="fluent-calendar__picker">
          <div className="fluent-calendar__picker-header">
            <button type="button" className="fluent-calendar__picker-current" onClick={() => setMonthView(false)} aria-label={`${year}年，返回日期视图`}>
              {year}年
            </button>
            <div className="fluent-calendar__nav">
              <button type="button" className="fluent-calendar__nav-btn" onClick={decreaseYear} disabled={prevYearButtonDisabled} aria-label="上一年">
                <ArrowUp12Regular />
              </button>
              <button type="button" className="fluent-calendar__nav-btn" onClick={increaseYear} disabled={nextYearButtonDisabled} aria-label="下一年">
                <ArrowDown12Regular />
              </button>
            </div>
          </div>
          <div className="fluent-calendar__picker-grid">
            {[0, 1, 2].map(row => (
              <div key={row} className="fluent-calendar__picker-row">
                {MONTHS.slice(row * 4, row * 4 + 4).map(m => (
                  <button
                    key={m}
                    type="button"
                    className="fluent-calendar__picker-item"
                    aria-selected={m === month}
                    onClick={() => {
                      changeMonth(m);
                      setMonthView(false);
                    }}
                  >
                    {m + 1}月
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DatePicker({
  selected,
  onChange,
  placeholder = '选择日期',
  minDate,
  maxDate,
  disabled = false,
  className,
  dateFormat = 'yyyy-MM-dd',
  useNativeOnMobile = true, // 默认启用
}: DatePickerProps) {
  const [isMobile, setIsMobile] = useState(false);

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md 断点
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 格式化日期为 YYYY-MM-DD (HTML input[type="date"] 格式)
  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 解析日期字符串 (修复时区问题)
  const parseDateFromInput = (dateString: string) => {
    if (!dateString) return null;
    // 使用本地时区解析日期，避免 UTC 偏移
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  };

  // 移动端使用原生日期选择器（外观同输入框）
  if (isMobile && useNativeOnMobile) {
    const displayValue = selected
      ? selected.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : null;
    return (
      <div className="relative">
        <div className={`flex items-center gap-2 ${className || input.base} ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
          <CalendarLtr16Regular className="flex-shrink-0 text-[var(--color-text-muted)]" />
          <span className={`min-w-0 overflow-hidden ${displayValue ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)] opacity-60'}`}>
            {displayValue || placeholder}
          </span>
        </div>
        <input
          type="date"
          value={formatDateForInput(selected || null)}
          onChange={(e) => onChange(parseDateFromInput(e.target.value))}
          min={minDate ? formatDateForInput(minDate) : undefined}
          max={maxDate ? formatDateForInput(maxDate) : undefined}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    );
  }

  // 桌面端使用 react-datepicker（Fluent Calendar 外观）
  return (
    <ReactDatePicker
      selected={selected}
      onChange={onChange}
      dateFormat={dateFormat}
      locale="ja"
      placeholderText={placeholder}
      minDate={minDate}
      maxDate={maxDate}
      disabled={disabled}
      renderCustomHeader={props => <CalendarHeader {...props} />}
      className={className || input.base}
      wrapperClassName="w-full"
      calendarClassName="fluent-calendar"
      popperPlacement="bottom-start"
      popperProps={{
        strategy: 'fixed',
      }}
    />
  );
}

// 导出一个强制使用原生选择器的版本（适用于所有设备）
export function NativeDatePicker({
  selected,
  onChange,
  placeholder = '选择日期',
  minDate,
  maxDate,
  disabled = false,
  className,
}: Omit<DatePickerProps, 'dateFormat' | 'useNativeOnMobile'>) {
  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDateFromInput = (dateString: string) => {
    if (!dateString) return null;
    // 使用本地时区解析日期，避免 UTC 偏移
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  };

  return (
    <input
      type="date"
      value={formatDateForInput(selected || null)}
      onChange={(e) => onChange(parseDateFromInput(e.target.value))}
      min={minDate ? formatDateForInput(minDate) : undefined}
      max={maxDate ? formatDateForInput(maxDate) : undefined}
      disabled={disabled}
      className={className || `${input.base} w-full cursor-pointer`}
    />
  );
}
