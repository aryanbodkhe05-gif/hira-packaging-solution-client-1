/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3131B5',
        navy: '#1A1A70',
        background: '#0E0E3A',
        accent: '#5E5EE8',
        success: '#12B76A',
        muted: '#8888AA',
        glass: 'rgba(26,26,112,0.45)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(49,49,181,0.15) 0%, rgba(14,14,58,0.6) 100%)',
      },
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        ping: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
