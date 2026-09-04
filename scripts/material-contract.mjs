import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('recovered-live/premium.css', 'utf8');

for (const token of ['--glass:', '--glass-strong:', '--surface:', '--surface-raised:', '--glass-border:', '--glass-highlight:']) {
  assert.ok(source.includes(token), `Missing premium material token ${token}`);
}
assert.ok(source.includes('backdrop-filter'), 'Premium material system must use backdrop-filter');
assert.ok(source.includes('@supports not (backdrop-filter:blur(1px))') || source.includes('@supports not (backdrop-filter: blur(1px))'), 'Glass system needs a non-blur fallback');
assert.ok(source.includes('prefers-reduced-motion:reduce'), 'Reduced-motion accessibility contract missing');
assert.ok(source.includes('prefers-contrast:more'), 'Higher-contrast accessibility contract missing');
assert.ok(/\.topbar[^}]*backdrop-filter/.test(source), 'Top bar must participate in the glass system');
assert.ok(/\.gui-sidebar[^}]*backdrop-filter/.test(source), 'GUI navigation shell must participate in the glass system');
assert.ok(source.includes('.uptime-merch-state'), 'Premium material system must style the merch readiness surface');

console.log('UPTIME LOUNGE MATERIAL CONTRACT: PASS');
