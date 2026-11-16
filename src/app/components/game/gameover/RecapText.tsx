'use client';

import { useCallback, type ReactNode } from 'react';
import { useT, type Translator } from '../../../i18n/react';
import { recapKey, recapParams, type Reader, type RecapMessage } from './summary';

/**
 * A game-over message as React nodes in the reader's language: player names
 * isolated in `<bdi>` (a name in one script inside a sentence in another),
 * the reader as "you", and `<who>` (the player in an award line) drawn in ink.
 */
export function renderRecap(message: RecapMessage, t: Translator, reader: Reader): ReactNode {
  return t.rich(recapKey(message), {
    ...recapParams<ReactNode>(message.params, t, reader, name => <bdi>{name}</bdi>, word => word),
    who: (chunks: ReactNode) => <span className="text-coup-ink">{chunks}</span>,
  });
}

/** `renderRecap` bound to the current translator, for one reader. */
export function useRecapText(reader: Reader): (message: RecapMessage) => ReactNode {
  const t = useT();
  return useCallback((message: RecapMessage) => renderRecap(message, t, reader), [t, reader]);
}
