import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        coup: {
          bg: '#090d0e',
          surface: '#17231f',
          card: '#22302b',
          accent: '#d6a12a',
          duke: '#9b59b6',
          assassin: '#2c3e50',
          captain: '#2980b9',
          ambassador: '#27ae60',
          contessa: '#e74c3c',
          gold: '#f2c744',
        },
      },
      animation: {
        'flip': 'flip 0.6s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'coin-float': 'coinFloat 1.2s ease-out forwards',
        'challenge-card-in': 'challengeCardIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'challenge-card-out': 'challengeCardOut 0.8s ease-in forwards',
        'card-from-deck': 'cardFromDeck 0.6s ease-out forwards',
        'reaction-pop': 'reactionPop 3s ease-out forwards',
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
        challengeCardIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '70%': { transform: 'scale(1.1)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        challengeCardOut: {
          '0%': { transform: 'scale(1) translate(0, 0)', opacity: '1' },
          '100%': { transform: 'scale(0.3) translate(80px, -120px)', opacity: '0' },
        },
        cardFromDeck: {
          '0%': { transform: 'scale(0.3) translate(80px, -120px)', opacity: '0' },
          '100%': { transform: 'scale(1) translate(0, 0)', opacity: '1' },
        },
        reactionPop: {
          '0%': { transform: 'translateX(-50%) scale(0.5)', opacity: '0' },
          '10%': { transform: 'translateX(-50%) scale(1.15)', opacity: '1' },
          '20%': { transform: 'translateX(-50%) scale(1)', opacity: '1' },
          '80%': { transform: 'translateX(-50%) scale(1)', opacity: '1' },
          '100%': { transform: 'translateX(-50%) scale(0.9)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
