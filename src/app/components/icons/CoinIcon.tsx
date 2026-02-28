'use client';

interface CoinIconProps {
  size?: number;
  className?: string;
}

export function CoinIcon({ size = 16, className }: CoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" r="26" fill="#fbbf24" stroke="#f59e0b" strokeWidth="3" />
      <circle cx="32" cy="32" r="18" fill="none" stroke="#f59e0b" strokeWidth="2" />
      <text x="32" y="38" textAnchor="middle" fill="#92400e" fontSize="22" fontWeight="bold" fontFamily="serif">$</text>
    </svg>
  );
}
