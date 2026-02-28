'use client';

interface IconProps {
  size?: number;
  className?: string;
}

export function ContessaIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Mask body */}
      <path
        d="M8 24c0-6 5-12 12-14h24c7 2 12 8 12 14v4c0 10-8 18-24 22C16 46 8 38 8 28v-4z"
        fill="#dc2626"
        stroke="#f87171"
        strokeWidth="2"
      />
      {/* Left eye cutout */}
      <ellipse cx="22" cy="28" rx="6" ry="5" fill="#1a1a2e" stroke="#f87171" strokeWidth="1.5" />
      {/* Right eye cutout */}
      <ellipse cx="42" cy="28" rx="6" ry="5" fill="#1a1a2e" stroke="#f87171" strokeWidth="1.5" />
      {/* Eye decorations - cat eye flicks */}
      <path d="M14 25l-3-4" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 25l3-4" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
      {/* Nose bridge */}
      <path d="M32 24v10" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
      {/* Decorative forehead swirl */}
      <path
        d="M24 16c4-3 12-3 16 0"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="14" r="2" fill="#fbbf24" />
      {/* Mask stick */}
      <path d="M52 34l8 16" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
