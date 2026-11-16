/**
 * Checks the landing pages the way a crawler sees them, from raw HTML with
 * no JavaScript: every page in the sitemap answers 200 with `<html lang dir>`,
 * a title, a description, a self-canonical, Open Graph tags, JSON-LD that
 * parses, the About section, and an hreflang set that is complete and
 * reciprocal (every page lists every other, itself and `x-default`, with the
 * same URLs as the sitemap). Rooms are disallowed in robots.txt.
 *
 *   npx tsx scripts/check-seo.ts http://localhost:3000
 *
 * Exits non-zero on any problem. The URL checks run against the site named in
 * the pages themselves (`NEXT_PUBLIC_BASE_URL`), so a local server built for
 * production prints production URLs; pages are fetched from the given origin.
 * `tests/app/i18n/landing.test.ts` runs the same validators on the metadata
 * the app generates.
 */

export interface PageSeo {
  /** The URL the page claims (its canonical). */
  url: string;
  lang: string | null;
  dir: string | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  /** hreflang → href. */
  alternates: Record<string, string>;
  og: Record<string, string[]>;
  jsonLd: unknown[];
  jsonLdErrors: string[];
  hasAbout: boolean;
}

const decode = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag);
  return m ? decode(m[1]) : null;
}

/** Read what a crawler reads from a page's raw HTML. */
export function parsePage(html: string, url: string): PageSeo {
  // Only the document head and body markup, not the RSC payload Next.js inlines in scripts.
  const markup = html.replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, '');
  const htmlTag = /<html\b[^>]*>/i.exec(markup)?.[0] ?? '';
  const tags = markup.match(/<(meta|link)\b[^>]*>/gi) ?? [];
  const alternates: Record<string, string> = {};
  const og: Record<string, string[]> = {};
  let description: string | null = null;
  let canonical: string | null = null;
  for (const tag of tags) {
    const rel = attr(tag, 'rel');
    if (rel === 'alternate') {
      const lang = attr(tag, 'hreflang') ?? attr(tag, 'hrefLang');
      const href = attr(tag, 'href');
      if (lang && href) alternates[lang] = href;
    } else if (rel === 'canonical') canonical = attr(tag, 'href');
    const name = attr(tag, 'name');
    const property = attr(tag, 'property');
    if (name === 'description') description = attr(tag, 'content');
    if (property?.startsWith('og:') || name?.startsWith('twitter:')) {
      const key = (property ?? name)!;
      (og[key] ??= []).push(attr(tag, 'content') ?? '');
    }
  }
  const jsonLd: unknown[] = [];
  const jsonLdErrors: string[] = [];
  for (const m of markup.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { jsonLd.push(JSON.parse(m[1])); } catch (e) { jsonLdErrors.push(String(e)); }
  }
  const title = /<title>([^<]*)<\/title>/i.exec(markup)?.[1];
  return {
    url,
    lang: attr(htmlTag, 'lang'),
    dir: attr(htmlTag, 'dir'),
    title: title === undefined ? null : decode(title),
    description,
    canonical,
    alternates,
    og,
    jsonLd,
    jsonLdErrors,
    hasAbout: /id="landing-about-title"/.test(markup),
  };
}

/**
 * Problems with a set of landing pages' hreflang annotations, compared with
 * each other and with the sitemap's (`sitemap`: page URL → its alternates).
 */
export function hreflangProblems(pages: Array<Pick<PageSeo, 'url' | 'canonical' | 'alternates'>>, sitemap?: Record<string, Record<string, string>>): string[] {
  const problems: string[] = [];
  const urls = new Set(pages.map(p => p.url));
  for (const page of pages) {
    const where = page.url;
    if (page.canonical !== page.url) problems.push(`${where}: canonical is ${page.canonical}`);
    const hrefs = Object.values(page.alternates);
    // Language entries only: x-default does not count as listing a page.
    const languageHrefs = Object.entries(page.alternates).filter(([lang]) => lang !== 'x-default').map(([, href]) => href);
    if (!page.alternates['x-default']) problems.push(`${where}: no x-default`);
    if (!languageHrefs.includes(page.url)) problems.push(`${where}: does not list itself`);
    for (const [lang, href] of Object.entries(page.alternates)) {
      if (lang !== 'x-default' && !/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/.test(lang)) problems.push(`${where}: hreflang "${lang}" is not a BCP 47 tag`);
      if (!urls.has(href)) problems.push(`${where}: ${lang} points to ${href}, which is not a landing page`);
    }
    for (const other of pages) {
      if (!languageHrefs.includes(other.url)) problems.push(`${where}: does not list ${other.url} (not reciprocal)`);
      // Same language → same URL everywhere.
      for (const [lang, href] of Object.entries(other.alternates)) {
        if (page.alternates[lang] !== undefined && page.alternates[lang] !== href) problems.push(`${where}: ${lang} is ${page.alternates[lang]} here but ${href} on ${other.url}`);
      }
    }
    const langs = Object.keys(page.alternates);
    if (new Set(hrefs).size !== hrefs.length - 1) problems.push(`${where}: two languages share a URL other than x-default (${langs.join(', ')})`);
    if (sitemap) {
      const listed = sitemap[page.url];
      if (!listed) problems.push(`${where}: not in the sitemap`);
      else if (JSON.stringify(sortKeys(listed)) !== JSON.stringify(sortKeys(page.alternates))) problems.push(`${where}: sitemap alternates differ from the page's`);
    }
  }
  if (sitemap) for (const url of Object.keys(sitemap)) if (!urls.has(url)) problems.push(`sitemap: ${url} is not a landing page`);
  return problems;
}

