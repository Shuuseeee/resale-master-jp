import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts}',
  ],
  theme: {
    // 自定义断点 - 针对不同设备优化
    screens: {
      'xs': '375px',   // 小型手机 (iPhone SE, etc.)
      'sm': '640px',   // 标准手机横屏 / 大屏手机
      'md': '768px',   // 平板竖屏
      'lg': '1024px',  // 平板横屏 / 小型桌面
      'xl': '1280px',  // 标准桌面
      '2xl': '1536px', // 大屏桌面
    },
    extend: {
      // Apple iOS 语义色
      colors: {
        apple: {
          bg:       '#F2F2F7',  // systemGroupedBackground
          bgDark:   '#000000',  // dark background
          card:     '#FFFFFF',  // secondarySystemGroupedBackground
          cardDark: '#1C1C1E',  // dark card
          blue:     '#007AFF',  // systemBlue
          green:    '#34C759',  // systemGreen
          red:      '#FF3B30',  // systemRed
          orange:   '#FF9500',  // systemOrange
          gray: {
            1: '#8E8E93',  // systemGray
            2: '#AEAEB2',  // systemGray2
            3: '#C7C7CC',  // systemGray3
            4: '#D1D1D6',  // systemGray4
            5: '#E5E5EA',  // systemGray5
            6: '#F2F2F7',  // systemGray6
          },
          separator: '#C6C6C8',
          sepDark:   '#38383A',
        },
      },
      // 动画
      animation: {
        'pulse': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      // 触摸目标尺寸 (WCAG 2.1 AAA: 44x44px)
      spacing: {
        'touch': '44px',      // 标准触摸目标 (iOS)
        'touch-md': '48px',   // 较大触摸目标 (Android Material)
        'touch-lg': '56px',   // 大型触摸目标
      },
      // 最小尺寸
      minHeight: {
        'touch': '44px',
        'touch-md': '48px',
        'touch-lg': '56px',
      },
      minWidth: {
        'touch': '44px',
        'touch-md': '48px',
        'touch-lg': '56px',
      },
      // 阴影（Apple 风格：极浅，仅用于区分层级）
      boxShadow: {
        'card': '0 1px 2px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.06)',
        'card-md': '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
      },
      // 字体大小优化（移动端友好）
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],  // 10px
        'xs': ['0.75rem', { lineHeight: '1rem' }],       // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],    // 20px
        // Responsive fluid typography using clamp()
        'fluid-xs': 'clamp(0.75rem, 2vw, 0.875rem)',    // 12-14px
        'fluid-sm': 'clamp(0.875rem, 2.5vw, 1rem)',     // 14-16px
        'fluid-base': 'clamp(1rem, 3vw, 1.125rem)',     // 16-18px
        'fluid-lg': 'clamp(1.125rem, 3.5vw, 1.25rem)',  // 18-20px
        'fluid-xl': 'clamp(1.25rem, 4vw, 1.5rem)',      // 20-24px
        'fluid-2xl': 'clamp(1.5rem, 5vw, 2rem)',        // 24-32px
        'fluid-3xl': 'clamp(1.875rem, 6vw, 2.25rem)',   // 30-36px
        'fluid-4xl': 'clamp(2rem, 7vw, 3rem)',          // 32-48px
      },
      // CJK-optimized line heights
      lineHeight: {
        'cjk-tight': '1.4',
        'cjk-normal': '1.6',
        'cjk-relaxed': '1.8',
      },
      // Z-index 层级管理
      zIndex: {
        'modal-backdrop': '40',
        'modal': '50',
        'dropdown': '30',
        'header': '20',
        'overlay': '10',
      },
      // 过渡时间
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
    },
  },
  plugins: [],
}
export default config