/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stadium: {
          green: '#00ff87',
          gold: '#FFD700',
          dark: '#0a0a0f',
          card: '#12121a',
          border: '#1e1e2e',
          text: '#e0e0e0',
          muted: '#666680',
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
          '0%': { boxShadow: '0 0 5px #00ff87, 0 0 10px #00ff87' },
          '100%': { boxShadow: '0 0 20px #00ff87, 0 0 40px #00ff87' },
        }
      }
    },
  },
  plugins: [],
}