function sortKeys(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

/** A sitemap's `<url>` entries: loc → hreflang → href. */
export function parseSitemap(xml: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = decode(/<loc>([^<]*)<\/loc>/.exec(block)?.[1] ?? '');
    const alts: Record<string, string> = {};
    for (const link of block.match(/<xhtml:link[^>]*>/g) ?? []) {
      const lang = attr(link, 'hreflang');
      const href = attr(link, 'href');
      if (lang && href) alts[lang] = href;
    }
    out[loc] = alts;
  }
  return out;
}

/** Problems a crawler would see on one page, apart from hreflang. */
export function pageProblems(page: PageSeo): string[] {
  const p: string[] = [];
  const where = page.url;
  if (!page.lang) p.push(`${where}: <html> has no lang`);
  if (page.dir !== 'ltr' && page.dir !== 'rtl') p.push(`${where}: <html> has no dir`);
  if (!page.title) p.push(`${where}: no <title>`);
  if (!page.description) p.push(`${where}: no meta description`);
  for (const key of ['og:title', 'og:description', 'og:url', 'og:locale', 'og:image', 'twitter:card', 'twitter:title']) {
    if (!page.og[key]?.[0]) p.push(`${where}: no ${key}`);
  }
  if (page.og['og:url']?.[0] && page.og['og:url'][0] !== page.url) p.push(`${where}: og:url is ${page.og['og:url'][0]}`);
  if (page.jsonLdErrors.length) p.push(`${where}: JSON-LD does not parse: ${page.jsonLdErrors.join('; ')}`);
  if (!page.jsonLd.length) p.push(`${where}: no JSON-LD`);
  for (const doc of page.jsonLd) {
    const graph = (doc as { '@graph'?: Array<Record<string, unknown>> })['@graph'] ?? [];
    for (const type of ['VideoGame', 'FAQPage']) {
      const node = graph.find(n => n['@type'] === type);
      if (!node) p.push(`${where}: JSON-LD has no ${type}`);
      else if (node.inLanguage !== page.lang) p.push(`${where}: ${type}.inLanguage is ${String(node.inLanguage)}, page is ${page.lang}`);
    }
  }
  if (!page.hasAbout) p.push(`${where}: no About section in the HTML`);
  return p;
}

async function main(): Promise<void> {
  const origin = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '');
  const get = async (path: string) => {
    const res = await fetch(origin + path, { redirect: 'manual' });
    return { status: res.status, text: await res.text(), location: res.headers.get('location') };
  };
  const problems: string[] = [];
  const sitemapRes = await get('/sitemap.xml');
  const sitemap = parseSitemap(sitemapRes.text);
  const pages: PageSeo[] = [];
  for (const url of Object.keys(sitemap)) {
    const path = new URL(url).pathname;
    const res = await get(path);
    if (res.status !== 200) { problems.push(`${url}: HTTP ${res.status}`); continue; }
    const page = parsePage(res.text, url);
    pages.push(page);
    problems.push(...pageProblems(page));
    console.log(`${path.padEnd(10)} lang=${page.lang} dir=${page.dir} hreflang=[${Object.keys(page.alternates).join(', ')}] title="${page.title}"`);
  }
  problems.push(...hreflangProblems(pages, sitemap));

  const robots = (await get('/robots.txt')).text;
  for (const rule of ['Disallow: /lobby', 'Disallow: /game']) if (!robots.includes(rule)) problems.push(`robots.txt: missing "${rule}"`);
  for (const [path, want] of [['/xx', 404], ['/lobby', 404]] as const) {
    const res = await get(path);
    if (res.status !== want) problems.push(`${path}: HTTP ${res.status}, expected ${want}`);
  }
  const en = await get('/en');
  if (en.status !== 308 || !/\/$/.test(en.location ?? '')) problems.push(`/en: expected a 308 to /, got ${en.status} ${en.location}`);

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`\n${pages.length} landing page(s), sitemap, hreflang, robots: OK`);
}

if (process.argv[1] && /check-seo\.ts$/.test(process.argv[1])) void main();
