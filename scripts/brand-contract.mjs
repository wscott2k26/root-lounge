import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  'index.html',
  'recovered-live/helper.js',
  'recovered-live/app1.js',
  'recovered-live/app2.js',
  'recovered-live/app3.js',
  'recovered-live/gui.js',
  'recovered-live/onboarding.js',
  'recovered-live/social.js',
  'recovered-live/demo-social.js',
];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const visible = source
    .replaceAll('root-lounge-stripe-webhook', '')
    .replaceAll('root-lounge-live-v2.1', '')
    .replaceAll('root-lounge-tour-v1', '')
    .replaceAll('root-lounge-social', '')
    .replaceAll('root-lounge-onboarding', '')
    .replaceAll('root-lounge-demo-social', '');
  assert.ok(!/Root Lounge|ROOT LOUNGE/.test(visible), `${file} contains stale public Root Lounge branding`);
}

const index = await readFile('index.html', 'utf8');
assert.ok(index.includes('<title>Uptime Lounge</title>'), 'Document title must be Uptime Lounge');
assert.ok(index.includes('aria-label="Uptime Lounge"'), 'Top-level brand aria label must be Uptime Lounge');

console.log('UPTIME LOUNGE BRAND CONTRACT: PASS');
