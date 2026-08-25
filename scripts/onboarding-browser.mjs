import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const url = process.env.ROOT_LOUNGE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(url, { waitUntil: 'networkidle' });

  await page.waitForSelector('#helpBtn', { timeout: 5000 });
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

  console.log('ROOT LOUNGE ONBOARDING/HELP BROWSER CONTRACT: PASS');
} finally {
  await browser.close();
}
