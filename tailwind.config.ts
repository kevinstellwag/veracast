import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:    '#0d0c0a',
        ink2:   '#1a1916',
        ink3:   '#252320',
        paper:  '#f6f3ec',
        cream:  '#edeae0',
        rust:   '#c0430a',
        rust2:  '#e05a2b',
        gold:   '#c8a43e',
        gold2:  '#e8c45e',
        sage:   '#3d7a52',
        sage2:  '#5aa06e',
        slate2: '#3a4a5e',
        mist:   '#7a8a9a',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans:  ['var(--font-sans)',  'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)',  'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
