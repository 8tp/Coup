'use client';

interface IconProps {
  size?: number;
  className?: string;
}

export function AssassinIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Blade */}
      <path
        d="M32 6L28 38h8L32 6z"
        fill="#94a3b8"
        stroke="#cbd5e1"
        strokeWidth="1.5"
      />
      {/* Blood groove */}
      <path
        d="M32 10v24"
        stroke="#64748b"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Guard */}
      <path
        d="M20 38h24v4c0 1-2 3-12 3s-12-2-12-3v-4z"
        fill="#475569"
        stroke="#64748b"
        strokeWidth="1.5"
      />
      {/* Grip */}
      <rect x="28" y="44" width="8" height="10" rx="1" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      {/* Grip wrapping */}
      <path d="M28 47h8M28 50h8" stroke="#475569" strokeWidth="1" />
      {/* Pommel */}
      <circle cx="32" cy="57" r="3.5" fill="#475569" stroke="#64748b" strokeWidth="1.5" />
    </svg>
  );
}
