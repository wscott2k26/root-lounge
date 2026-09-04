import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const styles = await readFile('recovered-live/styles.css', 'utf8');
const gui = await readFile('recovered-live/gui.css', 'utf8');
const source = `${styles}\n${gui}`;

for (const token of ['--glass:', '--glass-strong:', '--surface:', '--surface-raised:', '--glass-border:', '--glass-highlight:']) {
  assert.ok(source.includes(token), `Missing premium material token ${token}`);
}
assert.ok(source.includes('backdrop-filter'), 'Premium material system must use backdrop-filter');
assert.ok(source.includes('@supports not (backdrop-filter:blur(1px))') || source.includes('@supports not (backdrop-filter: blur(1px))'), 'Glass system needs a non-blur fallback');
assert.ok(source.includes('prefers-reduced-motion:reduce'), 'Reduced-motion accessibility contract missing');
assert.ok(source.includes('prefers-contrast:more'), 'Higher-contrast accessibility contract missing');
assert.ok(/\.topbar[^}]*var\(--glass/.test(source) || /\.topbar[^}]*backdrop-filter/.test(source), 'Top bar must participate in the glass system');
assert.ok(/\.gui-sidebar[^}]*var\(--glass/.test(source) || /\.gui-sidebar[^}]*backdrop-filter/.test(source), 'GUI navigation shell must participate in the glass system');

console.log('UPTIME LOUNGE MATERIAL CONTRACT: PASS');
