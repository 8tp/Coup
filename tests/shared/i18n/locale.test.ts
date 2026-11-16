import { describe, expect, it } from 'vitest';
import { availableLocales, LOCALES, SHIPPED_LOCALES, type Locale } from '@/shared/i18n/locales';
import { buildLocaleTable, localeFromPath, matchNavigatorLanguages, resolveLocale } from '@/shared/i18n/matchLocale';
import { localeBootScript } from '@/shared/i18n/bootScript';

const ALL = availableLocales({ includeDev: false, includeInProgress: true });
const match = (languages: string[], candidates: readonly Locale[] = ALL) => matchNavigatorLanguages(languages, candidates);

describe('matching navigator.languages', () => {
  it('maps regional variants to the language we have', () => {
    expect(match(['pt-PT'])).toBe('pt-BR');
    expect(match(['pt'])).toBe('pt-BR');
    expect(match(['pt_BR'])).toBe('pt-BR');
    expect(match(['es-MX'])).toBe('es');
    expect(match(['es-419'])).toBe('es');
    expect(match(['ar-EG'])).toBe('ar');
    expect(match(['ar-IQ'])).toBe('ar');
    expect(match(['vi-VN'])).toBe('vi');
    expect(match(['en-GB'])).toBe('en');
  });

  it('Simplified Chinese for zh, zh-CN, zh-SG and zh-Hans-*', () => {
    for (const tag of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-HK', 'zh-hans-cn']) expect(match([tag])).toBe('zh-Hans');
  });

  it('Traditional Chinese is a weak match: another listed language wins', () => {
    expect(match(['zh-TW'])).toBe('zh-Hans');
    expect(match(['zh-HK', 'en-US'])).toBe('en');
    expect(match(['zh-Hant-TW', 'ja', 'es'])).toBe('es');
    expect(match(['zh-MO', 'fr'])).toBe('zh-Hans');
  });

  it('Hindi for hi-*, but en-IN stays English', () => {
    expect(match(['hi-IN'])).toBe('hi');
    expect(match(['hi'])).toBe('hi');
    expect(match(['en-IN', 'hi-IN'])).toBe('en');
    expect(match(['en-IN'])).toBe('en');
  });

  it('first match in preference order wins; unknown languages are skipped', () => {
    expect(match(['fr-FR', 'de', 'es-ES', 'en'])).toBe('es');
    expect(match(['fr', 'ja'])).toBeNull();
  });

  it('only matches candidates (unfinished translations are not detected)', () => {
    const ready = availableLocales({ includeDev: false, includeInProgress: false });
    expect(match(['pt-BR'], ready)).toBe(ready.includes('pt-BR') ? 'pt-BR' : null);
    expect(match(['pt-BR'], ['en'])).toBeNull();
  });

  it('never detects a pseudo-locale', () => {
    expect(match(['en-XA'], [...ALL, 'en-XA'])).toBe('en');
  });
});

describe('resolution order', () => {
  const base = { selectable: ALL, detectable: ALL };

  it('URL path, then saved choice, then browser, then English', () => {
    expect(resolveLocale({ ...base, pathname: '/es/rules', saved: 'vi', languages: ['ar'] })).toBe('es');
    expect(resolveLocale({ ...base, pathname: '/game/ABCD', saved: 'vi', languages: ['ar'] })).toBe('vi');
    expect(resolveLocale({ ...base, pathname: '/', saved: null, languages: ['ar'] })).toBe('ar');
    expect(resolveLocale({ ...base, pathname: '/', saved: null, languages: ['fr'] })).toBe('en');
  });

  it('ignores a saved choice this build does not offer', () => {
    expect(resolveLocale({ selectable: ['en'], detectable: ['en'], saved: 'en-XA', languages: [] })).toBe('en');
    expect(resolveLocale({ ...base, saved: 'klingon', languages: ['vi'] })).toBe('vi');
  });

  it('reads a locale from the first path segment only, ignoring case', () => {
    expect(localeFromPath('/pt-br/como-jogar')).toBe('pt-BR');
    expect(localeFromPath('/zh-hans')).toBe('zh-Hans');
    expect(localeFromPath('/lobby/ES')).toBeNull();
    expect(localeFromPath('/en-XA')).toBeNull();
  });
});

describe('the pre-paint script', () => {
  /** Run the inline script against a fake document and return what it set. */
  function runBoot(env: { saved?: string | null; languages: string[]; pathname?: string }) {
    const table = buildLocaleTable(ALL, ALL);
    const script = localeBootScript(table, table);
    const classes = new Set<string>();
    const html = { lang: 'en', dir: 'ltr', classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } };
    const fn = new Function('localStorage', 'navigator', 'location', 'document', 'setTimeout', script);
    fn(
      { getItem: (k: string) => (k === 'coup_locale' ? env.saved ?? null : null) },
      { languages: env.languages, language: env.languages[0] },
      { pathname: env.pathname ?? '/' },
      { documentElement: html },
      () => 0,
    );
    return { lang: html.lang, dir: html.dir, pending: classes.has('i18n-pending') };
  }

  it('agrees with resolveLocale and sets lang, dir and the pending class', () => {
    const cases = [
      { languages: ['ar-EG'] },
      { languages: ['zh-TW', 'en'] },
      { languages: ['hi-IN'] },
      { languages: ['en-IN', 'hi'] },
      { languages: ['fr'], saved: 'vi' },
      { languages: ['pt-PT'], pathname: '/es' },
      { languages: ['de'] },
    ];
    for (const env of cases) {
      const expected = resolveLocale({ selectable: ALL, detectable: ALL, ...env });
      const got = runBoot(env);
      expect(got.lang).toBe(expected);
      expect(got.dir).toBe(LOCALES[expected].dir);
      expect(got.pending).toBe(expected !== 'en');
    }
  });

  it('treats a saved "auto" as no choice', () => {
    expect(runBoot({ saved: 'auto', languages: ['es'] }).lang).toBe('es');
  });
});

describe('registry', () => {
  it('names every shipped language in itself, with Hindi as हिन्दी', () => {
    expect(SHIPPED_LOCALES).toEqual(['en', 'hi', 'pt-BR', 'es', 'ar', 'zh-Hans', 'vi']);
    expect(LOCALES.hi.nativeName).toBe('हिन्दी');
    expect(LOCALES.ar.dir).toBe('rtl');
  });
});
