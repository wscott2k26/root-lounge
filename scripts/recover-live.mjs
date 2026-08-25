import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const ROOT = 'https://root-lounge.vercel.app';
const OUT = new URL('../recovered-live/', import.meta.url);
const LOADER_BASES = [
  ROOT,
  'https://root-lounge-cmiih99xo-wscott2k26s-projects.vercel.app',
  'https://root-lounge-qyuw6efki-wscott2k26s-projects.vercel.app',
  'https://root-lounge-nja4g8w75-wscott2k26s-projects.vercel.app',
  'https://root-lounge-pwpmralcs-wscott2k26s-projects.vercel.app',
  'https://root-lounge-arn44ztup-wscott2k26s-projects.vercel.app',
  'https://root-lounge-e3iwfxqhh-wscott2k26s-projects.vercel.app',
  'https://root-lounge-332unaetq-wscott2k26s-projects.vercel.app',
  'https://root-lounge-g8b5r5omj-wscott2k26s-projects.vercel.app',
  'https://root-lounge-4lm5njjeb-wscott2k26s-projects.vercel.app',
  'https://root-lounge-cy88kxpn8-wscott2k26s-projects.vercel.app',
  'https://root-lounge-3ibifazeo-wscott2k26s-projects.vercel.app',
  'https://root-lounge-l739yaw5i-wscott2k26s-projects.vercel.app',
];
const ASSETS = {
  'app1.js': 'https://root-lounge-assets-js1.vercel.app/app1.js',
  'app2.js': 'https://root-lounge-assets-js2.vercel.app/app2.js',
  'app3.js': 'https://root-lounge-assets-js3.vercel.app/app3.js',
  'styles.css': 'https://root-lounge-assets-css.vercel.app/styles.css',
  'gui.js': 'https://root-lounge-gui-js.vercel.app/gui.js',
  'gui.css': 'https://root-lounge-gui-css.vercel.app/gui.css',
};
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'RootLounge-Recovery-GitHub/1.0' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function extractAtobPayload(source) {
  const marker = 'atob(';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('loader.js does not contain atob(');
  let quotePos = -1;
  let quote = '';
  for (let i = start + marker.length; i < source.length; i++) {
    if (source[i] === '"' || source[i] === "'") {
      quotePos = i;
      quote = source[i];
      break;
    }
  }
  if (quotePos < 0) throw new Error('Could not find opening payload quote in loader.js');
  const end = source.indexOf(quote, quotePos + 1);
  if (end < 0) throw new Error('Could not find closing payload quote in loader.js');
  const rawPayload = source.slice(quotePos + 1, end).trim();
  if (!rawPayload.startsWith('H4sI')) throw new Error(`Unexpected loader payload prefix: ${rawPayload.slice(0, 12)}`);
  const invalid = [...rawPayload.matchAll(/[^A-Za-z0-9+/=]/g)].map(m => ({ char: m[0], index: m.index }));
  return { rawPayload, invalid };
}

function tryHtmlFromPayload(payload) {
  try {
    const html = gunzipSync(Buffer.from(payload, 'base64'));
    const text = html.toString('utf8');
    if (!/^\s*<!doctype html/i.test(text)) return null;
    if (!/<title>Root Lounge<\/title>/i.test(text)) return null;
    return html;
  } catch {
    return null;
  }
}

function repairPayload(rawPayload, invalid) {
  const direct = tryHtmlFromPayload(rawPayload);
  if (direct) return { payload: rawPayload, html: direct, repairs: [] };

  if (invalid.length === 1) {
    const { index, char } = invalid[0];
    for (const replacement of BASE64_ALPHABET) {
      const candidate = `${rawPayload.slice(0, index)}${replacement}${rawPayload.slice(index + 1)}`;
      const html = tryHtmlFromPayload(candidate);
      if (html) return { payload: candidate, html, repairs: [{ index, from: char, to: replacement, strategy: 'single-character substitution' }] };
    }
    const removed = `${rawPayload.slice(0, index)}${rawPayload.slice(index + 1)}`;
    const html = tryHtmlFromPayload(removed);
    if (html) return { payload: removed, html, repairs: [{ index, from: char, to: '', strategy: 'remove stray character' }] };
  }
  return null;
}

async function recoverNewestWorkingHtml() {
  const attempts = [];
  for (const base of LOADER_BASES) {
    const loaderUrl = `${base}/loader.js`;
    try {
      const loader = await fetchBytes(loaderUrl);
      const { rawPayload, invalid } = extractAtobPayload(loader.toString('utf8'));
      const repaired = repairPayload(rawPayload, invalid);
      attempts.push({ base, status: repaired ? 'working' : 'corrupt', invalid });
      if (repaired) return { base, loader, repaired, attempts, invalid };
    } catch (error) {
      attempts.push({ base, status: 'unavailable', error: String(error?.message || error) });
    }
  }
  throw new Error(`No intact historical Root Lounge loader found: ${JSON.stringify(attempts)}`);
}

await mkdir(OUT, { recursive: true });
const manifest = { recoveredAt: new Date().toISOString(), source: ROOT, files: {}, loaderRecovery: null };

const recovered = await recoverNewestWorkingHtml();
await writeFile(new URL('loader.js', OUT), recovered.loader);
await writeFile(new URL('index.html', OUT), recovered.repaired.html);
manifest.loaderRecovery = {
  selectedDeployment: recovered.base,
  repairs: recovered.repaired.repairs,
  invalidCharactersFound: recovered.invalid,
  attempts: recovered.attempts,
};
manifest.files['loader.js'] = { bytes: recovered.loader.length, sha256: sha256(recovered.loader), url: `${recovered.base}/loader.js` };
manifest.files['index.html'] = { bytes: recovered.repaired.html.length, sha256: sha256(recovered.repaired.html), source: `decoded from ${recovered.base}` };

for (const [name, url] of Object.entries(ASSETS)) {
  const bytes = await fetchBytes(url);
  await writeFile(new URL(name, OUT), bytes);
  manifest.files[name] = { bytes: bytes.length, sha256: sha256(bytes), url };
}

for (const endpoint of ['api/config', 'api/health']) {
  const bytes = await fetchBytes(`${ROOT}/${endpoint}`);
  const name = `${endpoint.replace('/', '-')}.json`;
  await writeFile(new URL(name, OUT), bytes);
  manifest.files[name] = { bytes: bytes.length, sha256: sha256(bytes), url: `${ROOT}/${endpoint}` };
}

await writeFile(new URL('recovery-manifest.json', OUT), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Selected intact HTML deployment: ${recovered.base}`);
console.log(`Recovered ${Object.keys(manifest.files).length} live files.`);
for (const [name, meta] of Object.entries(manifest.files)) {
  console.log(`${name.padEnd(24)} ${String(meta.bytes).padStart(8)} bytes  ${meta.sha256.slice(0, 16)}…`);
}
