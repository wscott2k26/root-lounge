import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const key = '9321d93d5d3086014e81dec77c619e98';
const keyFile = await readFile(`${key}.txt`, 'utf8');

assert.equal(keyFile.trim(), key, 'IndexNow verification file must contain the exact public key');
assert.match(key, /^[A-Fa-f0-9-]{8,128}$/, 'IndexNow key must use a valid protocol format');

console.log('UPTIME LOUNGE INDEXNOW CONTRACT: PASS');
