/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: '#1A1A2E',
        canvasDeep: '#121220',
        surface: '#24243E',
        surfaceHover: '#2A2A48',
        surfaceBorder: '#2E2E50',
        cobalt: '#0047AB',
        cobaltLight: '#1A62CC',
        signalStart: '#FF6B35',
        signalEnd: '#FF1840',
      },
      backgroundImage: {
        'signal-gradient': 'linear-gradient(135deg, #FF6B35 0%, #FF1840 100%)',
        'canvas-gradient': 'linear-gradient(180deg, #1A1A2E 0%, #121220 100%)',
        'surface-gradient': 'linear-gradient(145deg, #24243E 0%, #1E1E34 100%)',
      },
      boxShadow: {
        'signal-glow': '0 0 25px -4px rgba(255, 24, 64, 0.4), 0 0 10px -2px rgba(255, 107, 53, 0.3)',
        'surface-elevated': '0 12px 30px -8px rgba(0, 0, 0, 0.5), 0 4px 10px -2px rgba(0, 0, 0, 0.3)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)', filter: 'drop-shadow(0 0 6px rgba(255, 24, 64, 0.8))' },
          '50%': { opacity: '0.6', transform: 'scale(1.15)', filter: 'drop-shadow(0 0 12px rgba(255, 107, 53, 0.9))' },
        },
        pulseAmber: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)', filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))' },
          '50%': { opacity: '0.5', transform: 'scale(1.15)', filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.5))' },
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-amber': 'pulseAmber 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
