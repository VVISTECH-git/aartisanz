/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf8f0',
          100: '#faefd8',
          200: '#f5dbb0',
          300: '#eec07f',
          400: '#e59f4c',
          500: '#dc832a',
          600: '#cd6a1f',
          700: '#aa511c',
          800: '#8B4513',
          900: '#713a14',
        }
      },
      fontFamily: {
        heading: ['Playfair Display', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
