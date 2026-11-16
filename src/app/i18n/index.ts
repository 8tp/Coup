/**
 * Public surface of the i18n module. See docs/I18N.md.
 *
 *   const t = useT();
 *   t('log.tabLog')                              → "Log"
 *   t('glossary.term.coin', { count: 3 })        → "3 coins"
 *   t.rich('prompts.x', { name: <b>{n}</b> })    → React nodes
 *   characterName(t, Character.Duke)            → "Duke"
 */
export { useT, useLocale, makeTranslator, partsToNodes } from './react';
export type { Translator, RichParams } from './react';
export { getT, activateLocale, selectableLocales, detectableLocales, useI18nStore, IS_DEV } from './runtime';
export type { PlainTranslator } from './runtime';
export { characterName, actionName, factionName, phaseName, gameModeName, isCharacter, isActionType, isFaction } from './glossary';
export { describeServerError, describeAckError } from './serverErrors';
export type { MessageKey, Namespace, Translation, NamespaceTranslation } from './schema';
