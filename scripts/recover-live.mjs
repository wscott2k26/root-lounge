import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const ROOT = 'https://root-lounge.vercel.app';
const OUT = new URL('../recovered-live/', import.meta.url);
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
  const response = await fetch(url, { headers: { 'user-agent': 'RootLounge-Recovery-GitHub/1.0' }, redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function extractAtobPayload(source) {
  const start = source.indexOf('atob(');
  if (start < 0) throw new Error('loader.js does not contain atob(');
  let quotePos = -1, quote = '';
  for (let i = start + 5; i < source.length; i++) if (source[i] === '"' || source[i] === "'") { quotePos = i; quote = source[i]; break; }
  if (quotePos < 0) throw new Error('No payload quote');
  const end = source.indexOf(quote, quotePos + 1);
  if (end < 0) throw new Error('No closing payload quote');
  const rawPayload = source.slice(quotePos + 1, end).trim();
  const invalid = [...rawPayload.matchAll(/[^A-Za-z0-9+/=]/g)].map(m => ({ char: m[0], index: m.index }));
  return { rawPayload, invalid };
}

function tryHtml(payload) {
  try {
    const html = gunzipSync(Buffer.from(payload, 'base64'));
    const text = html.toString('utf8');
    return /^\s*<!doctype html/i.test(text) && /<title>Root Lounge<\/title>/i.test(text) ? html : null;
  } catch { return null; }
}

function repairPayload(rawPayload, invalid) {
  const direct = tryHtml(rawPayload);
  if (direct) return { html: direct, repairs: [] };
  if (invalid.length === 1) {
    const { index, char } = invalid[0];
    for (const replacement of BASE64_ALPHABET) {
      const candidate = rawPayload.slice(0, index) + replacement + rawPayload.slice(index + 1);
      const html = tryHtml(candidate);
      if (html) return { html, repairs: [{ index, from: char, to: replacement, strategy: 'substitution' }] };
    }
    const removed = rawPayload.slice(0, index) + rawPayload.slice(index + 1);
    const html = tryHtml(removed);
    if (html) return { html, repairs: [{ index, from: char, to: '', strategy: 'removal' }] };
  }
  return null;
}

await mkdir(OUT, { recursive: true });
const manifest = { recoveredAt: new Date().toISOString(), source: ROOT, files: {}, loaderRecovery: null };

// Recover the clean public production assets first. These are the important source artifacts.
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

// Preserve and diagnose the current loader, but never let its corruption block asset recovery.
try {
  const loader = await fetchBytes(`${ROOT}/loader.js`);
  await writeFile(new URL('loader.js', OUT), loader);
  manifest.files['loader.js'] = { bytes: loader.length, sha256: sha256(loader), url: `${ROOT}/loader.js` };
  const { rawPayload, invalid } = extractAtobPayload(loader.toString('utf8'));
  const repaired = repairPayload(rawPayload, invalid);
  manifest.loaderRecovery = { status: repaired ? 'repaired' : 'corrupt', invalidCharactersFound: invalid, repairs: repaired?.repairs || [] };
  if (repaired) {
    await writeFile(new URL('index.html', OUT), repaired.html);
    manifest.files['index.html'] = { bytes: repaired.html.length, sha256: sha256(repaired.html), source: 'decoded from repaired live loader' };
  } else {
    await writeFile(new URL('INDEX-RECONSTRUCTION-REQUIRED.txt', OUT), 'The live compressed loader is corrupt. Production JS/CSS assets were recovered successfully. Reconstruct index.html from verified DOM bindings before redeployment.\n');
  }
} catch (error) {
  manifest.loaderRecovery = { status: 'unavailable', error: String(error?.message || error) };
}

await writeFile(new URL('recovery-manifest.json', OUT), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Recovered ${Object.keys(manifest.files).length} production artifacts.`);
console.log('Loader status:', manifest.loaderRecovery?.status || 'unknown');
for (const [name, meta] of Object.entries(manifest.files)) console.log(`${name.padEnd(24)} ${String(meta.bytes).padStart(8)} bytes ${meta.sha256.slice(0,16)}…`);
