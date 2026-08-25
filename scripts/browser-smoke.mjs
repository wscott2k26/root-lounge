import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error)));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
await mkdir('qa/screenshots',{recursive:true});

await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await page.waitForTimeout(1400);

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

const meaningfulConsoleErrors=consoleErrors.filter(text=>!text.includes('Failed to load resource')&&!text.includes('404'));
if(pageErrors.length)throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
if(meaningfulConsoleErrors.length)throw new Error(`Console errors: ${meaningfulConsoleErrors.join(' | ')}`);

console.log('ROOT LOUNGE BROWSER SMOKE: PASS');
console.log('GUI render: PASS');
console.log('Local incident flow: PASS');
console.log('Local recovery chat: PASS');
console.log('Recovered helper injection: PASS');
console.log('GUI ↔ Console switching: PASS');
console.log('Console command parser: PASS');
console.log(`Ignored expected static-server 404 console entries: ${consoleErrors.length-meaningfulConsoleErrors.length}`);
await browser.close();
