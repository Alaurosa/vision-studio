/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Editorial warm-paper palette inspired by architectural studio sites
        paper: {
          50:  '#faf7f1',
          100: '#f4efe4',
          200: '#ebe3d1',
          300: '#ddd1b8',
          400: '#c9b894',
          500: '#a89370',
        },
        ink: {
          900: '#100f0d',
          800: '#1c1a16',
          700: '#2b2823',
          600: '#46413a',
          500: '#6c655b',
          400: '#8f877b',
          300: '#b8b0a2',
        },
        sienna: {
          300: '#d2a87e',
          400: '#b8875a',
          500: '#9c6a3f',
          600: '#7e5230',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Cormorant Garamond', 'ui-serif', 'Georgia', 'serif'],
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        'editorial': '0.18em',
      },
      maxWidth: {
        '8xl': '88rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      },
      animation: {
        'fade-up': 'fade-up 0.8s ease-out both',
        'fade-in': 'fade-in 0.6s ease-out both',
      },
    },
  },
  plugins: [],
};
