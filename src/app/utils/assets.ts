import { Character } from '@/shared/types';

export const BRAND_BANNER_ART = '/assets/brand/coup-online-banner.png';
export const TABLE_BACKGROUND_ART = '/assets/backgrounds/game-table.webp';
export const TABLE_BACKGROUND_MOBILE_ART = '/assets/backgrounds/game-table-mobile.webp';

export const CARD_BACK_ART = '/assets/cards/back.webp';
export const CARD_BACK_FOCUS_ART = '/assets/cards/focus/back.webp';

export const CHARACTER_CARD_ART: Record<Character, string> = {
  [Character.Duke]: '/assets/cards/duke-v3.webp',
  [Character.Assassin]: '/assets/cards/assassin-v3.webp',
  [Character.Captain]: '/assets/cards/captain-v3.webp',
  [Character.Ambassador]: '/assets/cards/ambassador-v3.webp',
  [Character.Contessa]: '/assets/cards/contessa-v3.webp',
  [Character.Inquisitor]: '/assets/cards/inquisitor-v3.webp',
};

export const CHARACTER_CARD_FOCUS_ART: Record<Character, string> = {
  [Character.Duke]: '/assets/cards/focus/duke-v3.webp',
  [Character.Assassin]: '/assets/cards/focus/assassin-v3.webp',
  [Character.Captain]: '/assets/cards/focus/captain-v3.webp',
  [Character.Ambassador]: '/assets/cards/focus/ambassador-v3.webp',
  [Character.Contessa]: '/assets/cards/focus/contessa-v3.webp',
  [Character.Inquisitor]: '/assets/cards/focus/inquisitor-v3.webp',
};

export const CARD_ART_DIMENSIONS = { width: 512, height: 768 } as const;
export const BRAND_BANNER_DIMENSIONS = { width: 438, height: 180 } as const;

export const CRITICAL_PRELOAD_IMAGES = [
  BRAND_BANNER_ART,
] as const;

export const GAME_PREFETCH_IMAGES = [
  CARD_BACK_FOCUS_ART,
  ...Object.values(CHARACTER_CARD_FOCUS_ART),
] as const;
