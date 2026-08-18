import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#182B4D',
        inksoft: '#5A6785',
        paper: '#F3F1E9',
        surface: '#FFFFFF',
        line: '#E1DECF',
        gold: { DEFAULT: '#9C6B14', soft: '#F1E4C8' },
        red: { DEFAULT: '#A23A2E', soft: '#F3DCD6' },
        green: { DEFAULT: '#2E7350', soft: '#DCEBE1' },
        slate: { DEFAULT: '#48577A', soft: '#E3E6EE' },
        paper2: '#EAE7DA'
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'serif'],
        body: ['"Be Vietnam Pro"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      borderRadius: { xl2: '13px' },
      boxShadow: {
        card: '0 1px 2px rgba(24,43,77,0.05), 0 4px 12px -6px rgba(24,43,77,0.12)',
        'card-lift': '0 10px 26px -10px rgba(24,43,77,0.22)'
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.35', transform: 'scale(1.35)' }
        }
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
export default config;
