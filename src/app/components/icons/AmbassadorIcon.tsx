'use client';

interface IconProps {
  size?: number;
  className?: string;
}

export function AmbassadorIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Scroll body */}
      <rect x="16" y="12" width="32" height="40" rx="3" fill="#166534" stroke="#4ade80" strokeWidth="2" />
      {/* Scroll top curl */}
      <path
        d="M14 14c0-4 3-7 7-7h22c4 0 7 3 7 7"
        fill="none"
        stroke="#4ade80"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Scroll bottom curl */}
      <path
        d="M14 50c0 4 3 7 7 7h22c4 0 7-3 7-7"
        fill="none"
        stroke="#4ade80"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Text lines */}
      <path d="M22 22h20" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 28h20" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 34h14" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" />
      {/* Seal */}
      <circle cx="38" cy="44" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="38" cy="44" r="2.5" fill="#f59e0b" />
      {/* Ribbon from seal */}
      <path d="M34 48l-2 6M42 48l2 6" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
