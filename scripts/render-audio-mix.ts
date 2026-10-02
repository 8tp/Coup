/**
 * Run the offline audio-mix harness in a headless Chrome and save the report.
 *
 *   npx tsx scripts/render-audio-mix.ts            # measure → artifacts/audio-mix-report.json
 *   npx tsx scripts/render-audio-mix.ts solve      # re-solve hero-clip gains → artifacts/audio-mix-solve.json
 *
 * This is the procedure in docs/AUDIO-MIX.md ("Regenerating the measurements"),
 * automated: bundle tests/app/audio/harness.entry.ts with esbuild, serve it next
 * to public/audio, open it in Chrome over the DevTools protocol, and wait for
 * `window.__COUP_REPORT`. The render is Chrome's own OfflineAudioContext — the
 * point of the harness — so a real Chrome binary is required. Set CHROME_PATH,
 * or it will look for Google Chrome and then for a Playwright Chromium.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();

function findChrome(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  const pw = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (existsSync(pw)) {
    const dirs = readdirSync(pw).filter(d => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) {
      candidates.push(path.join(pw, d,
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'));
      candidates.push(path.join(pw, d, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'));
      candidates.push(path.join(pw, d, 'chrome-linux/chrome'));
    }
  }
  const found = candidates.find(c => existsSync(c));
  if (!found) throw new Error('No Chrome found. Set CHROME_PATH.');
  return found;
}

interface SolveRow { id: string; variant: number; url: string; gain: number; deltaDb: number }

/**
 * `solve --apply`: write each solved gain into its HERO_CLIPS entry in
 * SoundEngine.ts, matched by url. The table is then re-measured with a plain
 * run and pasted into measurements.ts — the gate pins both.
 */
async function applyGains(rows: readonly SolveRow[]): Promise<void> {
  const file = path.join(ROOT, 'src/app/audio/SoundEngine.ts');
  let src = await readFile(file, 'utf8');
  for (const r of rows) {
    const literal = r.url.startsWith('/audio/sfx/') ? `\`\${SFX}${r.url.slice('/audio/sfx/'.length)}\`` : `'${r.url}'`;
    const at = src.indexOf(`url: ${literal}, gain: `);
    if (at === -1) throw new Error(`HERO_CLIPS entry not found for ${r.url}`);
    const start = at + `url: ${literal}, gain: `.length;
    const end = start + (src.slice(start).match(/^[0-9.]+/)?.[0].length ?? 0);
    src = src.slice(0, start) + String(r.gain) + src.slice(end);
    console.log(`${r.id.padEnd(24)} v${r.variant}  gain ${String(r.gain).padStart(6)}  Δ ${r.deltaDb.toFixed(2)}dB`);
  }
  await writeFile(file, src);
}

interface ReportRow {
  id: string; tier: number; source: 'synth' | 'clip'; variant?: number; heroGain?: number; trimDb: number;
  peakDb: number; stRmsDb: number; rmsDb: number; limiterDb: number; activeMs: number;
}
interface Report {
  rows: ReportRow[];
  pairs: { label: string; clips: boolean; peakDb: number; stRmsDb: number; limiterDb: number }[];
  contrast: { id: string; source: string; activeMs: number; bandsDb: number[]; lowDb: number; centroidHz: number }[];
  beds: { track: string; medianDb: number; p90Db: number; maxDb: number; peakDb: number; bandsDb: number[] }[];
  masking: { id: string; octaveHz: number; cueBandDb: number; margins: Record<string, number> }[];
}

/**
 * Print both ladders — the synth bank (what plays when a fetch fails) and the
 * SHIPPED one (each hero cue as its loudest/hottest clip variant) — with the
 * tier margins and the stab margin the gate asserts. Read-only; the gate is
 * tests/app/audio/mix.test.ts.
 */
