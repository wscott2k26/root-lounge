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

await mkdir(OUT, { recursive: true });
const manifest = {
  recoveredAt: new Date().toISOString(),
  source: ROOT,
  files: {},
};

const loader = await fetchBytes(`${ROOT}/loader.js`);
await writeFile(new URL('loader.js', OUT), loader);
manifest.files['loader.js'] = { bytes: loader.length, sha256: sha256(loader), url: `${ROOT}/loader.js` };

const loaderText = loader.toString('utf8');
const match = loaderText.match(/atob\(["']([A-Za-z0-9+/=]+)["']\)/);
if (!match) throw new Error('Could not locate compressed HTML payload in loader.js');
const html = gunzipSync(Buffer.from(match[1], 'base64'));
await writeFile(new URL('index.html', OUT), html);
manifest.files['index.html'] = { bytes: html.length, sha256: sha256(html), source: 'decoded from loader.js' };

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
