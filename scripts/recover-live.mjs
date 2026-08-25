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
      if (html) {
        return {
          payload: candidate,
          html,
          repairs: [{ index, from: char, to: replacement, strategy: 'single-character substitution' }],
        };
      }
    }

    const removed = `${rawPayload.slice(0, index)}${rawPayload.slice(index + 1)}`;
    const removedHtml = tryHtmlFromPayload(removed);
    if (removedHtml) {
      return {
        payload: removed,
        html: removedHtml,
        repairs: [{ index, from: char, to: '', strategy: 'remove stray character' }],
      };
    }
  }

  throw new Error(`Could not mathematically repair loader payload; invalid count=${invalid.length}`);
}

await mkdir(OUT, { recursive: true });
const manifest = {
  recoveredAt: new Date().toISOString(),
  source: ROOT,
  files: {},
  loaderRepair: null,
};

const loader = await fetchBytes(`${ROOT}/loader.js`);
await writeFile(new URL('loader.js', OUT), loader);
manifest.files['loader.js'] = { bytes: loader.length, sha256: sha256(loader), url: `${ROOT}/loader.js` };

const loaderText = loader.toString('utf8');
const { rawPayload, invalid } = extractAtobPayload(loaderText);
console.log(`Live loader payload length: ${rawPayload.length}`);
if (invalid.length) console.warn('Invalid Base64 characters:', invalid);
const repaired = repairPayload(rawPayload, invalid);
console.log('Loader repair:', repaired.repairs.length ? repaired.repairs : 'none required');
manifest.loaderRepair = {
  originalCharacters: rawPayload.length,
  repairedCharacters: repaired.payload.length,
  invalidCharactersFound: invalid,
  repairs: repaired.repairs,
};

await writeFile(new URL('index.html', OUT), repaired.html);
manifest.files['index.html'] = { bytes: repaired.html.length, sha256: sha256(repaired.html), source: 'mathematically repaired and decoded from loader.js' };

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

await writeFile(
  new URL('recovery-manifest.json', OUT),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Recovered ${Object.keys(manifest.files).length} live files.`);
for (const [name, meta] of Object.entries(manifest.files)) {
  console.log(`${name.padEnd(24)} ${String(meta.bytes).padStart(8)} bytes  ${meta.sha256.slice(0, 16)}…`);
}
