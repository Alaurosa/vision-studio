/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          500: '#5850ff',
          600: '#4f46e5',
          700: '#4338ca',
        },
        surface: {
          50: '#0f172a',
          100: '#1e293b',
          200: '#334155',
        },
      },
    },
  },
  plugins: [],
};
