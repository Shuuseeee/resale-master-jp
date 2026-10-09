'use client';

import { WeatherMoon20Filled, WeatherMoon20Regular } from '@fluentui/react-icons/headless/svg/weather-moon';
import { WeatherSunny20Filled, WeatherSunny20Regular } from '@fluentui/react-icons/headless/svg/weather-sunny';
import DualIcon from '@/components/fluent/DualIcon';
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
      <span className="icon-sun">
        <DualIcon regular={WeatherSunny20Regular} filled={WeatherSunny20Filled} />
      </span>
      <span className="icon-moon">
        <DualIcon regular={WeatherMoon20Regular} filled={WeatherMoon20Filled} />
      </span>
    </button>
  );
}
