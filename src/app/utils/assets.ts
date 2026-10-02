import { Character } from '@/shared/types';

export const BRAND_BANNER_ART = '/assets/brand/coup-wordmark-v3.webp';
export const MENU_BACKGROUND_WIDE_ART = '/assets/backgrounds/menu-chamber-wide-v1.webp';
export const MENU_BACKGROUND_TALL_ART = '/assets/backgrounds/menu-chamber-tall-v1.webp';

export const CARD_BACK_ART = '/assets/cards/back-v3.webp';
export const CARD_BACK_FOCUS_ART = '/assets/cards/focus/back-v3.webp';

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
  [Character.Ambassador]: '/assets/cards/focus/ambassador-v4.webp',
  [Character.Contessa]: '/assets/cards/focus/contessa-v4.webp',
  [Character.Inquisitor]: '/assets/cards/focus/inquisitor-v3.webp',
};

export const CARD_ART_DIMENSIONS = { width: 512, height: 768 } as const;
export const BRAND_BANNER_DIMENSIONS = { width: 960, height: 347 } as const;

export const CRITICAL_PRELOAD_IMAGES = [
  BRAND_BANNER_ART,
] as const;

export const GAME_PREFETCH_IMAGES = [
  CARD_BACK_FOCUS_ART,
  ...Object.values(CHARACTER_CARD_FOCUS_ART),
] as const;
