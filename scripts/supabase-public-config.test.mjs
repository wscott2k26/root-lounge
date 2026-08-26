import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const loadHandler = async (path) => {
  const source = await readFile(path, 'utf8');
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
};

const call = async (handler) => {
  let statusCode = 200;
  let payload;
  const res = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; },
  };
  await handler({ method: 'GET', query: {} }, res);
  return { statusCode, payload };
};

for (const key of [
  'VITE_SUPABASE_URL','SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY',
]) delete process.env[key];

const configHandler = await loadHandler('api/config.js');
const config = await call(configHandler);
assert.equal(config.statusCode, 200);
assert.equal(config.payload.supabaseUrl, 'https://hcfixfhgmjnxbmkrhmhx.supabase.co');
assert.ok(String(config.payload.supabaseKey || '').startsWith('sb_publishable_'), 'public publishable key should be available without admin secrets');

const healthHandler = await loadHandler('api/health.js');
const health = await call(healthHandler);
assert.equal(health.statusCode, 200);
assert.equal(health.payload.supabaseConfigured, true, 'public anonymous/RLS backend should be reported configured');
assert.equal(health.payload.supabaseAdminConfigured, false, 'service-role admin capability should stay a separate diagnostic');

console.log('ROOT LOUNGE SUPABASE PUBLIC CONFIG CONTRACT: PASS');
