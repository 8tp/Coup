/**
 * Unread badges ("3", "9+") are figures: in Arabic they must stay left to
 * right, or "9+" turns into "+9" (ART-DIRECTION §4 Figures, docs/I18N.md
 * "Right to left"). `.figure` pins direction and isolates the run, so every
 * element that renders an unread count carries it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = path.resolve(__dirname, '../../../src/app/components');

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('unread badges', () => {
  it('every element showing an unread count is a .figure', () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const file of files(APP)) {
      const src = readFileSync(file, 'utf8');
      let at = src.indexOf('unreadMany');
      while (at !== -1) {
        seen += 1;
        const open = src.lastIndexOf('<span', at);
        const tag = src.slice(open, src.indexOf('>', open) + 1);
        if (!/className="[^"]*\bfigure\b/.test(tag)) offenders.push(`${path.basename(file)}: ${tag}`);
        at = src.indexOf('unreadMany', at + 1);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(3);
    expect(offenders).toEqual([]);
  });
});
