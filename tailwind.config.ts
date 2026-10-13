import type { Config } from 'tailwindcss';

/*
 * Giao diện tối "high-tech" (Flomal).
 * Các thang màu slate / blue / emerald / red / amber / sky được ĐẢO cho nền tối:
 *  - số nhỏ (50–200)  = nền / viền tối có ánh màu
 *  - số lớn (700–900) = chữ sáng
 *  - 400–600          = màu đậm cho nút, chấm, viền nhấn
 * Nhờ vậy các class cũ (text-slate-600, bg-blue-50, text-blue-700…) tự hiển thị đúng trên nền tối
 * mà không cần sửa từng trang.
 */
const slate = {
  50: '#0e1525',
  100: '#131b2d',
  200: '#1e2940',
  300: '#2a3753',
  400: '#64738f',
  500: '#8b97ae',
  600: '#a7b2c6',
  700: '#c4ccdb',
  800: '#dfe4ee',
  900: '#eef2f8',
  950: '#f8fafc',
};
const blue = {
  50: '#0d1a33',
  100: '#112449',
  200: '#1a3770',
  300: '#24519e',
  400: '#3b74e8',
  500: '#3d7bff',
  600: '#2f6bff',
  700: '#7fb2ff',
  800: '#a9ccff',
  900: '#d6e6ff',
  950: '#eef5ff',
};
const emerald = {
  50: '#0a1f1a',
  100: '#0e2c24',
  200: '#164638',
  300: '#1f6b55',
  400: '#3ee6a8',
  500: '#22d39a',
  600: '#1bb886',
  700: '#4be3a6',
  800: '#86f0c4',
  900: '#c4f9e2',
  950: '#ecfdf5',
};
const red = {
  50: '#2a1016',
  100: '#3a141c',
  200: '#5c1d29',
  300: '#8a2a3a',
  400: '#f87171',
  500: '#ef4444',
  600: '#ff6b6b',
  700: '#ff8f8f',
  800: '#ffb4b4',
  900: '#ffd6d6',
  950: '#fff1f1',
};
const amber = {
  50: '#241a07',
  100: '#33250a',
  200: '#5a4310',
  300: '#8a6514',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#fbbf24',
  700: '#fcd34d',
  800: '#fcd34d',
  900: '#fde68a',
  950: '#1c1300', // chữ tối trên nhãn DEMO vàng
};
const sky = {
  50: '#0a1d2b',
  100: '#0d2638',
  200: '#13405c',
  300: '#1c5f87',
  400: '#38bdf8',
  500: '#0ea5e9',
  600: '#38bdf8',
  700: '#7dd3fc',
  800: '#bae6fd',
  900: '#e0f2fe',
  950: '#f0f9ff',
};

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate,
        blue,
        emerald,
        red,
        amber,
        sky,
        ink: '#070b14', // nền trang
        surface: '#0f1729', // nền thẻ (thay cho bg-white)
        raised: '#152036', // nền nổi (hover, ô nhập)
        paper: '#ffffff', // trắng thật — chỉ dùng khi bắt buộc (ô QR minh hoạ)
        brand: { blue: '#2f6bff', cyan: '#22d3ee', green: '#22d39a' },
      },
      fontFamily: {
        // Một font duy nhất cho toàn site: Be Vietnam Pro (hỗ trợ tiếng Việt đầy đủ, dáng hình học hiện đại)
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        display: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
      ringOffsetColor: { DEFAULT: '#0f1729' },
      boxShadow: {
        glow: '0 0 0 1px rgba(61,123,255,.35), 0 8px 30px -6px rgba(47,107,255,.45)',
        'glow-green': '0 0 0 1px rgba(34,211,154,.35), 0 8px 30px -6px rgba(34,211,154,.4)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        spinslow: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        pop: 'pop 0.35s ease-out',
        float: 'float 6s ease-in-out infinite',
        spinslow: 'spinslow 40s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
