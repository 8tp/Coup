'use client';

import { useMemo, type ReactNode } from 'react';
import type { LogEntry, LogEventType } from '@/shared/types';
import type { Character } from '@/shared/types';
import { logParamKind } from '@/shared/i18n/logMessages';
import { selectable, type Part } from '@/shared/i18n/messageFormat';
import { useT, type Translator } from '../../i18n/react';
import { actionName, characterName, factionName, isActionType, isCharacter, isFaction } from '../../i18n/glossary';
import type { MessageKey } from '../../i18n/schema';
import { CHARACTER_GLYPHS } from '../icons';
import { characterGlyphVars } from '../../utils/characterPalette';
import { LOG_EVENT_GLYPHS } from '../../utils/logGlyphs';
import { formatLogMessage } from '../../utils/logFormat';
import { useGameStore } from '../../stores/gameStore';

/**
 * One action-log line, rendered from the entry's structured `msg` through the
 * reader's `log` catalog (docs/I18N.md). Shared by the drawer (ActionLog),
 * the drawer's "Latest" row and the desktop ticker so the three never drift.
 *
 * What makes a line scannable, without reading it (ART-DIRECTION §1.2: state
 * is a material, characters own colour):
 *
 *   - a 16px stamp in the gutter whose MATERIAL says the kind of event:
 *     hazard stripes for a challenge or a lost card, an ink slab for a block,
 *     brass for coins and the win, bare for claims and turn markers;
 *   - the claimed, blocked, revealed or lost character inline as its emblem
 *     in its own hue, followed by its name;
 *   - coin amounts set as figures.
 */
export type LogKind = 'turn' | 'claim' | 'challenge' | 'block' | 'coins' | 'loss' | 'out' | 'win' | 'info';

const KIND_BY_EVENT: Record<LogEventType, LogKind> = {
  game_start: 'turn',
  turn_start: 'turn',
  income: 'coins',
  coup: 'loss',
  claim_action: 'claim',
  declare_action: 'claim',
  challenge: 'challenge',
  challenge_fail: 'challenge',
  challenge_success: 'challenge',
  block: 'block',
  block_challenge: 'challenge',
  block_challenge_fail: 'challenge',
  block_challenge_success: 'challenge',
  block_unchallenged: 'block',
  influence_loss: 'loss',
  exchange: 'claim',
  exchange_draw: 'claim',
  action_resolve: 'coins',
  assassination: 'loss',
  elimination: 'out',
  win: 'win',
  bot_replace: 'info',
  convert: 'coins',
  embezzle: 'coins',
  examine: 'claim',
  examine_decision: 'claim',
  faction_change: 'claim',
};

export function logKind(entry: LogEntry): LogKind {
  return KIND_BY_EVENT[entry.eventType] ?? 'info';
}

export interface LogContext {
  t: Translator;
  /** The reader's player id; their own lines read "You ..." */
  myId: string | null;
  names: ReadonlyMap<string, string>;
  myName: string;
}

/**
 * Who is reading and how to name players. Defaults to the live game's
 * players; pass `players` to render a log outside the table.
 */
export function useLogContext(players?: ReadonlyArray<{ id: string; name: string }>): LogContext {
  const t = useT();
  const myId = useGameStore(s => s.gameState?.myId ?? s.playerId);
  const storePlayers = useGameStore(s => s.gameState?.players);
  const list = players ?? storePlayers;
  const names = useMemo(() => new Map((list ?? []).map(p => [p.id, p.name])), [list]);
  return { t, myId, names, myName: (myId && names.get(myId)) || '' };
}

/** A character inside a log line: its emblem in its hue, then its name. */
export function LogCharacter({ character, t }: { character: Character; t: Translator }) {
  const Glyph = CHARACTER_GLYPHS[character];
  return (
    <span className="log-char" style={characterGlyphVars(character)}>
      <Glyph size={13} className="log-char-glyph" />
      <span className="log-char-name">{characterName(t, character)}</span>
    </span>
  );
}

const renderNumber = (formatted: string): Part => ({ rich: <span className="log-figure">{formatted}</span> });

/** Turn an entry's (or explanation's) params into catalog params for the reader. */
export function logParams(params: Readonly<Record<string, unknown>>, ctx: LogContext, entry?: LogEntry): Record<string, unknown> {
  const { t } = ctx;
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params)) {
    switch (logParamKind(name)) {
      case 'player': {
        const id = typeof value === 'string' ? value : null;
        if (id && id === ctx.myId) {
          out[name] = selectable(<span className="log-you">{t('log.you')}</span>, 'you');
        } else {
          const playerName = (id && ctx.names.get(id))
            || (id && entry && id === entry.actorId && entry.actorName)
            || t('log.unknownPlayer');
          // <bdi> isolates a name typed in one script inside a sentence in another.
          out[name] = selectable(<bdi className="log-name">{playerName}</bdi>, 'other');
        }
        break;
      }
      case 'character':
        out[name] = isCharacter(value) ? <LogCharacter character={value} t={t} /> : value;
        break;
      case 'action':
        out[name] = isActionType(value) ? actionName(t, value) : value;
        break;
      case 'faction':
        out[name] = isFaction(value) ? factionName(t, value) : value;
        break;
      default:
        out[name] = value;
    }
  }
  return out;
}

/** The text of a log line in the reader's language. */
export function renderLogText(entry: LogEntry, ctx: LogContext): ReactNode {
  if (entry.msg) {
    return ctx.t.rich(`log.${entry.msg.key}` as MessageKey, logParams(entry.msg.params, ctx, entry), { renderNumber });
  }
  // An entry from a server that predates structured lines: its English text.
  return formatLogMessage(entry.message, ctx.myName);
}

export function renderLogKey(key: MessageKey, params: Readonly<Record<string, unknown>> | undefined, ctx: LogContext): ReactNode {
  return ctx.t.rich(key, logParams(params ?? {}, ctx), { renderNumber });
}

/** The gutter stamp: the event's glyph on the material of its kind. */
export function LogStamp({ entry, size = 12 }: { entry: LogEntry; size?: number }) {
  const Glyph = LOG_EVENT_GLYPHS[entry.eventType];
  return (
    <span className="log-stamp" data-kind={logKind(entry)} aria-hidden="true">
      {Glyph && <Glyph size={size} />}
    </span>
  );
}
