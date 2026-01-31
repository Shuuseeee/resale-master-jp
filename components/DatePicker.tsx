// components/DatePicker.tsx
'use client';

import ReactDatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "/assets/styles/date-picker.css";
import ja from "date-fns/locale/ja";
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
}: DatePickerProps) {
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
    />
  );
}
