/**
 * A landing page renders in its own language on the server, before any
 * client code activates a locale: the About section, the switcher and the
 * JSON-LD all come out translated from the catalog the layout hands over.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => '/',
}));

const { SeoContent } = await import('@/app/components/home/SeoContent');
const { LandingLocaleProvider, useT } = await import('@/app/i18n/react');
const { useI18nStore } = await import('@/app/i18n/runtime');

function jsonLd(html: string) {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  expect(m).not.toBeNull();
  return JSON.parse(m![1]) as { '@graph': Array<Record<string, unknown>> };
}

describe('server rendering a landing page', () => {
  it('English: the About section, the FAQ and JSON-LD that parses, with no catalog download', () => {
    const html = renderToStaticMarkup(<SeoContent />);
    expect(html).toContain('About Coup Online');
    expect(html).toContain('Can I play Coup online with friends?');
    expect(html).toContain('unofficial, fan-made adaptation of Coup');
    expect(html).toContain('Rikki Tahta');
    const graph = jsonLd(html)['@graph'];
    expect(graph.map(n => n['@type'])).toEqual(['WebSite', 'VideoGame', 'FAQPage']);
    const faq = graph[2] as { inLanguage: string; mainEntity: Array<{ name: string }> };
    expect(faq.inLanguage).toBe('en');
    expect(faq.mainEntity).toHaveLength(6);
    expect(faq.mainEntity[4].name).toBe('How many players can play?');
    expect((graph[1] as { numberOfPlayers: unknown }).numberOfPlayers).toEqual({ '@type': 'QuantitativeValue', minValue: 2, maxValue: 6 });
    expect(useI18nStore.getState().locale).toBe('en');
  });

  it('a translated page uses the catalog from its layout, before anything is activated', () => {
    const catalog = { seo: { aboutHeading: 'Sobre o Coup Online', faqFriendsQ: 'Dá para jogar Coup online com amigos?' } };
    const html = renderToStaticMarkup(
      <LandingLocaleProvider locale="pt-BR" catalog={catalog}>
        <SeoContent />
      </LandingLocaleProvider>,
    );
    expect(html).toContain('Sobre o Coup Online');
    expect(html).toContain('Dá para jogar Coup online com amigos?');
    // Untranslated keys fall back to English, per key.
    expect(html).toContain('How a turn works');
    const graph = jsonLd(html)['@graph'];
    expect(graph[1].inLanguage).toBe('pt-BR');
    expect((graph[2] as { mainEntity: Array<{ name: string }> }).mainEntity[0].name).toBe('Dá para jogar Coup online com amigos?');
    // Nothing global changed: the server store is shared by every request.
    expect(useI18nStore.getState().locale).toBe('en');
    expect(useI18nStore.getState().catalogs['pt-BR']).toBeUndefined();
  });

  it('the pseudo-locales render through the provider too, with every string marked', () => {
    const html = renderToStaticMarkup(
      <LandingLocaleProvider locale="en-XA">
        <SeoContent />
      </LandingLocaleProvider>,
    );
    expect(html).toContain('⟦Ááƀööûûţ Çööûûþ Ööñļîîñéé⟧');
    expect(html).not.toContain('About Coup Online');
  });

  it('useT prefers the landing page language to the active one', () => {
    function Probe() {
      const t = useT();
      return <>{t.locale} {t.dir} {t('seo.faqHeading')}</>;
    }
    expect(renderToStaticMarkup(<Probe />)).toBe('en ltr Questions');
    expect(renderToStaticMarkup(
      <LandingLocaleProvider locale="ar-XB"><Probe /></LandingLocaleProvider>,
    )).toBe('ar-XB rtl ⟦\u2067\u202eQuestions\u202c\u2069⟧');
  });

  it('JSON-LD cannot be closed early by catalog text', () => {
    const catalog = { seo: { faqFreeA: 'Sim </script><script>alert(1)</script>' } };
    const html = renderToStaticMarkup(
      <LandingLocaleProvider locale="pt-BR" catalog={catalog}><SeoContent /></LandingLocaleProvider>,
    );
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1];
    expect(ld).not.toContain('</script');
    expect(JSON.stringify(JSON.parse(ld))).toContain('alert(1)');
  });
});
