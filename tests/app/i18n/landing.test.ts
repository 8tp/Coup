/**
 * The localized landing pages (docs/I18N.md, "Landing pages and search"):
 * routes come from the registry, every page has its own metadata, the
 * hreflang set is complete and reciprocal on every page and in the sitemap,
 * robots keeps crawlers out of rooms, and an unknown locale is a 404.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCALES, landingLocaleFromPath, landingLocales, landingPath, landingRedirect, localeForSlug, localeSlug, isLandingPath, type Locale } from '@/shared/i18n/locales';
import { hreflangProblems, parseSitemap } from '../../../scripts/check-seo';

const ORIGIN = 'https://coup.8tp.dev';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** Fresh copies of the landing modules, optionally with some languages marked ready first. */
async function loadLanding(opts: { ready?: Locale[]; env?: string; baseUrl?: string } = {}) {
  vi.resetModules();
  if (opts.env) vi.stubEnv('NODE_ENV', opts.env);
  if (opts.baseUrl !== undefined) vi.stubEnv('NEXT_PUBLIC_BASE_URL', opts.baseUrl);
  const registry = await import('@/shared/i18n/locales');
  const saved = new Map<Locale, string>();
  for (const l of opts.ready ?? []) {
    saved.set(l, registry.LOCALES[l].status);
    (registry.LOCALES[l] as { status: string }).status = 'ready';
  }
  const landing = await import('@/app/i18n/landing');
  const params = await import('@/app/[locale]/localeParam');
  const robots = (await import('@/app/robots')).default;
  const restore = () => { for (const [l, s] of saved) (registry.LOCALES[l] as { status: string }).status = s; };
  return { landing, params, robots, restore };
}

describe('routes from the registry', () => {
  it('a landing page per ready language, never English, unfinished ones or (in production) pseudo-locales', () => {
    const ready = (Object.keys(LOCALES) as Locale[]).filter(l => LOCALES[l].status === 'ready' && !LOCALES[l].dev && l !== 'en');
    expect(landingLocales({ includeDev: false })).toEqual(ready);
    expect(landingLocales({ includeDev: true })).toEqual([...ready, 'en-XA', 'ar-XB']);
    expect(landingLocales({ includeDev: true })).not.toContain('en');
  });

  it('paths are the lower-case registry code; English is /', () => {
    expect(localeSlug('pt-BR')).toBe('pt-br');
    expect(localeSlug('zh-Hans')).toBe('zh-hans');
    expect(landingPath('en')).toBe('/');
    expect(landingPath('pt-BR')).toBe('/pt-br');
    expect(localeForSlug('pt-br', ['pt-BR'])).toBe('pt-BR');
    expect(localeForSlug('pt-BR', ['pt-BR'])).toBeNull();
    expect(landingLocaleFromPath('/zh-hans', ['zh-Hans'])).toBe('zh-Hans');
    expect(landingLocaleFromPath('/zh-hans/', ['zh-Hans'])).toBe('zh-Hans');
    expect(landingLocaleFromPath('/lobby/ABCD', ['zh-Hans'])).toBeNull();
    expect(landingLocaleFromPath('/es', ['zh-Hans'])).toBeNull();
    expect(isLandingPath('/', [])).toBe(true);
    expect(isLandingPath('/game/ABCD', ['es'])).toBe(false);
  });

  it('development routes the pseudo-locales; a production build routes only ready languages', async () => {
    const dev = await loadLanding({ env: 'development' });
    expect(dev.params.landingParams()).toEqual(expect.arrayContaining([{ locale: 'en-xa' }, { locale: 'ar-xb' }]));
    const prod = await loadLanding({ env: 'production' });
    expect(prod.params.landingParams()).toEqual(landingLocales({ includeDev: false }).map(l => ({ locale: localeSlug(l) })));
  });

  it('a language that becomes ready gets its route, sitemap entry and hreflang with no other change', async () => {
    const { landing, params, restore } = await loadLanding({ env: 'production', ready: ['pt-BR', 'zh-Hans'] });
    try {
      expect(params.landingParams()).toEqual(expect.arrayContaining([{ locale: 'pt-br' }, { locale: 'zh-hans' }]));
      const sitemap = landing.landingSitemap();
      expect(sitemap.map(e => e.url)).toEqual(expect.arrayContaining([ORIGIN, `${ORIGIN}/pt-br`, `${ORIGIN}/zh-hans`]));
      for (const entry of sitemap) {
        expect(entry.alternates?.languages).toMatchObject({ en: ORIGIN, 'pt-BR': `${ORIGIN}/pt-br`, 'zh-Hans': `${ORIGIN}/zh-hans`, 'x-default': ORIGIN });
      }
      const meta = landing.landingMetadata('pt-BR', undefined);
      expect(meta.alternates?.canonical).toBe(`${ORIGIN}/pt-br`);
      expect(meta.alternates?.languages).toMatchObject({ 'pt-BR': `${ORIGIN}/pt-br`, 'zh-Hans': `${ORIGIN}/zh-hans` });
    } finally {
      restore();
    }
  });
});

