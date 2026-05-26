/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stadium: {
          green:  'rgb(var(--c-green)  / <alpha-value>)',
          gold:   'rgb(var(--c-gold)   / <alpha-value>)',
          dark:   'rgb(var(--c-dark)   / <alpha-value>)',
          card:   'rgb(var(--c-card)   / <alpha-value>)',
          border: 'rgb(var(--c-border) / <alpha-value>)',
          text:   'rgb(var(--c-text)   / <alpha-value>)',
          muted:  'rgb(var(--c-muted)  / <alpha-value>)',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%':   { boxShadow: '0 0 5px rgb(var(--c-green)), 0 0 10px rgb(var(--c-green))' },
          '100%': { boxShadow: '0 0 20px rgb(var(--c-green)), 0 0 40px rgb(var(--c-green))' },
        }
      }
    },
  },
  plugins: [],
}
