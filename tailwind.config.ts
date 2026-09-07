import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Lưu ý: tên biến "gold"/"navy" giữ nguyên để không phải sửa lại hàng trăm
      // chỗ đã dùng class trong code, nhưng giá trị hiện tại là bảng màu ĐỎ
      // theo đúng giao diện mẫu (banner đỏ đô + đỏ nhấn), không còn là vàng/xanh nữa.
      colors: {
        ink: '#16324F',
        inksoft: '#5B6B82',
        paper: '#F7F8FA',
        surface: '#FFFFFF',
        line: '#E4E7EC',
        gold: '#B3261E',
        navy: '#7A1420',
        red: '#C0392B',
        green: '#3C7A5D',
        slate: '#4C5C7A',
        paper2: '#F0F2F5',
        amber: '#B7791F'
      },
      fontFamily: {
        display: ['"Be Vietnam Pro"', 'sans-serif'],
        body: ['"Be Vietnam Pro"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      borderRadius: { xl2: '12px' }
    }
  },
  plugins: []
};
export default config;
