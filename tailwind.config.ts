import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        coup: {
          bg: '#0f1419',
          surface: '#1a2332',
          card: '#243447',
          accent: '#e6a817',
          duke: '#9b59b6',
          assassin: '#2c3e50',
          captain: '#2980b9',
          ambassador: '#27ae60',
          contessa: '#e74c3c',
          gold: '#f1c40f',
        },
      },
      animation: {
        'flip': 'flip 0.6s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'coin-float': 'coinFloat 1.2s ease-out forwards',
      },
      keyframes: {
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(230, 168, 23, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(230, 168, 23, 0)' },
        },
        coinFloat: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-20px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
