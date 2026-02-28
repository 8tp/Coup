import { Character } from '@/shared/types';
import { DukeIcon } from './DukeIcon';
import { AssassinIcon } from './AssassinIcon';
import { CaptainIcon } from './CaptainIcon';
import { AmbassadorIcon } from './AmbassadorIcon';
import { ContessaIcon } from './ContessaIcon';

export { DukeIcon } from './DukeIcon';
export { AssassinIcon } from './AssassinIcon';
export { CaptainIcon } from './CaptainIcon';
export { AmbassadorIcon } from './AmbassadorIcon';
export { ContessaIcon } from './ContessaIcon';
export { CardBack } from './CardBack';
export { CoinIcon } from './CoinIcon';
export { CoupLogo } from './CoupLogo';

export const CHARACTER_SVG_ICONS: Record<Character, React.ComponentType<{ size?: number; className?: string }>> = {
  [Character.Duke]: DukeIcon,
  [Character.Assassin]: AssassinIcon,
  [Character.Captain]: CaptainIcon,
  [Character.Ambassador]: AmbassadorIcon,
  [Character.Contessa]: ContessaIcon,
};
