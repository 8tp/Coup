'use client';

interface CoupLogoProps {
  className?: string;
}

export function CoupLogo({ className }: CoupLogoProps) {
  return (
    <img
      src="/assets/brand/coup-online-banner.png"
      alt="Coup Online"
      className={className}
      width={438}
      height={180}
      draggable={false}
    />
  );
}
