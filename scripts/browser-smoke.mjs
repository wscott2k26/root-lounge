import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const target = process.env.ROOT_LOUNGE_URL || 'http://127.0.0.1:4173/';
const expectApi = process.env.EXPECT_API === '1';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error)));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
await mkdir('qa/screenshots',{recursive:true});

await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForSelector('#guiShell',{timeout:20000});
await page.waitForTimeout(1600);

assert(await page.locator('#guiShell').evaluate(el=>el.classList.contains('active')),'GUI shell did not start active');
assert(await page.locator('#guiMetricCards .gui-metric').count()===4,'Expected four rendered GUI metric cards');
assert((await page.locator('#guiHandle').textContent()||'').trim().length>0,'GUI handle did not render');
await page.screenshot({path:'qa/screenshots/gui-overview.png',fullPage:true});

await page.locator('#guiNav [data-gui-view="incidents"]').click();
assert(await page.locator('#gui-view-incidents').evaluate(el=>el.classList.contains('active')),'Incident GUI view did not activate');
await page.locator('#guiIncidentInput').fill('QA smoke: sanitized deploy test incident');
await page.locator('#guiIncidentForm button[type="submit"]').click();
await page.waitForTimeout(250);
assert((await page.locator('#guiIncidentList').textContent()||'').includes('QA smoke: sanitized deploy test incident'),'Local incident submission did not render');

await page.locator('#guiNav [data-gui-view="recovery"]').click();
await page.locator('#guiChatInput').fill('QA smoke: recovery-room message');
await page.locator('#guiChatForm button[type="submit"]').click();
await page.waitForTimeout(200);
assert((await page.locator('#guiChatList').textContent()||'').includes('QA smoke: recovery-room message'),'Local recovery chat submission did not render');

await page.locator('#guiNav [data-gui-view="settings"]').click();
await page.waitForTimeout(1300);
assert(await page.locator('#guiCorporateSetupCard').count()===1,'Recovered corporate workspace helper did not inject its settings card');

await page.locator('#consoleInterfaceBtn').click();
assert(await page.locator('#consoleShell').evaluate(el=>el.classList.contains('active')),'Console shell did not activate');
assert((await page.locator('#terminalOutput').textContent()||'').includes('ROOT LOUNGE'),'Console boot log did not render');
await page.locator('#terminalInput').fill('status');
await page.locator('#terminalForm').evaluate(form=>form.requestSubmit());
await page.waitForTimeout(150);
assert((await page.locator('#terminalOutput').textContent()||'').includes('Sanity'),'Console status command did not execute');
await page.screenshot({path:'qa/screenshots/console.png',fullPage:true});

await page.locator('#guiInterfaceBtn').click();
assert(await page.locator('#guiShell').evaluate(el=>el.classList.contains('active')),'Could not switch back to GUI');

if(expectApi){
  const api=await page.evaluate(async()=>{
    const read=async(url,options)=>{
      const response=await fetch(url,options);
      let body={};
      try{body=await response.json();}catch{}
      return {status:response.status,body};
    };
    const config=await read('/api/config');
    const health=await read('/api/health');
    const checkout=await read('/api/create-checkout-session',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sku:'caffeine'})
    });
    return {config,health,checkout};
  });
  assert(api.config.status===200,`/api/config returned ${api.config.status}`);
  assert(api.health.status===200,`/api/health returned ${api.health.status}`);
  assert(api.health.body?.ok===true,'/api/health did not report ok=true');
  assert(api.health.body?.version==='3.2.0-recovered',`Unexpected health version: ${api.health.body?.version}`);
  assert([200,503].includes(api.checkout.status),`Checkout honesty check returned unexpected ${api.checkout.status}`);
  if(api.checkout.status===503) assert(/not configured/i.test(String(api.checkout.body?.error||'')),'Checkout 503 did not explain configuration state');
  console.log(`API config: PASS (${api.config.status})`);
  console.log(`API health: PASS (${api.health.status}, ${api.health.body.version})`);
  console.log(`Checkout behavior: PASS (${api.checkout.status})`);
}

const meaningfulConsoleErrors=consoleErrors.filter(text=>
  !text.includes('Failed to load resource')&&
  !text.includes('404')&&
  !text.includes('vercel.live')&&
  !text.includes('feedback.js')&&
  !text.includes('Content Security Policy')
);
if(pageErrors.length)throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
if(meaningfulConsoleErrors.length)throw new Error(`Console errors: ${meaningfulConsoleErrors.join(' | ')}`);

console.log('ROOT LOUNGE BROWSER SMOKE: PASS');
console.log(`Target: ${new URL(target).origin}`);
console.log('GUI render: PASS');
console.log('Local incident flow: PASS');
console.log('Local recovery chat: PASS');
console.log('Recovered helper injection: PASS');
console.log('GUI ↔ Console switching: PASS');
console.log('Console command parser: PASS');
console.log(`Ignored expected browser/platform console entries: ${consoleErrors.length-meaningfulConsoleErrors.length}`);
await browser.close();
