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
  if (invalid.length) {
    console.warn(`Sanitizing ${invalid.length} non-Base64 character(s) from live loader payload.`);
    console.warn('First invalid characters:', invalid.slice(0, 10));
  }
  const payload = rawPayload.replace(/[^A-Za-z0-9+/=]/g, '');
  return { rawPayload, payload, invalid };
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
const { rawPayload, payload, invalid } = extractAtobPayload(loaderText);
manifest.loaderRepair = {
  originalCharacters: rawPayload.length,
  sanitizedCharacters: payload.length,
  removedCharacters: invalid,
};
const html = gunzipSync(Buffer.from(payload, 'base64'));
if (!/^\s*<!doctype html/i.test(html.toString('utf8'))) {
  throw new Error('Recovered loader payload decompressed but did not produce an HTML document.');
}
await writeFile(new URL('index.html', OUT), html);
manifest.files['index.html'] = { bytes: html.length, sha256: sha256(html), source: 'decoded and repaired from loader.js' };

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
