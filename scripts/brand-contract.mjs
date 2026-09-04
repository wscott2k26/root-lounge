import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helper = await readFile('recovered-live/helper.js', 'utf8');
const premium = await readFile('recovered-live/premium.css', 'utf8');

assert.ok(helper.includes("const PUBLIC_BRAND='Uptime Lounge'"), 'Runtime overlay must define Uptime Lounge as the public brand');
assert.ok(helper.includes('MutationObserver'), 'Runtime overlay must correct late-loaded Community/onboarding copy');
assert.ok(helper.includes('document.title=PUBLIC_BRAND'), 'Runtime overlay must update document title');
assert.ok(helper.includes('Uptime Lounge — a decompression workspace'), 'Runtime overlay must update document metadata');
assert.ok(helper.includes("match===match.toUpperCase()?'UPTIME LOUNGE':PUBLIC_BRAND"), 'Runtime overlay must preserve uppercase brand treatment');
assert.ok(premium.includes('--glass:'), 'Premium layer must be present with glass tokens');

console.log('UPTIME LOUNGE BRAND CONTRACT: PASS');
