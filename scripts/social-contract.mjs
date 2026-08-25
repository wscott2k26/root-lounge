import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helper = await readFile(new URL('../recovered-live/helper.js', import.meta.url), 'utf8');
const social = await readFile(new URL('../recovered-live/social.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../recovered-live/social.css', import.meta.url), 'utf8');

assert.match(helper, /recovered-live\/social\.css/, 'Root Lounge must load the community stylesheet');
assert.match(helper, /recovered-live\/social\.js/, 'Root Lounge must load the community runtime');

for (const contract of [
  'data-gui-view="community"',
  'rlSocialFeed',
  'rlCommunityList',
  'rlPeopleList',
  'rlNotifications',
  'rlPostComposer',
]) assert.ok(social.includes(contract), `social runtime missing ${contract}`);

for (const table of ['profiles','communities','community_members','posts','comments','post_reactions','follows','notifications','conversations','conversation_members','direct_messages']) {
  assert.ok(social.includes(`'${table}'`) || social.includes(`\"${table}\"`), `social runtime must wire ${table}`);
}

assert.ok(social.includes("rpc('bootstrap_profile'"), 'social runtime must bootstrap the authenticated profile');
assert.ok(social.includes("rpc('join_community'"), 'social runtime must use the hardened community join RPC');
assert.ok(social.includes("rpc('start_conversation'"), 'social runtime must use the hardened direct-message RPC');
assert.ok(css.includes('.rl-social-shell'), 'community stylesheet must define the social shell');

console.log('ROOT LOUNGE SOCIAL CONTRACT: PASS');
