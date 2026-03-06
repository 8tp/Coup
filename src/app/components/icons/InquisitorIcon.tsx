'use client';

interface IconProps {
  size?: number;
  className?: string;
}

export function InquisitorIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer eye shape */}
      <path
        d="M4 32 Q32 8 60 32 Q32 56 4 32Z"
        fill="#134e4a"
        stroke="#0d9488"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Inner eye outline */}
      <path
        d="M10 32 Q32 14 54 32 Q32 50 10 32Z"
        fill="none"
        stroke="#5eead4"
        strokeWidth="1.5"
      />
      {/* Iris */}
      <circle cx="32" cy="32" r="10" fill="#0d9488" stroke="#5eead4" strokeWidth="1">
        <animate attributeName="r" values="10;11;10" dur="3s" repeatCount="indefinite" />
      </circle>
      {/* Pupil */}
      <circle cx="32" cy="32" r="5" fill="#042f2e">
        <animate attributeName="r" values="5;4;5" dur="3s" repeatCount="indefinite" />
      </circle>
      {/* Pupil inner dot */}
      <circle cx="32" cy="32" r="2" fill="#0d9488" />
      {/* Highlight */}
      <circle cx="28.5" cy="28.5" r="2.5" fill="#5eead4" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="3s" repeatCount="indefinite" />
      </circle>
      {/* Small secondary highlight */}
      <circle cx="36" cy="35" r="1" fill="#99f6e4" opacity="0.5" />
    </svg>
  );
}
