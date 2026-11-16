/**
 * Catalog health: English parses, every locale is typed against it, and the
 * completeness report (missing / extra keys, argument or tag mismatches,
 * invalid ICU) is clean apart from missing keys, which fall back to English.
 * `npx tsx scripts/i18n-report.ts` prints the same report as a table.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ActionType, Character, Faction, GameMode, TurnPhase } from '@/shared/types';
import { compareCatalog, invalidMessages, type CatalogShape } from '@/shared/i18n/completeness';
import { LOCALES, SHIPPED_LOCALES } from '@/shared/i18n/locales';
import en from '@/app/i18n/messages/en';
import { CATALOG_LOADERS } from '@/app/i18n/registry';
import { lookupMessage, makePlainTranslator, translateIn, useI18nStore } from '@/app/i18n/runtime';
import { actionName, characterName, factionName, gameModeName, phaseName } from '@/app/i18n/glossary';

describe('the English catalog', () => {
  it('parses', () => {
    expect(invalidMessages(en as CatalogShape)).toEqual([]);
  });

  it('names every character, action, faction, mode and phase', () => {
    const t = makePlainTranslator('en');
    for (const c of Object.values(Character)) expect(characterName(t, c)).toBeTruthy();
    for (const a of Object.values(ActionType)) expect(actionName(t, a)).toBeTruthy();
    for (const f of Object.values(Faction)) expect(factionName(t, f)).toBeTruthy();
    for (const m of Object.values(GameMode)) expect(gameModeName(t, m)).toBeTruthy();
    for (const p of Object.values(TurnPhase)) expect(phaseName(t, p)).toBeTruthy();
    expect(actionName(t, ActionType.ForeignAid)).toBe('Foreign Aid');
  });
});

describe('translations', () => {
  it('every shipped language except English has a loader, and nothing else does', () => {
    expect(Object.keys(CATALOG_LOADERS).sort()).toEqual(SHIPPED_LOCALES.filter(l => l !== 'en').sort());
  });

  it('report: no extra, mismatched or invalid messages in any locale', async () => {
    const lines: string[] = [];
    for (const [code, load] of Object.entries(CATALOG_LOADERS)) {
      const report = compareCatalog(en as CatalogShape, (await load!()).default as CatalogShape);
      lines.push(`${code}: ${report.translated}/${report.total} translated, ${report.missing.length} missing (${LOCALES[code as keyof typeof LOCALES].status})`);
      expect(report.extra, code).toEqual([]);
      expect(report.mismatched, code).toEqual([]);
      expect(report.invalid, code).toEqual([]);
    }
    console.info(`i18n catalog status\n  ${lines.join('\n  ')}`);
  });

  it('the report catches missing, extra, mismatched and invalid entries', () => {
    const source = { log: { a: 'Hi {name}', b: 'Bye', c: '<b>{n}</b>' } };
    const report = compareCatalog(source, { log: { a: 'Olá {nome}', c: '{n', z: 'extra' } } as CatalogShape);
    expect(report.missing).toEqual(['log.b']);
    expect(report.extra).toEqual(['log.z']);
    expect(report.mismatched.map(m => m.key)).toEqual(['log.a']);
    expect(report.invalid.map(m => m.key)).toEqual(['log.c']);
  });
});

describe('runtime lookup and fallback', () => {
  afterEach(() => useI18nStore.setState({ catalogs: {} }));

  it('uses the translation when present and English when not', () => {
    useI18nStore.setState({ catalogs: { es: { log: { tabLog: 'Registro', latest: '' } } } });
    expect(translateIn('es', 'log.tabLog')).toBe('Registro');
    expect(translateIn('es', 'log.tabChat')).toBe('Chat');
    // An empty translation counts as missing.
    expect(translateIn('es', 'log.latest')).toBe('Latest');
    expect(lookupMessage('es', 'log.tabLog')).toBe('Registro');
  });

  it('formats plurals with the locale rules even when falling back', () => {
    useI18nStore.setState({ catalogs: { ar: { glossary: { 'term.coin': '{count, plural, zero {لا عملات} one {عملة} two {عملتان} few {# عملات} many {# عملة} other {# عملة}}' } } } });
    expect(translateIn('ar', 'glossary.term.coin', { count: 2 })).toBe('عملتان');
    expect(translateIn('ar', 'glossary.term.coin', { count: 5 })).toBe('5 عملات');
    expect(translateIn('vi', 'glossary.term.coin', { count: 1 })).toBe('1 coin');
  });

  it('marks every pseudo-locale string', () => {
    expect(translateIn('en-XA', 'log.tabLog')).toBe('⟦Ļööĝ⟧');
    expect(translateIn('ar-XB', 'log.tabLog')).toBe('⟦\u2067\u202eLog\u202c\u2069⟧');
  });
});
