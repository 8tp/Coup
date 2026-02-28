'use client';

interface IconProps {
  size?: number;
  className?: string;
}

export function CardBack({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background pattern */}
      <rect x="4" y="4" width="56" height="56" rx="4" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.5" />
      {/* Inner frame */}
      <rect x="10" y="10" width="44" height="44" rx="2" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />
      {/* Diagonal pattern lines */}
      <path d="M10 10l44 44" stroke="#fbbf24" strokeWidth="0.5" opacity="0.3" />
      <path d="M54 10L10 54" stroke="#fbbf24" strokeWidth="0.5" opacity="0.3" />
      <path d="M32 10v44" stroke="#fbbf24" strokeWidth="0.5" opacity="0.3" />
      <path d="M10 32h44" stroke="#fbbf24" strokeWidth="0.5" opacity="0.3" />
      {/* Center diamond */}
      <path d="M32 18l10 14-10 14-10-14z" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
      {/* Inner diamond */}
      <path d="M32 24l5 8-5 8-5-8z" fill="#fbbf24" opacity="0.3" />
      {/* Question mark */}
      <text
        x="32"
        y="36"
        textAnchor="middle"
        fill="#fbbf24"
        fontSize="14"
        fontWeight="bold"
        fontFamily="serif"
      >
        ?
      </text>
    </svg>
  );
}
