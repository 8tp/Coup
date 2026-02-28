'use client';

interface IconProps {
  size?: number;
  className?: string;
}

export function DukeIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Crown base */}
      <path
        d="M12 44h40v6H12z"
        fill="#9b59b6"
      />
      {/* Crown body */}
      <path
        d="M12 44L8 18l12 12 12-16 12 16 12-12-4 26H12z"
        fill="#9b59b6"
        stroke="#c084fc"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Crown jewels */}
      <circle cx="20" cy="38" r="3" fill="#fbbf24" />
      <circle cx="32" cy="36" r="3.5" fill="#fbbf24" />
      <circle cx="44" cy="38" r="3" fill="#fbbf24" />
      {/* Crown tips - circles */}
      <circle cx="8" cy="18" r="3" fill="#c084fc" />
      <circle cx="20" cy="30" r="2.5" fill="#c084fc" />
      <circle cx="32" cy="14" r="3.5" fill="#c084fc" />
      <circle cx="44" cy="30" r="2.5" fill="#c084fc" />
      <circle cx="56" cy="18" r="3" fill="#c084fc" />
    </svg>
  );
}
