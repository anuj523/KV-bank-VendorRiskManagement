/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kvb: {
          blue: '#1a3a5c',
          indigo: '#2d4fa0',
          sky: '#4a9fd4',
          teal: '#0ea5a0',
          mint: '#a8edea',
          glass: 'rgba(255,255,255,0.12)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.2)',
        'glass-sm': '0 4px 16px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)',
        'glass-lg': '0 16px 48px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.25)',
      }
    },
  },
  plugins: [],
}
