import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const helper = await readFile(new URL('../recovered-live/helper.js', import.meta.url), 'utf8');
const social = await readFile(new URL('../recovered-live/social.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../recovered-live/social.css', import.meta.url), 'utf8');
const migrationDir = new URL('../supabase/migrations/', import.meta.url);
const migrationNames = await readdir(migrationDir);
const activityName = migrationNames.find(name=>name.endsWith('_root_lounge_social_activity.sql'));
assert.ok(activityName, 'social activity migration must exist');
const activity = await readFile(new URL(`../supabase/migrations/${activityName}`, import.meta.url), 'utf8');

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
for (const trigger of ['community_members_refresh_count','notify_post_reaction','notify_post_comment','notify_follow','notify_direct_message','notify_join_request']) {
  assert.ok(activity.includes(trigger), `social activity migration missing ${trigger}`);
}
assert.ok(activity.includes('touch_conversation_from_message'), 'direct messages must refresh conversation activity time');

console.log('ROOT LOUNGE SOCIAL CONTRACT: PASS');
