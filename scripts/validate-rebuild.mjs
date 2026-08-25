import { readFile } from 'node:fs/promises';

const html = await readFile('index.html','utf8');
const audit = JSON.parse(await readFile('recovered-live/dom-binding-audit.json','utf8'));

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const counts = new Map();
for (const id of ids) counts.set(id,(counts.get(id)||0)+1);
const duplicates=[...counts.entries()].filter(([,count])=>count>1);
const missing=audit.requiredIds.filter(id=>!counts.has(id));

const requiredFragments = [
  'id="gui-view-overview" class="gui-view active"',
  'id="gui-view-checkin" class="gui-view"',
  'id="gui-view-incidents" class="gui-view"',
  'id="gui-view-recovery" class="gui-view"',
  'id="gui-view-runbooks" class="gui-view"',
  'id="gui-view-funding" class="gui-view"',
  'id="gui-view-settings" class="gui-view"',
  'id="view-telemetry" class="view active"',
  'id="view-incidents" class="view"',
  'id="view-recovery" class="view"',
  'id="view-wiki" class="view"',
  'id="view-funding" class="view"',
  'data-sku="corporate_monthly"',
  'data-gui-view="overview"',
  'data-gui-view="settings"',
  'src="/recovered-live/dom-utils.js"',
  'src="/recovered-live/app1.js"',
  'src="/recovered-live/app2.js"',
  'src="/recovered-live/app3.js"',
  'src="/recovered-live/gui.js"',
  'src="/recovered-live/helper.js"',
];
const missingFragments=requiredFragments.filter(fragment=>!html.includes(fragment));

const scriptOrder=[
  '/recovered-live/dom-utils.js',
  '/recovered-live/app1.js',
  '/recovered-live/app2.js',
  '/recovered-live/app3.js',
  '/recovered-live/gui.js',
  '/recovered-live/helper.js',
].map(src=>html.indexOf(src));
const scriptOrderValid=scriptOrder.every((pos,i)=>pos>=0&&(i===0||pos>scriptOrder[i-1]));

const unsafeInlineHandlers=[...html.matchAll(/\son(?:click|submit|change|input|load|error)\s*=/gi)].map(m=>m[0]);

console.log(`HTML IDs: ${ids.length}`);
console.log(`Required production bindings: ${audit.requiredIds.length}`);
console.log(`Missing bindings: ${missing.length}`);
console.log(`Duplicate IDs: ${duplicates.length}`);
console.log(`Missing structural fragments: ${missingFragments.length}`);
console.log(`Script order valid: ${scriptOrderValid}`);
console.log(`Inline event handlers: ${unsafeInlineHandlers.length}`);

if (missing.length) console.error('Missing IDs:',missing);
if (duplicates.length) console.error('Duplicate IDs:',duplicates);
if (missingFragments.length) console.error('Missing fragments:',missingFragments);
if (!scriptOrderValid) console.error('Script order:',scriptOrder);
if (unsafeInlineHandlers.length) console.error('Inline event handlers found:',unsafeInlineHandlers);

if (missing.length||duplicates.length||missingFragments.length||!scriptOrderValid||unsafeInlineHandlers.length) process.exit(1);
console.log('ROOT LOUNGE REBUILD CONTRACT: PASS');
