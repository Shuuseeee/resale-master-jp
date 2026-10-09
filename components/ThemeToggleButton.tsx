'use client';

import { Moon, Sun } from 'lucide-react';
import { getResolvedTheme, setThemePreference } from '@/lib/theme-mode';
import { useTooltip } from '@/components/fluent/Tooltip';

/** 顶栏快速切换：把偏好显式设为与当前相反的浅色 / 深色（「跟随系统」在设置页选） */
export default function ThemeToggleButton() {
  const tip = useTooltip('切换深色/浅色模式', { placement: 'bottom-start' });
  const handleToggle = () => {
    setThemePreference(getResolvedTheme() === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      className="shell-icon-btn btn-theme"
      aria-label="切换深色/浅色模式"
      onClick={handleToggle}
      {...tip}
    >
      <Sun className="icon-sun" size={20} />
      <Moon className="icon-moon" size={20} />
    </button>
  );
}
