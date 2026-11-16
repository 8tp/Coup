import type en from './messages/en';

/**
 * Types derived from the English catalog, the source of truth.
 *
 * A key is `namespace.key`, for example `log.turnStart` or
 * `glossary.character.Duke`. A misspelt or missing key is a compile error
 * wherever `t()` is called. Other locales are `Translation`s: every key is
 * optional (missing ones fall back to English at runtime and are listed by
 * `npx tsx scripts/i18n-report.ts`), and a key English does not have is a
 * compile error.
 */
export type Messages = typeof en;
export type Namespace = keyof Messages;

export type MessageKey = {
  [N in Namespace]: `${N}.${Extract<keyof Messages[N], string>}`;
}[Namespace];

/** Keys of one namespace, without the prefix. */
export type NamespaceKey<N extends Namespace> = Extract<keyof Messages[N], string>;

export type NamespaceTranslation<N extends Namespace> = { [K in NamespaceKey<N>]?: string };

export type Translation = { [N in Namespace]?: NamespaceTranslation<N> };
