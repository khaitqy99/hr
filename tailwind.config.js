/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  future: {
    // iPhone/iPad: không áp dụng hover: trên thiết bị cảm ứng để khỏi phải chạm hai lần
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
