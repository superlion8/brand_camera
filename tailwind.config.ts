import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 新配色方案 - 黑+黄
        primary: '#000000',
        accent: {
          DEFAULT: '#FFFC00',
          light: '#FFFD66',
          dark: '#E6E300',
        },
        surface: {
          DEFAULT: 'rgba(255, 255, 255, 0.1)',
          elevated: 'rgba(255, 255, 255, 0.15)',
          solid: '#101828',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.1)',
          light: 'rgba(255, 255, 255, 0.2)',
        },
      },
      fontFamily: {
        sans: ['PingFang SC', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        display: ['SF Pro Display', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'button': '9999px',
        'input': '12px',
        'sheet': '24px',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-yellow': 'pulseYellow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulseYellow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 252, 0, 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(255, 252, 0, 0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
export default config
