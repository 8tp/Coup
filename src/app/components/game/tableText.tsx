import type { ReactNode } from 'react';
import { LOCALES } from '@/shared/i18n/locales';
import { formatListToParts } from '@/shared/i18n/messageFormat';
import { REACTIONS, isQuickPhraseId, isReactionId } from '@/shared/constants';
import type { ChatMessage, Refusal } from '@/shared/types';
import type { PlainTranslator, Translator } from '../../i18n';

/**
 * Small text helpers shared by the table's components (docs/I18N.md).
 *
 * Player names are typed by players in any script, so inside a sentence each
 * one is isolated in a <bdi>: an Arabic name in an English line, or a Latin
 * name in an Arabic one, keeps its own direction and does not reorder the
 * words around it.
 */
export function playerName(name: string | null | undefined): ReactNode {
  return <bdi>{name ?? ''}</bdi>;
}

/** "Ana", "Ana and Ben", "Ana, Ben, and Cy" in the reader's language, each name isolated. */
export function nameList(t: Translator, names: readonly string[]): ReactNode {
  return t.list(names.map((name, i) => <bdi key={i}>{name}</bdi>));
}

/** A list as a plain string ("Captain or Ambassador"), for aria-labels and titles. */
export function plainList(t: PlainTranslator, items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  return formatListToParts([...items], LOCALES[t.locale].intl, type).map(p => (typeof p === 'string' ? p : '')).join('');
}

/** The sentence for a refusal from the ActionBar (`game.refusal.*`). */
export function refusalText(t: PlainTranslator, refusal: Refusal): string {
  return t(`game.refusal.${refusal.key}`, refusal.params);
}

/**
 * A chat line's text in the reader's language. Typed chat is shown as typed;
 * a reaction or a quick phrase carries an id and is rendered from the
 * catalog. An id this client does not know (a newer server) falls back to
 * the server's English `message`.
 */
export function chatText(t: PlainTranslator, msg: ChatMessage): string {
  if (msg.reactionId && isReactionId(msg.reactionId)) {
    const reaction = REACTIONS.find(r => r.id === msg.reactionId);
    if (reaction) return t('game.reactionLine', { emoji: reaction.emoji, label: t(`game.reaction.${reaction.id}`) });
  }
  if (msg.phraseId && isQuickPhraseId(msg.phraseId)) return t(`game.phrase.${msg.phraseId}`);
  return msg.message;
}
