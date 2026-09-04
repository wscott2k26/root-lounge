import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('index.html','utf8');
const app2 = await readFile('recovered-live/app2.js','utf8');
const app3 = await readFile('recovered-live/app3.js','utf8');
const gui = await readFile('recovered-live/gui.js','utf8');
const helper = await readFile('recovered-live/helper.js','utf8');
const onboarding = await readFile('recovered-live/onboarding.js','utf8');
const social = await readFile('recovered-live/social.js','utf8');
const runtime = `${app2}\n${app3}\n${gui}\n${helper}\n${onboarding}\n${social}`;

const ids = [...html.matchAll(/<button\b[^>]*\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const dynamicIds = [
  'helpBtn','helpStartTour','tourBack','tourNext','tourDone','tourSkip',
  'rlCreateCommunity','rlMarkAllRead','guiCorporateAccessButton'
];

for (const id of [...new Set([...ids,...dynamicIds])]) {
  const direct = runtime.includes(`RL$('${id}')`) || runtime.includes(`el('${id}')`) || runtime.includes(`$('${id}')`) || runtime.includes(`getElementById('${id}')`);
  const selector = runtime.includes(`#${id}`);
  const dynamicCreation = runtime.includes(`.id='${id}'`) || runtime.includes(`.id="${id}"`);
  assert.ok(direct || selector || dynamicCreation, `Button/control ${id} has no runtime binding reference`);
}

for (const view of ['overview','checkin','incidents','recovery','runbooks','funding','settings']) {
  assert.ok(html.includes(`data-gui-view="${view}"`), `Missing GUI nav control for ${view}`);
  assert.ok(gui.includes('data-gui-view') || gui.includes('dataset.guiView'), 'GUI runtime must delegate nav clicks');
}
for (const view of ['telemetry','incidents','recovery','wiki','funding']) {
  assert.ok(html.includes(`data-view="${view}"`), `Missing console tab for ${view}`);
}
assert.ok(gui.includes('themeSelector') && app3.includes('applyTheme'), 'Theme selector must be bound to theme runtime');
assert.ok(app3.includes('communityMode') && app3.includes('corporateMode'), 'Workspace mode controls must be bound');
assert.ok(helper.includes('patchFunding'), 'Funding controls must be normalized by runtime overlay');
assert.ok(helper.includes("button.addEventListener('click'"), 'Dynamic Corporate/Funding controls must attach click listeners');
assert.ok(social.includes('data-social-tab'), 'Community tab controls must be delegated');
assert.ok(onboarding.includes('helpBtn') && onboarding.includes('tourNext'), 'Help/tour controls must be bound');

console.log(`UPTIME LOUNGE CONTROL CONTRACT: PASS (${new Set([...ids,...dynamicIds]).size} controls checked)`);
