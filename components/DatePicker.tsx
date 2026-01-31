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

  // 解析日期字符串
  const parseDateFromInput = (dateString: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  // 移动端使用原生日期选择器
  if (isMobile && useNativeOnMobile) {
    return (
      <div className="relative w-full">
        <input
          type="date"
          value={formatDateForInput(selected || null)}
          onChange={(e) => onChange(parseDateFromInput(e.target.value))}
          min={minDate ? formatDateForInput(minDate) : undefined}
          max={maxDate ? formatDateForInput(maxDate) : undefined}
          disabled={disabled}
          className={className || input.base + ' cursor-pointer'}
          placeholder={placeholder}
        />
        {/* 如果没有选择日期，显示占位符 */}
        {!selected && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400 text-sm md:text-base">
            {placeholder}
          </div>
        )}
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
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  return (
    <div className="relative w-full">
      <input
        type="date"
        value={formatDateForInput(selected || null)}
        onChange={(e) => onChange(parseDateFromInput(e.target.value))}
        min={minDate ? formatDateForInput(minDate) : undefined}
        max={maxDate ? formatDateForInput(maxDate) : undefined}
        disabled={disabled}
        className={className || input.base + ' cursor-pointer'}
        placeholder={placeholder}
      />
      {!selected && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400 text-sm md:text-base">
          {placeholder}
        </div>
      )}
    </div>
  );
}
