'use client';

interface CoupLogoProps {
  className?: string;
}

export function CoupLogo({ className }: CoupLogoProps) {
  return (
    <svg
      viewBox="0 0 320 100"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="COUP"
    >
      {/* Dagger behind the letters */}
      <g opacity="0.25">
        <path
          d="M160 0L156 52h8L160 0z"
          fill="#94a3b8"
        />
        <path
          d="M150 52h20v4c0 1-4 3-10 3s-10-2-10-3v-4z"
          fill="#475569"
        />
        <rect x="157" y="58" width="6" height="8" rx="1" fill="#1e293b" />
        <circle cx="160" cy="69" r="2.5" fill="#475569" />
      </g>

      {/* Letter C */}
      <text
        x="40"
        y="78"
        fill="#fbbf24"
        fontSize="80"
        fontWeight="900"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="2"
      >
        C
      </text>

      {/* Letter O */}
      <text
        x="110"
        y="78"
        fill="#fbbf24"
        fontSize="80"
        fontWeight="900"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="2"
      >
        O
      </text>

      {/* Letter U */}
      <text
        x="185"
        y="78"
        fill="#fbbf24"
        fontSize="80"
        fontWeight="900"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="2"
      >
        U
      </text>

      {/* Letter P */}
      <text
        x="258"
        y="78"
        fill="#fbbf24"
        fontSize="80"
        fontWeight="900"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="2"
      >
        P
      </text>

      {/* Underline accent */}
      <path
        d="M30 88h260"
        stroke="#fbbf24"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Decorative dagger tips on sides */}
      <path d="M20 88l-6-8v8h6z" fill="#fbbf24" opacity="0.4" />
      <path d="M300 88l6-8v8h-6z" fill="#fbbf24" opacity="0.4" />
    </svg>
  );
}
