'use client';

interface IconProps {
  size?: number;
  className?: string;
}

export function CaptainIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield body */}
      <path
        d="M32 6L8 16v18c0 14 10 20 24 26 14-6 24-12 24-26V16L32 6z"
        fill="#2563eb"
        stroke="#60a5fa"
        strokeWidth="2.5"
        strokeLinejoin="round"
      >
        <animate attributeName="stroke-opacity" values="1;0.5;1" dur="3s" repeatCount="indefinite" />
      </path>
      {/* Shield inner border */}
      <path
        d="M32 11L13 19v14c0 11.5 8 16.5 19 21.5 11-5 19-10 19-21.5V19L32 11z"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
      />
      {/* Anchor vertical bar */}
      <path
        d="M32 22v20"
        stroke="#dbeafe"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Anchor ring — slow spin */}
      <circle cx="32" cy="22" r="4" fill="none" stroke="#dbeafe" strokeWidth="2.5">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 32 22"
          to="360 32 22"
          dur="8s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Anchor arms */}
      <path
        d="M22 38c0-4 4.5-6 10-6s10 2 10 6"
        fill="none"
        stroke="#dbeafe"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Anchor flukes */}
      <path d="M22 38l-3-4" stroke="#dbeafe" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M42 38l3-4" stroke="#dbeafe" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
