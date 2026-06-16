export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sakura: {
          50: '#fff5f7',
          100: '#ffe4ec',
          200: '#ffc2d6',
          300: '#ff9ebd',
          400: '#ff6f9f',
          500: '#f43f7f',
          600: '#d81f64',
        },
        ink: '#1f1720',
      },
      fontFamily: {
        serif: ['"Shippori Mincho"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(216, 31, 100, 0.12)',
      },
    },
  },
  plugins: [],
};
