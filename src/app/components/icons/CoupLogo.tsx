'use client';

import { BRAND_BANNER_ART, BRAND_BANNER_DIMENSIONS } from '../../utils/assets';

interface CoupLogoProps {
  className?: string;
}

export function CoupLogo({ className }: CoupLogoProps) {
  return (
    <img
      src={BRAND_BANNER_ART}
      alt="Coup Online"
      className={className}
      width={BRAND_BANNER_DIMENSIONS.width}
      height={BRAND_BANNER_DIMENSIONS.height}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      draggable={false}
    />
  );
}
