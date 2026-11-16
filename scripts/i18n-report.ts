/**
 * Translation status per locale: missing keys (shown in English at runtime),
 * extra keys, argument/tag mismatches and messages that do not parse.
 *
 *   npx tsx scripts/i18n-report.ts           summary table
 *   npx tsx scripts/i18n-report.ts pt-BR     every missing key for one locale
 *
 * Exits non-zero when any locale has extra, mismatched or invalid messages.
 * Missing keys alone never fail: partial translations build and ship behind
 * `status: 'in-progress'` (src/shared/i18n/locales.ts).
 */
import en from '../src/app/i18n/messages/en';
import { CATALOG_LOADERS } from '../src/app/i18n/registry';
import { compareCatalog, invalidMessages, type CatalogShape } from '../src/shared/i18n/completeness';
import { LOCALES, type Locale } from '../src/shared/i18n/locales';

async function main(): Promise<void> {
  const only = process.argv[2] as Locale | undefined;
  let failed = false;

  const englishErrors = invalidMessages(en as CatalogShape);
  if (englishErrors.length) {
    failed = true;
    console.error('English messages that do not parse:');
    for (const e of englishErrors) console.error(`  ${e.key}: ${e.error}`);
  }

  console.log('locale    status        translated    missing  extra  mismatched  invalid');
  for (const [code, load] of Object.entries(CATALOG_LOADERS) as Array<[Locale, NonNullable<(typeof CATALOG_LOADERS)[Locale]>]>) {
    if (only && code !== only) continue;
    const catalog = (await load()).default as CatalogShape;
    const r = compareCatalog(en as CatalogShape, catalog);
    const pct = r.total ? Math.round((100 * r.translated) / r.total) : 0;
    console.log(
      `${code.padEnd(9)} ${LOCALES[code].status.padEnd(13)} ${`${r.translated}/${r.total} (${pct}%)`.padEnd(13)} ${String(r.missing.length).padStart(7)} ${String(r.extra.length).padStart(6)} ${String(r.mismatched.length).padStart(11)} ${String(r.invalid.length).padStart(8)}`,
    );
    if (r.extra.length || r.mismatched.length || r.invalid.length) failed = true;
    for (const k of r.extra) console.log(`  extra      ${k}`);
    for (const m of r.mismatched) console.log(`  mismatch   ${m.key}: ${m.detail}`);
    for (const m of r.invalid) console.log(`  invalid    ${m.key}: ${m.error}`);
    if (only) for (const k of r.missing) console.log(`  missing    ${k}`);
  }
  process.exit(failed ? 1 : 0);
}

void main();
