import type { LogEntry } from '@/shared/types';
import type { MessageKey } from '../i18n/schema';

/**
 * The practice-mode "Explain" line for a log entry, as a catalog key and
 * params (rendered by ActionLog through the `log` namespace). Player params
 * are ids, like the log line's own params.
 */
export interface LogExplanation {
  key: MessageKey;
  params?: Record<string, unknown>;
}

export function getLogExplanation(entry: LogEntry): LogExplanation | null {
  switch (entry.eventType) {
    case 'game_start':
    case 'turn_start':
    case 'income':
    case 'declare_action':
    case 'challenge':
    case 'challenge_fail':
    case 'challenge_success':
    case 'block':
    case 'block_unchallenged':
    case 'block_challenge_fail':
    case 'block_challenge_success':
    case 'coup':
    case 'assassination':
    case 'influence_loss':
    case 'exchange':
    case 'elimination':
    case 'win':
    case 'bot_replace':
    case 'convert':
    case 'faction_change':
    case 'embezzle':
    case 'examine':
    case 'examine_decision':
      return { key: `log.explain.${entry.eventType}` };
    case 'block_challenge':
      return { key: 'log.explain.challenge' };
    case 'exchange_draw':
      return { key: 'log.explain.exchange' };
    case 'claim_action': {
      if (entry.msg?.key === 'embezzleClaim') return { key: 'log.explain.embezzle' };
      const action = entry.msg && 'action' in entry.msg.params ? entry.msg.params.action : undefined;
      if (!entry.character) return null;
      return action
        ? { key: 'log.explain.claim_action', params: { actor: entry.actorId, character: entry.character, action } }
        : { key: 'log.explain.claim_action_plain', params: { actor: entry.actorId, character: entry.character } };
    }
    case 'action_resolve':
      return entry.character
        ? { key: 'log.explain.action_resolve', params: { actor: entry.actorId, character: entry.character } }
        : { key: 'log.explain.action_resolve_plain' };
    default:
      return entry.targetId ? { key: 'log.explain.targeted' } : null;
  }
}
