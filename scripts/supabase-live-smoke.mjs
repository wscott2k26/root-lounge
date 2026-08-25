import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { resolve4, resolve6 } from 'node:dns/promises';

const url='https://hcfixfhgmjnxbmkrhmhx.supabase.co';
const host=new URL(url).hostname;
const key='sb_publishable_fWODBDxboW2FfehqEei_hg_fSo3EIe9';

const dns={v4:[],v6:[],errors:[]};
try{dns.v4=await resolve4(host);}catch(error){dns.errors.push(`A: ${error.code||error.message}`);}
try{dns.v6=await resolve6(host);}catch(error){dns.errors.push(`AAAA: ${error.code||error.message}`);}
console.log(`Supabase DNS: ${JSON.stringify(dns)}`);

let health;
try{
  const response=await fetch(`${url}/auth/v1/health`,{signal:AbortSignal.timeout(10000)});
  health={status:response.status,text:(await response.text()).slice(0,300)};
}catch(error){
  health={error:error.message,cause:error.cause?{message:error.cause.message,code:error.cause.code,errno:error.cause.errno,syscall:error.cause.syscall,hostname:error.cause.hostname}:null};
}
console.log(`Supabase Auth health: ${JSON.stringify(health)}`);
assert.ok(!health.error&&health.status>=200&&health.status<500,`Supabase project is not network-reachable: ${JSON.stringify({dns,health})}`);

const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const {data:auth,error:authError}=await client.auth.signInAnonymously({options:{data:{handle:`qa_${Date.now()}`}}});
assert.equal(authError,null,`anonymous sign-in failed: ${authError?.message||''}`);
assert.ok(auth.session?.access_token,'anonymous session did not return an access token');
assert.match(auth.user?.id||'',/^[0-9a-f-]{36}$/i,'anonymous user id is not a UUID');
assert.equal(auth.user?.is_anonymous,true,'created Supabase user is not marked anonymous');
const userId=auth.user.id;

const incidents=await client.from('incidents').select('id,display_id,title,severity,support_count,created_at,workspace_mode').eq('workspace_mode','community').eq('status','published').limit(3);
assert.equal(incidents.error,null,`community incidents RLS read failed: ${incidents.error?.message||''}`);
const messages=await client.from('chat_messages').select('id,sender,body,created_at,workspace_mode').eq('workspace_mode','community').limit(3);
assert.equal(messages.error,null,`community chat RLS read failed: ${messages.error?.message||''}`);

const metrics={user_id:userId,sanity:42,caffeine:78,sleep:55,hydration:90};
const upsert=await client.from('user_metrics').upsert(metrics).select('user_id,sanity,caffeine,sleep,hydration').single();
assert.equal(upsert.error,null,`private metrics RLS upsert failed: ${upsert.error?.message||''}`);
assert.equal(upsert.data?.user_id,userId,'private metrics row was not scoped to anonymous user');
const own=await client.from('user_metrics').select('user_id,sanity,caffeine,sleep,hydration').eq('user_id',userId).single();
assert.equal(own.error,null,`private metrics RLS readback failed: ${own.error?.message||''}`);
assert.equal(own.data?.user_id,userId,'private metrics readback escaped user scope');

console.log('ROOT LOUNGE LIVE SUPABASE/RLS: PASS');
console.log(`Anonymous auth: PASS (${userId.slice(0,8)}…)`);
console.log(`Community incidents read: PASS (${incidents.data?.length||0} sampled)`);
console.log(`Community chat read: PASS (${messages.data?.length||0} sampled)`);
console.log('Private telemetry upsert/readback: PASS');
