/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        /** Editorial UI (Studio, Chat, loaders) */
        ink: {
          300: '#c4beb6',
          400: '#9b938a',
          500: '#6f6860',
          600: '#4a4540',
          700: '#2e2b28',
          900: '#100f0d',
        },
        paper: {
          50: '#faf7f1',
          100: '#f0ebe3',
        },
        sienna: {
          400: '#c4896a',
          500: '#9c6a3f',
          600: '#7d5433',
          700: '#5c3e26',
        },
        vs: {
          light: '#edf6fa',
          soft: '#abbdd5',
          dark: '#2b2b2b',
          charcoal: '#1f1f1f',
          midnight: '#040c2e',
          accent: '#004aad',
          warm: '#f8f8f6',
        },
        // Neutral surface palette (dark mode primary)
        surface: {
          900: '#0a0a0a',  // Modal backdrops, deepest
          800: '#121212',  // Main background
          700: '#1a1a1a',  // Secondary panels, cards
          600: '#242424',  // Tertiary, hover states
          500: '#333333',  // Interactive hover, borders
          400: '#505050',  // Disabled text
          300: '#787878',  // Secondary text
          200: '#a0a0a0',  // Tertiary text, muted
          100: '#d4d4d4',  // Primary text (light)
          50:  '#ffffff',  // White, highest contrast
        },
        // Brand blue (Vision Studio signature)
        blue: {
          900: '#0d1b2a',
          800: '#0f3178',
          700: '#0057C6', // Vision Studio brand blue
          600: '#1f6ae8',
          500: '#4f8efb',
          400: '#84b5ff',
          300: '#b8d6ff',
          200: '#dae9ff',
          100: '#eef6ff',
        },
        // Semantic colors
        success: {
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          500: '#ef4444',
          600: '#dc2626',
        },
        info: {
          500: '#06b6d4',
          600: '#0891b2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'ui-serif', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        '8xl': '88rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'fade-in': 'fade-in 0.6s ease-out both',
        'slide-up': 'slide-up 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
      },
      backdropBlur: {
        xs: '2px',
      },
      letterSpacing: {
        editorial: '0.22em',
      },
    },
  },
  plugins: [],
};