function summarise(report: Report): void {
  const ladders: Record<string, Map<string, ReportRow[]>> = { synth: new Map(), shipped: new Map() };
  for (const r of report.rows) {
    if (r.source === 'synth') ladders.synth.set(r.id, [r]);
  }
  for (const r of report.rows) {
    const list = ladders.shipped.get(r.id);
    if (r.source === 'clip') ladders.shipped.set(r.id, list && list[0].source === 'clip' ? [...list, r] : [r]);
    else if (!list) ladders.shipped.set(r.id, [r]);
  }
  for (const [name, ladder] of Object.entries(ladders)) {
    console.log(`\n── ${name} ladder ──`);
    const tiers = [0, 1, 2, 3, 4];
    const lo: number[] = [];
    const hi: number[] = [];
    const pk: Record<number, [number, number]> = {};
    for (const t of tiers) {
      const rows = [...ladder.values()].flat().filter(r => r.tier === t);
      lo[t] = Math.min(...rows.map(r => r.stRmsDb));
      hi[t] = Math.max(...rows.map(r => r.stRmsDb));
      pk[t] = [Math.min(...rows.map(r => r.peakDb)), Math.max(...rows.map(r => r.peakDb))];
      for (const r of rows.sort((a, b) => b.stRmsDb - a.stRmsDb)) {
        const tag = r.source === 'clip' ? `clip${r.variant ?? 0}` : 'synth';
        console.log(`  ${t} ${r.id.padEnd(24)} ${tag.padEnd(6)} peak ${r.peakDb.toFixed(2).padStart(7)} `
          + `loud ${r.stRmsDb.toFixed(2).padStart(7)} lim ${r.limiterDb.toFixed(2)} active ${r.activeMs}`);
      }
    }
    for (const t of [0, 1, 2, 3]) console.log(`  margin ${t}/${t + 1}: ${(lo[t] - hi[t + 1]).toFixed(2)} dB`);
    const quietestLoss = Math.min(pk[0][0], pk[1][0]);
    const hottestRoutine = Math.max(pk[3][1], pk[4][1]);
    console.log(`  stab: quietest loss peak ${quietestLoss.toFixed(2)} − hottest routine ${hottestRoutine.toFixed(2)} = ${(quietestLoss - hottestRoutine).toFixed(2)} dB`);
  }
  console.log('\n── pairs ──');
  for (const p of report.pairs) {
    console.log(`  ${(p.clips ? 'clip ' : 'synth') } ${p.label.padEnd(44)} peak ${p.peakDb.toFixed(2)} loud ${p.stRmsDb.toFixed(2)} lim ${p.limiterDb.toFixed(2)}`);
  }
}

/** The report as the data blocks of measurements.ts, so nothing is hand-copied. */
function snippet(report: Report): string {
  const lv = (r: ReportRow, withActive: boolean): string =>
    `{ peakDb: ${r.peakDb}, rmsDb: ${r.rmsDb}, stRmsDb: ${r.stRmsDb}, limiterDb: ${r.limiterDb}${withActive ? `, activeMs: ${r.activeMs}` : ''} }`;
  const tiers = [0, 1, 2, 3, 4];
  const synth = report.rows.filter(r => r.source === 'synth');
  const clips = report.rows.filter(r => r.source === 'clip');
  let s = 'export const MEASURED: Readonly<Record<SoundId, CueLevels>> = {\n';
  for (const t of tiers) {
    for (const r of synth.filter(x => x.tier === t).sort((a, b) => b.stRmsDb - a.stRmsDb)) s += `  ${r.id}: ${lv(r, false)},\n`;
  }
  s += '};\n\nexport const MEASURED_HERO_CLIP: Readonly<Partial<Record<SoundId, readonly ClipLevels[]>>> = {\n';
  for (const t of tiers) {
    const ids = [...new Set(clips.filter(x => x.tier === t).map(x => x.id))];
    for (const id of ids) {
      const vs = clips.filter(x => x.id === id).sort((a, b) => (a.variant ?? 0) - (b.variant ?? 0));
      s += `  ${id}: [\n${vs.map(v => `    ${lv(v, true)},\n`).join('')}  ],\n`;
    }
  }
  s += '};\n\n';
  for (const kind of [false, true]) {
    s += `export const ${kind ? 'MEASURED_CLIP_PAIRS' : 'MEASURED_PAIRS'}: readonly PairLevels[] = [\n`;
    for (const p of report.pairs.filter(x => x.clips === kind)) {
      const q = p as typeof p & { rmsDb: number };
      s += `  { label: '${p.label}', peakDb: ${p.peakDb}, rmsDb: ${q.rmsDb}, stRmsDb: ${p.stRmsDb}, limiterDb: ${p.limiterDb} },\n`;
    }
    s += '];\n\n';
  }
  for (const source of ['synth', 'clip']) {
    s += `export const ${source === 'clip' ? 'MEASURED_CLIP_CONTRAST' : 'MEASURED_CONTRAST'}: Readonly<Record<string, ContrastLevels>> = {\n`;
    for (const c of report.contrast.filter(x => x.source === source)) {
      s += `  ${c.id}: {\n    activeMs: ${c.activeMs},\n    bandsDb: [${c.bandsDb.join(', ')}],\n    lowDb: ${c.lowDb},\n    centroidHz: ${c.centroidHz},\n  },\n`;
    }
    s += '};\n\n';
  }
  s += 'export const MEASURED_BEDS: Readonly<Record<string, BedLevels>> = {\n';
  for (const b of report.beds) {
    s += `  ${b.track}: { medianDb: ${b.medianDb}, p90Db: ${b.p90Db}, maxDb: ${b.maxDb}, peakDb: ${b.peakDb}, bandsDb: [${b.bandsDb.join(', ')}] },\n`;
  }
  s += '};\n\nexport const MEASURED_MASKING: Readonly<Record<SoundId, MaskLevels>> = {\n';
  for (const m of report.masking) {
    s += `  ${m.id}: { octaveHz: ${m.octaveHz}, cueBandDb: ${m.cueBandDb}, margins: { ${Object.entries(m.margins).map(([k, v]) => `${k}: ${v}`).join(', ')} } },\n`;
  }
  s += '};\n\n';
  s += 'export const MEASURED_TRIM_DB: Readonly<Record<SoundId, number>> = {\n';
  for (const r of synth) s += `  ${r.id}: ${r.trimDb},\n`;
  s += '};\n\nexport const MEASURED_HERO_CLIP_GAIN: Readonly<Partial<Record<SoundId, readonly number[]>>> = {\n';
  for (const id of [...new Set(clips.map(c => c.id))]) {
    const gains = clips.filter(c => c.id === id).sort((a, b) => (a.variant ?? 0) - (b.variant ?? 0)).map(c => c.heroGain);
    s += `  ${id}: [${gains.join(', ')}],\n`;
  }
  return `${s}};\n`;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.json': 'application/json',
};

