import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1B2A4A',
        inksoft: '#51607A',
        paper: '#EFEEE8',
        surface: '#FFFFFF',
        line: '#DEDCD2',
        gold: '#8C6423',
        red: '#A63D40',
        green: '#3C7A5D'
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'serif'],
        body: ['"Be Vietnam Pro"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      borderRadius: { xl2: '12px' }
    }
  },
  plugins: []
};
export default config;
