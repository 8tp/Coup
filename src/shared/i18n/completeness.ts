import { messageArguments, parseMessage } from './messageFormat';

/**
 * Catalog checks shared by `tests/app/i18n/catalogs.test.ts` and
 * `scripts/i18n-report.ts`. Catalogs are `{ namespace: { key: message } }`.
 */
export type CatalogShape = Readonly<Record<string, Readonly<Record<string, string | undefined>> | undefined>>;

export interface CatalogReport {
  /** Keys English has and this locale lacks (they fall back to English). */
  missing: string[];
  /** Keys this locale has and English does not (dead text; also a compile error). */
  extra: string[];
  /** Keys whose arguments or tags differ from English. */
  mismatched: Array<{ key: string; detail: string }>;
  /** Keys whose message does not parse. */
  invalid: Array<{ key: string; error: string }>;
  translated: number;
  total: number;
}

function flatten(catalog: CatalogShape): Map<string, string> {
  const out = new Map<string, string>();
  for (const [ns, entries] of Object.entries(catalog)) {
    for (const [key, message] of Object.entries(entries ?? {})) {
      if (typeof message === 'string' && message !== '') out.set(`${ns}.${key}`, message);
    }
  }
  return out;
}

/** Every key in English, including empty-string placeholders. */
function englishKeys(catalog: CatalogShape): string[] {
  const out: string[] = [];
  for (const [ns, entries] of Object.entries(catalog)) {
    for (const key of Object.keys(entries ?? {})) out.push(`${ns}.${key}`);
  }
  return out;
}

const sorted = (set: Set<string>) => [...set].sort().join(', ') || '(none)';

export function compareCatalog(english: CatalogShape, translation: CatalogShape): CatalogReport {
  const en = flatten(english);
  const all = englishKeys(english);
  const tr = flatten(translation);
  const report: CatalogReport = { missing: [], extra: [], mismatched: [], invalid: [], translated: 0, total: en.size };

  for (const key of all) {
    if (!tr.has(key) && en.has(key)) report.missing.push(key);
  }
  for (const [key, message] of tr) {
    if (!all.includes(key)) { report.extra.push(key); continue; }
    report.translated += 1;
    try {
      parseMessage(message);
    } catch (err) {
      report.invalid.push({ key, error: (err as Error).message });
      continue;
    }
    const source = en.get(key);
    if (source === undefined) continue;
    const a = messageArguments(source);
    const b = messageArguments(message);
    // A translation may drop a select it does not need ("you" branches in a
    // language without verb agreement) but may not invent arguments or tags.
    const inventedArgs = [...b.args].filter(x => !a.args.has(x));
    const tagsDiffer = sorted(a.tags) !== sorted(b.tags);
    const droppedArgs = [...a.args].filter(x => !b.args.has(x));
    if (inventedArgs.length || tagsDiffer || droppedArgs.length) {
      report.mismatched.push({
        key,
        detail: `args en {${sorted(a.args)}} vs {${sorted(b.args)}}; tags en <${sorted(a.tags)}> vs <${sorted(b.tags)}>`,
      });
    }
  }
  return report;
}

/** Parse errors in a catalog (used on English itself). */
export function invalidMessages(catalog: CatalogShape): Array<{ key: string; error: string }> {
  const out: Array<{ key: string; error: string }> = [];
  for (const [key, message] of flatten(catalog)) {
    try { parseMessage(message); } catch (err) { out.push({ key, error: (err as Error).message }); }
  }
  return out;
}