async function main(): Promise<void> {
  const arg = process.argv[2];
  const mode = arg === 'solve' || arg === 'clips' || arg === 'live' ? arg : 'run';
  const dir = await mkdtemp(path.join(os.tmpdir(), 'coup-audio-'));
  execFileSync('npx', ['esbuild', 'tests/app/audio/harness.entry.ts', '--bundle', '--format=esm',
    '--target=es2022', `--outfile=${path.join(dir, 'harness.bundle.js')}`, '--log-level=warning'], { stdio: 'inherit' });
  await copyFile('tests/app/audio/harness.html', path.join(dir, 'harness.html'));

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const file = url.pathname.startsWith('/audio/')
      ? path.join(ROOT, 'public', url.pathname)
      : path.join(dir, url.pathname);
    readFile(file).then((body) => {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    }).catch(() => { res.writeHead(404); res.end(); });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;

  const chrome = findChrome();
  const profile = path.join(dir, 'profile');
  const proc = spawn(chrome, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  try {
    const wsUrl = await new Promise<string>((resolve, reject) => {
      let buf = '';
      proc.stderr.on('data', (d: Buffer) => {
        buf += d.toString();
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) resolve(m[1]);
      });
      proc.on('exit', code => reject(new Error(`chrome exited ${code}: ${buf}`)));
    });
    const debugPort = new URL(wsUrl).port;
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json() as
      { type: string; webSocketDebuggerUrl: string }[];
    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('no page target');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let nextId = 0;
    const pending = new Map<number, (v: unknown) => void>();
    ws.onmessage = (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown };
      if (msg.id !== undefined) pending.get(msg.id)?.(msg.result);
    };
    const send = (method: string, params: object = {}): Promise<unknown> => new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.navigate', { url: `http://127.0.0.1:${port}/harness.html?mode=${mode}` });
    const result = await send('Runtime.evaluate', {
      expression: `new Promise((resolve) => {
        const t = setInterval(() => {
          if (window.__COUP_REPORT) { clearInterval(t); resolve(JSON.stringify(window.__COUP_REPORT)); }
        }, 250);
      })`,
      awaitPromise: true,
      returnByValue: true,
      timeout: 600000,
    }) as { result?: { value?: string }; exceptionDetails?: unknown };
    const json = result.result?.value;
    if (!json) throw new Error(`no report: ${JSON.stringify(result)}`);
    const report = JSON.parse(json) as { error?: string };
    if (report.error) throw new Error(report.error);
    await mkdir('artifacts', { recursive: true });
    const out = path.join('artifacts', mode === 'run' ? 'audio-mix-report.json' : `audio-mix-${mode}.json`);
    await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`saved ${out} (${chrome.split('/').pop()})`);
    if (mode === 'solve' && process.argv.includes('--apply')) {
      await applyGains((report as unknown as { solve: SolveRow[] }).solve);
    }
    if (mode === 'run') {
      summarise(report as unknown as Report);
      await writeFile('artifacts/measurements-snippet.txt', snippet(report as unknown as Report));
      console.log('\nsaved artifacts/measurements-snippet.txt — paste into tests/app/audio/measurements.ts');
    }
    ws.close();
  } finally {
    proc.kill();
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
