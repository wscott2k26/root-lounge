import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const url = process.env.ROOT_LOUNGE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error)));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});

try {
  await page.goto(url, { waitUntil: 'networkidle' });

  try {
    await page.waitForSelector('#helpBtn', { timeout: 5000 });
  } catch (error) {
    const diagnostics=await page.evaluate(()=>({
      href:location.href,
      title:document.title,
      readyState:document.readyState,
      hasGuiMeta:typeof GUI_META!=='undefined',
      hasSetGuiView:typeof setGuiView==='function',
      hasOnboardingScript:Boolean(document.querySelector('script[data-root-lounge-onboarding]')),
      onboardingScriptText:(document.querySelector('script[data-root-lounge-onboarding]')?.textContent||'').slice(0,180),
      headerControls:Boolean(document.querySelector('.header-controls')),
      bodyText:(document.body?.innerText||'').slice(0,450)
    }));
    throw new Error(`Help button did not boot. Diagnostics=${JSON.stringify(diagnostics)} PageErrors=${JSON.stringify(pageErrors)} ConsoleErrors=${JSON.stringify(consoleErrors)} Original=${error.message}`);
  }

  await page.waitForSelector('#tourOverlay:not([hidden])', { timeout: 5000 });
  assert.equal((await page.locator('#tourStepCount').textContent()).trim(), '1 / 5');

  for (let step = 1; step < 5; step++) {
    await page.click('#tourNext');
    assert.equal((await page.locator('#tourStepCount').textContent()).trim(), `${step + 1} / 5`);
  }

  await page.click('#tourDone');
  assert.equal(await page.evaluate(() => localStorage.getItem('root-lounge-tour-v1')), 'done');

  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#tourOverlay:not([hidden])').count(), 0, 'completed tour should not nag on reload');

  await page.click('#helpBtn');
  await page.waitForSelector('#gui-view-help.active', { timeout: 5000 });
  const helpText = await page.locator('#gui-view-help').innerText();
  for (const phrase of ['GUI vs Console', 'Check-In', 'Incidents', 'Recovery', 'Local vs Shared']) {
    assert.ok(helpText.includes(phrase), `help view must explain ${phrase}`);
  }

  await page.click('#helpStartTour');
  await page.waitForSelector('#tourOverlay:not([hidden])', { timeout: 5000 });
  assert.equal((await page.locator('#tourStepCount').textContent()).trim(), '1 / 5');

  assert.equal(pageErrors.length,0,`Page errors during onboarding: ${pageErrors.join(' | ')}`);
  console.log('ROOT LOUNGE ONBOARDING/HELP BROWSER CONTRACT: PASS');
} finally {
  await browser.close();
}
