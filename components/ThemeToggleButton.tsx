'use client';

import { Moon, Sun } from 'lucide-react';

const THEME_STORAGE_KEY = 'snutils-theme';

function getCurrentTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  const root = document.documentElement;
  const theme = root.getAttribute('data-theme');
  if (theme === 'dark' || theme === 'light') return theme;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', theme === 'dark');
  document.body?.setAttribute('data-theme', theme);
}

export default function ThemeToggleButton() {
  const handleToggle = () => {
    const nextTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures; the in-page theme still switches immediately.
    }
  };

  return (
    <div className="theme-toggle" title="切换深色/浅色模式">
      <button
        id="theme-toggle-btn"
        type="button"
        className="btn-theme"
        aria-label="切换深色/浅色模式"
        onClick={handleToggle}
      >
        <Sun className="icon-sun" size={18} strokeWidth={2} />
        <Moon className="icon-moon" size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
