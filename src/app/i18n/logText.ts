import type { LogEntry } from '@/shared/types';
import { logParamKind } from '@/shared/i18n/logMessages';
import { selectable } from '@/shared/i18n/messageFormat';
import { actionName, characterName, factionName, isActionType, isCharacter, isFaction } from './glossary';
import type { PlainTranslator } from './runtime';
import type { MessageKey } from './schema';

/**
 * A log line as plain text in a translator's language: for aria labels,
 * copied logs and tests. The on-screen log renders the same params as rich
 * nodes (components/game/LogLine.tsx).
 */
export function logLinePlain(
  entry: LogEntry,
  t: PlainTranslator,
  names: ReadonlyMap<string, string>,
  myId: string | null = null,
): string {
  if (!entry.msg) return entry.message;
  const params: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(entry.msg.params)) {
    switch (logParamKind(name)) {
      case 'player': {
        const id = String(value);
        params[name] = id === myId
          ? selectable(t('log.you'), 'you')
          : selectable(names.get(id) || (id === entry.actorId ? entry.actorName : null) || t('log.unknownPlayer'), 'other');
        break;
      }
      case 'character': params[name] = isCharacter(value) ? characterName(t, value) : value; break;
      case 'action': params[name] = isActionType(value) ? actionName(t, value) : value; break;
      case 'faction': params[name] = isFaction(value) ? factionName(t, value) : value; break;
      default: params[name] = value;
    }
  }
  return t(`log.${entry.msg.key}` as MessageKey, params);
}
