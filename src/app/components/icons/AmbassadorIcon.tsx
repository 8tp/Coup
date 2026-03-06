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
      {/* Text lines — sequential writing shimmer */}
      <path d="M22 22h20" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" begin="0s" repeatCount="indefinite" />
      </path>
      <path d="M22 28h20" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" begin="0.6s" repeatCount="indefinite" />
      </path>
      <path d="M22 34h14" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" begin="1.2s" repeatCount="indefinite" />
      </path>
      {/* Seal — slow spin + glow */}
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 38 44"
          to="360 38 44"
          dur="12s"
          repeatCount="indefinite"
        />
        <circle cx="38" cy="44" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5">
          <animate attributeName="opacity" values="1;0.7;1" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="38" cy="44" r="2.5" fill="#f59e0b" />
      </g>
      {/* Ribbon from seal — gentle sway */}
      <path d="M34 48l-2 6" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-3 34 48;3 34 48;-3 34 48"
          dur="4s"
          repeatCount="indefinite"
        />
      </path>
      <path d="M42 48l2 6" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="3 42 48;-3 42 48;3 42 48"
          dur="4s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