describe('unknown locales and duplicates', () => {
  const digest = (fn: () => unknown): string => {
    try { fn(); } catch (e) { return String((e as { digest?: string }).digest); }
    return 'returned';
  };

  it('an unknown locale is a 404; another spelling of a real one redirects permanently to the one URL', async () => {
    const { params } = await loadLanding({ env: 'development' });
    expect(params.landingLocaleOrNotFound('en-xa')).toBe('en-XA');
    expect(digest(() => params.landingLocaleOrNotFound('fr'))).toMatch(/^NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(digest(() => params.landingLocaleOrNotFound('pt-br'))).toMatch(/^NEXT_HTTP_ERROR_FALLBACK;404/); // in progress: no page yet
    expect(digest(() => params.landingLocaleOrNotFound('lobby'))).toMatch(/^NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(digest(() => params.landingLocaleOrNotFound('en-XA'))).toMatch(/^NEXT_REDIRECT;replace;\/en-xa;308;/);
    expect(digest(() => params.landingLocaleOrNotFound('EN-XA'))).toMatch(/^NEXT_REDIRECT;replace;\/en-xa;308;/);
    expect(digest(() => params.landingLocaleOrNotFound('en'))).toMatch(/^NEXT_REDIRECT;replace;\/;308;/);
  });

  it('server.ts redirects other spellings before Next.js sees them', () => {
    const c: Locale[] = ['pt-BR', 'zh-Hans'];
    expect(landingRedirect('/PT-BR', c)).toBe('/pt-br');
    expect(landingRedirect('/pt-BR/', c)).toBe('/pt-br');
    expect(landingRedirect('/zh-Hans', c)).toBe('/zh-hans');
    expect(landingRedirect('/en', c)).toBe('/');
    expect(landingRedirect('/EN/', c)).toBe('/');
    expect(landingRedirect('/pt-br', c)).toBeNull();
    expect(landingRedirect('/pt-br/', c)).toBeNull(); // Next.js drops the slash itself
    expect(landingRedirect('/ES', c)).toBeNull(); // not a landing page here: a 404
    expect(landingRedirect('/lobby/ABCD', c)).toBeNull();
    expect(landingRedirect('/', c)).toBeNull();
    expect(landingRedirect('/%E0%A4', c)).toBeNull();
  });

  it('pseudo-locales are a 404 in production', async () => {
    const { params } = await loadLanding({ env: 'production' });
    expect(digest(() => params.landingLocaleOrNotFound('en-xa'))).toMatch(/^NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});

describe('metadata per locale', () => {
  it('English at / and each landing page: own title, description, canonical, Open Graph locale, full hreflang set', async () => {
    const { landing } = await loadLanding({ env: 'development' });
    const en = landing.landingMetadata('en', undefined);
    expect(en.title).toBe('Coup Online: play the card game free with friends or bots');
    expect(en.alternates?.canonical).toBe(ORIGIN);
    expect(en.alternates?.languages).toEqual({ en: ORIGIN, 'en-XA': `${ORIGIN}/en-xa`, 'ar-XB': `${ORIGIN}/ar-xb`, 'x-default': ORIGIN });
    expect(en.openGraph).toMatchObject({ locale: 'en_US', url: ORIGIN, siteName: 'Coup Online' });

    const xa = landing.landingMetadata('en-XA', undefined);
    expect(String(xa.title)).toMatch(/^⟦.*⟧$/);
    expect(String(xa.description)).toMatch(/^⟦.*⟧$/);
    expect(xa.alternates?.canonical).toBe(`${ORIGIN}/en-xa`);
    expect(xa.openGraph).toMatchObject({ url: `${ORIGIN}/en-xa` });
    expect(xa.alternates?.languages).toEqual(en.alternates?.languages);
  });

  it('uses the catalog it is given, falling back to English per key', async () => {
    const { landing } = await loadLanding({ env: 'development' });
    const meta = landing.landingMetadata('pt-BR', { seo: { title: 'Coup online: jogue grátis' } });
    expect(meta.title).toBe('Coup online: jogue grátis');
    expect(meta.description).toMatch(/^Play the bluffing card game/);
    expect(meta.openGraph).toMatchObject({ locale: 'pt_BR' });
  });

  it('every absolute URL follows NEXT_PUBLIC_BASE_URL', async () => {
    const { landing, robots } = await loadLanding({ env: 'development', baseUrl: 'https://couponline.app/' });
    expect(landing.landingUrl('en')).toBe('https://couponline.app');
    expect(landing.landingUrl('en-XA')).toBe('https://couponline.app/en-xa');
    expect(Object.values(landing.languageAlternates()).every(u => u.startsWith('https://couponline.app'))).toBe(true);
    expect(landing.landingSitemap().every(e => e.url.startsWith('https://couponline.app'))).toBe(true);
    expect(robots().sitemap).toBe('https://couponline.app/sitemap.xml');
  });

  it('a manifest per language: one app id, opening on that language', async () => {
    const { landing } = await loadLanding({ env: 'development' });
    const en = landing.landingManifest('en', undefined);
    const rtl = landing.landingManifest('ar-XB', undefined);
    expect(en).toMatchObject({ id: '/', start_url: '/', scope: '/', lang: 'en-US', dir: 'ltr' });
    expect(rtl).toMatchObject({ id: '/', start_url: '/ar-xb', scope: '/', lang: 'ar-XB', dir: 'rtl' });
  });
});

describe('hreflang reciprocity and the sitemap', () => {
  it('every page lists every page, itself and x-default, and agrees with the sitemap', async () => {
    const { landing, restore } = await loadLanding({ env: 'development', ready: ['pt-BR', 'ar', 'zh-Hans'] });
    try {
      const pages = landing.allLandingLocales().map(l => {
        const meta = landing.landingMetadata(l, undefined);
        return { url: landing.landingUrl(l), canonical: String(meta.alternates?.canonical), alternates: meta.alternates?.languages as Record<string, string> };
      });
      const sitemap = Object.fromEntries(landing.landingSitemap().map(e => [e.url, e.alternates?.languages as Record<string, string>]));
      expect(pages).toHaveLength(6);
      expect(hreflangProblems(pages, sitemap)).toEqual([]);
    } finally {
      restore();
    }
  });

  it('the validator catches a missing return link, a wrong canonical and a sitemap mismatch', () => {
    const a = { url: 'https://x.test', canonical: 'https://x.test', alternates: { en: 'https://x.test', es: 'https://x.test/es', 'x-default': 'https://x.test' } };
    const b = { url: 'https://x.test/es', canonical: 'https://x.test', alternates: { es: 'https://x.test/es', 'x-default': 'https://x.test' } };
    const problems = hreflangProblems([a, b], { 'https://x.test': a.alternates });
    expect(problems.some(p => p.includes('canonical'))).toBe(true);
    expect(problems.some(p => p.includes('not reciprocal'))).toBe(true);
    expect(problems.some(p => p.includes('not in the sitemap'))).toBe(true);
  });

  it('parses a sitemap with alternates', () => {
    const xml = '<urlset><url><loc>https://x.test</loc><xhtml:link rel="alternate" hreflang="en" href="https://x.test" /></url></urlset>';
    expect(parseSitemap(xml)).toEqual({ 'https://x.test': { en: 'https://x.test' } });
  });
});

describe('robots', () => {
  it('disallows rooms in every form', async () => {
    const { robots } = await loadLanding({ env: 'development' });
    const rules = robots().rules as { disallow: string[]; allow: string };
    expect(rules.allow).toBe('/');
    // robots.txt matches by prefix: these cover /lobby, /lobby/, /lobby/ABCD and /lobby/ABCD?x.
    expect(rules.disallow).toEqual(['/lobby', '/game']);
    const blocked = (path: string) => rules.disallow.some(prefix => path.startsWith(prefix));
    for (const path of ['/lobby', '/lobby/', '/lobby/ABCD', '/lobby/ABCD?join=1', '/game/ABCD', '/game']) expect(blocked(path)).toBe(true);
    for (const path of ['/', '/pt-br', '/en-xa', '/sitemap.xml']) expect(blocked(path)).toBe(false);
  });
});
