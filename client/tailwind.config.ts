import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"VT323"', 'monospace'],
      },
      colors: {
        'fh-red': '#880000',
        'fh-blue': '#003366',
        'fh-black': '#111111',
        'fh-border': '#555555',
      },
    },
  },
  plugins: [],
} satisfies Config;
