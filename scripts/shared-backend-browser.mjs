import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const target=process.env.ROOT_LOUNGE_URL;
if(!target)throw new Error('ROOT_LOUNGE_URL is required.');

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const pageErrors=[];
const consoleMessages=[];
page.on('pageerror',error=>pageErrors.push(String(error)));
page.on('console',msg=>consoleMessages.push(`${msg.type()}: ${msg.text()}`));

try{
  await page.addInitScript(()=>localStorage.setItem('root-lounge-tour-v1','done'));
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#guiBackendPill',{timeout:20000});

  try{
    await page.waitForFunction(()=>typeof state!=='undefined'&&state.session?.backend==='supabase'&&Boolean(state.client),{timeout:20000});
  }catch(error){
    const diagnostics=await page.evaluate(async()=>{
      let auth={data:{session:null},error:null};
      try{if(typeof state!=='undefined'&&state.client)auth=await state.client.auth.getSession();}catch(e){auth={data:{session:null},error:{message:String(e)}};}
      return {
        backend:typeof state!=='undefined'?state.session?.backend||'':'',
        userId:typeof state!=='undefined'?state.session?.userId||'':'',
        clientReady:typeof state!=='undefined'&&Boolean(state.client),
        config:typeof state!=='undefined'?state.config||{}:{},
        authUserId:auth?.data?.session?.user?.id||'',
        authError:auth?.error?.message||'',
        pill:document.getElementById('guiBackendPill')?.textContent?.trim()||'',
        backendLabel:document.getElementById('backendLabel')?.textContent?.trim()||''
      };
    });
    throw new Error(`Supabase shared mode did not settle. Diagnostics=${JSON.stringify(diagnostics)} PageErrors=${JSON.stringify(pageErrors)} Console=${JSON.stringify(consoleMessages)} Original=${error.message}`);
  }

  const runtime=await page.evaluate(async()=>{
    const auth=state.client?await state.client.auth.getSession():{data:{session:null},error:null};
    return {
      backend:state.session?.backend||'',
      userId:state.session?.userId||'',
      clientReady:Boolean(state.client),
      authUserId:auth?.data?.session?.user?.id||'',
      authError:auth?.error?.message||'',
      pill:document.getElementById('guiBackendPill')?.textContent?.trim()||'',
      backendLabel:document.getElementById('backendLabel')?.textContent?.trim()||''
    };
  });

  assert.equal(runtime.backend,'supabase',`expected Supabase shared mode, got ${JSON.stringify(runtime)}`);
  assert.equal(runtime.clientReady,true,'Supabase client was not created');
  assert.match(runtime.userId,/^[0-9a-f-]{36}$/i,'anonymous Root Lounge user id is not a UUID');
  assert.equal(runtime.authUserId,runtime.userId,'Supabase auth session does not match Root Lounge session');
  assert.equal(runtime.authError,'','Supabase auth returned an error');
  assert.equal(runtime.pill,'SHARED BACKEND','GUI did not disclose shared backend mode');
  assert.match(runtime.backendLabel,/Supabase session active/i,'footer did not disclose the shared Supabase session');
  assert.equal(pageErrors.length,0,`Page errors during shared backend startup: ${pageErrors.join(' | ')}`);

  console.log('ROOT LOUNGE SHARED SUPABASE SESSION: PASS');
  console.log(`Anonymous session: ${runtime.userId.slice(0,8)}…`);
}finally{
  await browser.close();
}
