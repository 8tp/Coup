import type { ServerErrorCode, ServerErrorParams } from '@/shared/i18n/serverErrors';
import { actionName, characterName, isActionType, isCharacter } from './glossary';
import { getT, hasMessage, type PlainTranslator } from './runtime';

export interface ServerErrorLike {
  /** The server's English text (`message` on events, `error` on acks). */
  message?: string | null;
  code?: ServerErrorCode | null;
  params?: ServerErrorParams | null;
}

/**
 * A server error in the reader's language: by `code` through the `errors`
 * catalog when the server sent one we know, otherwise the server's English.
 * Character and action params render through the glossary.
 */
export function describeServerError(error: ServerErrorLike, t: PlainTranslator = getT()): string {
  const { code, params, message } = error;
  if (code && code !== 'unknown' && hasMessage(`errors.${code}`)) {
    const named: Record<string, unknown> = { ...(params ?? {}) };
    if (isCharacter(named.character)) named.character = characterName(t, named.character);
    if (isActionType(named.action)) named.action = actionName(t, named.action);
    const text = t(`errors.${code}`, named);
    if (text) return text;
  }
  return message ?? '';
}

/** The same for an acknowledgement (`{ error, errorCode, errorParams }`). */
export function describeAckError(ack: { error?: string; errorCode?: ServerErrorCode; errorParams?: ServerErrorParams }, fallback: string): string {
  return describeServerError({ message: ack.error ?? fallback, code: ack.errorCode, params: ack.errorParams }) || fallback;
}
