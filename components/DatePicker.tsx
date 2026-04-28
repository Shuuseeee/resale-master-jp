// components/DatePicker.tsx
'use client';

import { useState, useEffect } from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "/assets/styles/date-picker.css";
import { ja } from "date-fns/locale/ja";
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
  showYearDropdown?: boolean;
  showMonthDropdown?: boolean;
  dropdownMode?: 'scroll' | 'select';
  useNativeOnMobile?: boolean; // 新增：是否在移动端使用原生选择器
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
  showYearDropdown = true,
  showMonthDropdown = true,
  dropdownMode = 'select',
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

  // 移动端使用原生日期选择器（自定义样式包装）
  if (isMobile && useNativeOnMobile) {
    const displayValue = selected
      ? selected.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : null;
    return (
      <div className="relative">
        <div className={`flex items-center gap-2 ${className || 'px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-apple-separator dark:border-apple-sepDark rounded-lg'} ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className={`min-w-0 overflow-hidden ${displayValue ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-apple-gray-1'}`}>
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
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    );
  }

  // 桌面端使用 react-datepicker
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
      showYearDropdown={showYearDropdown}
      showMonthDropdown={showMonthDropdown}
      dropdownMode={dropdownMode}
      className={className || input.base}
      wrapperClassName="w-full"
      calendarClassName="custom-datepicker"
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
}: Omit<DatePickerProps, 'dateFormat' | 'showYearDropdown' | 'showMonthDropdown' | 'dropdownMode' | 'useNativeOnMobile'>) {
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
      className={className || input.base + ' w-full cursor-pointer'}
    />
  );
}
