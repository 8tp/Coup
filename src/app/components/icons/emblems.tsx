/**
 * The six character emblems — the one source of truth for each character's mark.
 *
 * Drawn 2026-10-01 to replace the abstract silhouettes (stepped line, wedge,
 * bracket, pentagon) that did not name what they stood for. Each emblem is a
 * filled screen-print silhouette on the 64x64 grid with even-odd cut-outs, so
 * it inherits `currentColor` and needs no ids. Rendered small by the
 * `*Glyph` components and large inside a medallion by `CharacterMedallion`.
 */
import type { ReactNode } from 'react';
import { Character } from '@/shared/types';

export const CHARACTER_EMBLEMS: Record<Character, ReactNode> = {
  /* Duke — a fleur-de-lis. Nobility without a crown: the crown is reserved for the winner (ART-DIRECTION §1.2), and a fleur shares no silhouette with it at any size. */
  [Character.Duke]: (
    <>
      <path d="M32 3 C39 11 42 19 39 28 C38 31 36.5 34 35.5 37 H28.5 C27.5 34 26 31 25 28 C22 19 25 11 32 3 Z"/>
      <path d="M27 37 C24 31 18 28 12 29 C6 30 3 25 5 20 C7 16 12 15 15 18 C12 18 10 21 12 23 C14 25 18 24 22 26 C26 28 28 32 29.5 37 Z"/>
      <path d="M37 37 C40 31 46 28 52 29 C58 30 61 25 59 20 C57 16 52 15 49 18 C52 18 54 21 52 23 C50 25 46 24 42 26 C38 28 36 32 34.5 37 Z"/>
      <rect x="19" y="38" width="26" height="6" rx="1"/>
      <path d="M29.5 45 H34.5 L33 56 L32 61 L31 56 Z"/>
      <path d="M28 45 C24 47 20 51 21 57 C25 56 27 52 28.5 48 Z"/>
      <path d="M36 45 C40 47 44 51 43 57 C39 56 37 52 35.5 48 Z"/>
    </>
  ),
  /* Assassin — a stiletto, point down and canted 38°. Upright it read as a cross at 16px; the cant is what makes it a blade. */
  [Character.Assassin]: (
    <>
      <g transform="rotate(-38 32 32)">
      <circle cx="32" cy="5.5" r="4.5"/>
      <path fillRule="evenodd" d="M28 9.5 H36 V21 H28 Z M28 12.5 H36 V14 H28 Z M28 16.5 H36 V18 H28 Z"/>
      <path d="M15 20 C20 22 44 22 49 20 L47 27 C42 25.5 22 25.5 17 27 Z"/>
      <path fillRule="evenodd" d="M25.5 26 H38.5 L37 46 L32 62 L27 46 Z M31 29 H33 V46 L32 50 L31 46 Z"/>
      </g>
    </>
  ),
  /* Captain — an anchor. Ring, stock and flukes survive at 16px as a single recognisable outline. */
  [Character.Captain]: (
    <>
      <path fillRule="evenodd" d="M32 2.5 a6.5 6.5 0 1 0 0.01 0 Z M32 6 a3 3 0 1 1 -0.01 0 Z"/>
      <rect x="29.5" y="14" width="5" height="43"/>
      <rect x="18" y="19" width="28" height="5"/>
      <circle cx="18" cy="21.5" r="3.2"/><circle cx="46" cy="21.5" r="3.2"/>
      <path d="M9 37 C10 50 20 58 32 58.5 C44 58 54 50 55 37 L50.5 37 C49.5 47 42 53.5 32 54 C22 53.5 14.5 47 13.5 37 Z"/>
      <path d="M4 41 L11 31 L17 41 Z"/>
      <path d="M60 41 L53 31 L47 41 Z"/>
    </>
  ),
  /* Ambassador — sealed diplomatic credentials: a scroll with two rolled ends and a hanging wax seal. */
  [Character.Ambassador]: (
    <>
      <path fillRule="evenodd" d="M16 6 H46 C49.5 6 51.5 8.5 51.5 11.5 C51.5 14.5 49.5 16.5 47 16.5 V46 H17 V16.5 C14 16.5 12.5 14.5 12.5 11.5 C12.5 8.5 14 6 16 6 Z M22.5 22 H41.5 V25 H22.5 Z M22.5 28.5 H41.5 V31.5 H22.5 Z M22.5 35 H34 V38 H22.5 Z"/>
      <path d="M17 47.5 H47 C50 47.5 52 49.5 52 52.5 C52 55.5 50 57.5 47 57.5 H17 C14 57.5 12 55.5 12 52.5 C12 49.5 14 47.5 17 47.5 Z"/>
      <path d="M39 50 L35.5 63 L39.5 61 L41.5 64 L44 52 Z M49 50 L52.5 63 L48.5 61 L46.5 64 L44 52 Z"/>
      <path fillRule="evenodd" d="M44 38 a8.5 8.5 0 1 0 0.01 0 Z M44 42.5 a4 4 0 1 1 -0.01 0 Z"/>
    </>
  ),
  /* Contessa — a folding fan with a scalloped edge and a pivot rivet. The fan is the courtly object that turns a blade aside. */
  [Character.Contessa]: (
    <>
      <path fillRule="evenodd" d="M21.43 46.97 L-4.53 39.53 Q-4.67 31.66 1.71 27.06 Q4.41 19.67 12.02 17.67 Q17.21 11.76 25.03 12.64 Q32.00 9.00 38.97 12.64 Q46.79 11.76 51.98 17.67 Q59.59 19.67 62.29 27.06 Q68.67 31.66 68.53 39.53 L42.57 46.97 A11 11 0 0 0 21.43 46.97 Z M19.90 41.13 L7.80 32.26 L8.37 31.51 L20.19 40.76 Z M23.92 37.37 L15.83 24.73 L16.63 24.24 L24.32 37.12 Z M29.02 35.30 L26.03 20.60 L26.96 20.43 L29.48 35.21 Z M34.52 35.21 L37.04 20.43 L37.97 20.60 L34.98 35.30 Z M39.68 37.12 L47.37 24.24 L48.17 24.73 L40.08 37.37 Z M43.81 40.76 L55.63 31.51 L56.20 32.26 L44.10 41.13 Z"/>
      <path fillRule="evenodd" d="M32 44 a6 6 0 1 0 0.01 0 Z M32 47.5 a2.5 2.5 0 1 1 -0.01 0 Z"/>
    </>
  ),
  /* Inquisitor — a radiant eye: the gaze that examines a card and the rays that say it is being watched. */
  [Character.Inquisitor]: (
    <>
      <path fillRule="evenodd" d="M3 40 C13 24 51 24 61 40 C51 56 13 56 3 40 Z M9 40 C18 30 46 30 55 40 C46 50 18 50 9 40 Z"/>
      <path fillRule="evenodd" d="M32 30 a10 10 0 1 0 0.01 0 Z M32 36 a4 4 0 1 1 -0.01 0 Z"/>
      <path d="M15.69 28.39 L8.62 22.50 L17.26 25.68 Z"/><path d="M21.68 21.26 L18.50 12.62 L24.39 19.69 Z"/><path d="M30.43 18.07 L32.00 9.00 L33.57 18.07 Z"/><path d="M39.61 19.69 L45.50 12.62 L42.32 21.26 Z"/><path d="M46.74 25.68 L55.38 22.50 L48.31 28.39 Z"/>
    </>
  ),
};
