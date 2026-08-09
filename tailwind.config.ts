import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ART-DIRECTION.md §2 — one palette, consumed by name.
        // The hex values here are the source of truth; `globals.css :root`
        // mirrors them as `--ground`/`--ink`/... for plain CSS. Keep in sync.
        coup: {
          // --- §2.1 Ground and structure -------------------------------------
          // Existing names, kept: other components depend on them today.
          bg: '#090d0e',        // --ground      body, deepest table
          surface: '#17231f',   // --surface     the felt
          card: '#22302b',      // --raised      seats, prompts
          accent: '#d6a12a',    // --brass       your turn, primary slabs, focus ring
          gold: '#f2c744',      // --brass-lit   coin figures and treasury only

          // New §2.1 tokens. `brass`/`brass-lit`/`ground-deep` are the
          // art-direction names; `accent`/`gold`/`bg` are the legacy aliases
          // for the same values, so both spellings resolve identically while
          // call sites migrate.
          'ground-deep': '#05090a', // wells, the deck recess, inside a deboss
          line: '#33443e',          // the ONLY hairline value (card trim, deboss highlight)
          ink: '#f1ebde',           // all primary text — bone, not white
          'ink-mute': '#9fada6',    // secondary text (replaces text-gray-400/500)
          brass: '#d6a12a',
          'brass-lit': '#f2c744',
          crimson: '#f27366',       // the danger *stripe* colour, and only that
          oxblood: '#5f141c',       // perimeter enamel, matching the table art

          // --- §2.2 The six character hues -----------------------------------
          // Every one is lower saturation than the Tailwind defaults that ship
          // today; the character is identified by glyph first, hue second.
          duke: '#b48ad0',        // 276° S34  (was #9b59b6 / purple-500)
          assassin: '#8d9ba6',    // 206° S15  cold steel; the fix is the glyph
          captain: '#5fa5d6',     // 205° S56  (was #2980b9 / blue-500)
          ambassador: '#a9be5e',  //  73° S51  chartreuse, not green
          contessa: '#e07b90',    // 348° S45  rose-crimson, off pure red vs --crimson
          inquisitor: '#5ac0c6',  // 183° S55  cyan is reserved to the Inquisitor
        },
      },
      // ART-DIRECTION.md §4 — three type roles, no more.
      // `--font-display` is set on <html> by next/font/local (layout.tsx);
      // `--font-body` / `--font-figure` are declared in globals.css :root.
      // The literal fallbacks after each var() are what renders if the
      // self-hosted file ever fails, so the app degrades to a condensed
      // grotesque rather than to nothing.
      fontFamily: {
        display: [
          'var(--font-display)',
          'Oswald',
          'Haettenschweiler',
          '"Arial Narrow Bold"',
          'Impact',
          'system-ui',
          'sans-serif',
        ],
        sans: [
          'var(--font-body)',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'var(--font-figure)',
          'ui-monospace',
          '"SF Mono"',
          '"Cascadia Mono"',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      // ART-DIRECTION.md §4 — "earn hierarchy with size and weight, never
      // tracking." The scale lives as custom properties in globals.css so
      // plain CSS can use it too; these aliases expose it as `text-step-N`.
      fontSize: {
        'step--1': 'var(--step--1)',
        'step-0': 'var(--step-0)',
        'step-1': 'var(--step-1)',
        'step-2': 'var(--step-2)',
        'step-3': 'var(--step-3)',
        'step-4': 'var(--step-4)',
        'step-5': 'var(--step-5)',
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
