# Uptime Lounge Premium Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the public experience to Uptime Lounge, deploy a restrained premium glass material system, connect Fourthwall as the real physical-merch fulfillment provider, and expand QA so production promotion is evidence-based.

**Architecture:** Keep stable infrastructure identifiers (`root-lounge` repo/Vercel/Supabase names) unchanged while rebranding runtime copy and presentation. Stripe remains responsible for support + Corporate billing, Supabase remains responsible for shared data + entitlements, and Fourthwall becomes the physical-merch provider. An empty Fourthwall catalog is represented as a non-error `awaiting_products` content state rather than a fulfillment outage.

**Tech Stack:** Static HTML/CSS/JavaScript, Vercel Functions, Supabase/Postgres/Edge Functions, Stripe hosted Payment Links, Fourthwall storefront/fulfillment, Playwright, Node.js contract tests.

**Spec:** `docs/superpowers/specs/2026-09-04-uptime-lounge-premium-launch-design.md`

## Global Constraints

- Public product name is exactly `Uptime Lounge`.
- Do not rename stable repo, Vercel project, Supabase project ref, database tables, or existing Stripe price identities.
- No new images are required or surfaced.
- Do not copy competitor assets, exact layouts, or trade dress; use only broad hierarchy/material patterns.
- Glass is concentrated in navigation/controls/modals; content surfaces remain readable.
- Preserve `prefers-reduced-motion` behavior.
- Stripe support + Corporate and the Supabase entitlement path must not regress.
- Physical merch never uses the old physical Stripe payment links once Fourthwall is configured.

---

### Task 1: Rebrand runtime copy and add premium material tokens

**Files:**
- Modify: `index.html`
- Modify: `recovered-live/styles.css`
- Modify: `recovered-live/gui.css`
- Modify: `recovered-live/helper.js`
- Modify: `recovered-live/app1.js`
- Modify: `recovered-live/app2.js`
- Modify: `recovered-live/app3.js`
- Modify: `recovered-live/gui.js`
- Modify: `recovered-live/onboarding.js`
- Modify: `recovered-live/social.js`
- Modify: `recovered-live/demo-social.js`
- Test: `scripts/brand-contract.mjs`
- Test: `scripts/browser-smoke.mjs`

**Interfaces:**
- Consumes: existing DOM IDs and existing state/config contracts.
- Produces: unchanged DOM IDs, public brand `Uptime Lounge`, CSS tokens `--glass`, `--glass-strong`, `--surface`, `--surface-raised`, and consistent focus/hover behavior.

- [ ] **Step 1: Write the failing brand contract**

Create `scripts/brand-contract.mjs` that reads runtime-facing files and fails when a user-facing `Root Lounge` string remains, while allowing infrastructure paths such as `root-lounge-stripe-webhook` and storage keys.

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const files=['index.html','recovered-live/helper.js','recovered-live/app1.js','recovered-live/app2.js','recovered-live/app3.js','recovered-live/gui.js','recovered-live/onboarding.js','recovered-live/social.js','recovered-live/demo-social.js'];
for (const file of files) {
  const source=await readFile(file,'utf8');
  const visible=source.replaceAll('root-lounge-stripe-webhook','').replaceAll('root-lounge-live-v2.1','').replaceAll('root-lounge-tour-v1','');
  assert.ok(!/Root Lounge|ROOT LOUNGE/.test(visible), `${file} contains stale public branding`);
}
console.log('UPTIME LOUNGE BRAND CONTRACT: PASS');
```

- [ ] **Step 2: Run the brand contract and verify it fails**

Run: `node scripts/brand-contract.mjs`
Expected: FAIL on the current Root Lounge runtime copy.

- [ ] **Step 3: Replace public copy while preserving internal identifiers**

Update titles, descriptions, boot copy, help text, Corporate copy, Community modal/log copy, and Funding copy to `Uptime Lounge`. Keep storage/database/function identifiers unchanged.

- [ ] **Step 4: Add restrained glass/material tokens**

Add tokens similar to:

```css
:root{
  --bg:#08090c;
  --surface:rgba(17,20,26,.82);
  --surface-raised:rgba(22,26,34,.92);
  --glass:rgba(20,24,31,.58);
  --glass-strong:rgba(20,24,31,.76);
  --glass-border:rgba(255,255,255,.10);
  --glass-highlight:rgba(255,255,255,.16);
  --shadow-soft:0 18px 60px rgba(0,0,0,.28);
}
```

Apply glass only to `.topbar`, `.gui-sidebar`, segmented controls, modal chrome, filters/search, and priority CTA/navigation surfaces. Add readable fallbacks with `@supports not (backdrop-filter: blur(1px))`.

- [ ] **Step 5: Add reduced-transparency and reduced-motion fallbacks**

```css
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media(prefers-contrast:more){.topbar,.gui-sidebar,.modal{background:#101319;border-color:#59606a}}
```

- [ ] **Step 6: Run brand and browser tests**

Run: `node scripts/brand-contract.mjs`
Run: `node scripts/audit-dom-bindings.mjs`
Run browser smoke with the project test command or Playwright harness.
Expected: all pass, with GUI ↔ Console, Incident, Recovery, Settings, and console parser intact.

- [ ] **Step 7: Commit**

Commit message: `feat: rebrand runtime as Uptime Lounge with premium materials`

---

### Task 2: Connect Fourthwall readiness without faking catalog availability

**Files:**
- Modify: `api/config.js`
- Modify: `api/health.js`
- Modify: `recovered-live/app1.js`
- Modify: `recovered-live/app3.js`
- Modify: `recovered-live/gui.js`
- Modify: `recovered-live/helper.js`
- Test: `scripts/merch-contract.mjs`
- Test: `scripts/live-billing-contract.mjs`

**Interfaces:**
- Produces config keys:
  - `merchProvider: 'fourthwall'`
  - `merchProviderConfigured: boolean`
  - `merchFulfillmentReady: boolean`
  - `merchCatalogStatus: 'awaiting_products' | 'live' | 'unavailable'`
  - `merchCheckoutEnabled: boolean`
  - `merchStoreUrl: string`
- Physical merch UI consumes only those keys; Stripe support/Corporate flow remains unchanged.

- [ ] **Step 1: Write failing merch contract**

```js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const config=await readFile('api/config.js','utf8');
const health=await readFile('api/health.js','utf8');
const app3=await readFile('recovered-live/app3.js','utf8');
assert.ok(config.includes("merchProvider: 'fourthwall'"));
assert.ok(config.includes('merchProviderConfigured'));
assert.ok(config.includes('merchFulfillmentReady'));
assert.ok(config.includes("merchCatalogStatus: 'awaiting_products'"));
assert.ok(config.includes('merchCheckoutEnabled: false'));
assert.ok(!app3.includes("sku==='oom_tee'"), 'Physical merch must not use Stripe SKU checkout');
assert.ok(health.includes('merchProviderConfigured'));
console.log('UPTIME LOUNGE MERCH CONTRACT: PASS');
```

- [ ] **Step 2: Run it and verify it fails**

Run: `node scripts/merch-contract.mjs`
Expected: FAIL because current config exposes only `merchEnabled:false` / `merchFulfillmentReady:false`.

- [ ] **Step 3: Rename the connected Fourthwall shop**

Use Fourthwall shop settings to set creator/site name to `Uptime Lounge` and internal domain slug to `uptime-lounge`. Keep the site `COMING_SOON` while zero offers exist.

- [ ] **Step 4: Update API config**

Set the Fourthwall public shop URL returned by the provider and expose provider/catalog readiness separately. Remove physical Stripe payment links from the browser config; keep only `caffeine` and `corporate_monthly` there.

- [ ] **Step 5: Update Funding UI**

When `merchCatalogStatus==='awaiting_products'`, render one premium merch card with copy `Merch collection opening soon` and a working `Visit merch shop` link to Fourthwall. Do not render fake T-shirt/hoodie/cap checkout buttons.

- [ ] **Step 6: Update health**

`merchFulfillmentReady` reports Fourthwall provider operational readiness. `merchCheckoutEnabled` remains false until real public Fourthwall-fulfilled offers exist. Deep health checks the Fourthwall shop URL with a non-destructive GET/HEAD and treats HTTP <500 as reachable.

- [ ] **Step 7: Update live billing contract**

Remove assertions that physical Stripe links exist or that `merchFulfillmentReady:false` is required. Add assertions that only support + Corporate remain in Stripe config and that merch is routed to Fourthwall.

- [ ] **Step 8: Run contracts**

Run: `node scripts/merch-contract.mjs`
Run: `node scripts/live-billing-contract.mjs`
Expected: PASS.

- [ ] **Step 9: Commit**

Commit message: `feat: connect Fourthwall merch fulfillment readiness`

---

### Task 3: Expand all-control and backend pipeline QA

**Files:**
- Modify: `scripts/browser-smoke.mjs`
- Modify: `scripts/onboarding-browser.mjs`
- Modify: `scripts/social-contract.mjs`
- Modify: `scripts/production-config-contract.mjs`
- Modify: `scripts/validate-rebuild.mjs`
- Create: `scripts/material-contract.mjs`

**Interfaces:**
- Consumes current DOM IDs and config keys.
- Produces a deterministic test gate covering all major controls without making real purchases or destructive writes.

- [ ] **Step 1: Add material contract**

Check for glass tokens, `backdrop-filter`, reduced-motion fallback, and high-contrast/readable fallback.

- [ ] **Step 2: Expand browser smoke**

Exercise:
- GUI and Console switches.
- Community and Corporate mode buttons.
- Every GUI nav button: Overview, Check-In, Incidents, Recovery, Runbooks, Community, Funding, Settings, Help.
- Theme selector values.
- Check-in slider/save/reset.
- Incident post.
- Recovery chat.
- 60-second reset modal open/close only (do not wait a minute).
- Handoff modal.
- Focus modal open/close.
- Funding support link presence, Corporate CTA presence, Fourthwall merch CTA presence.
- Settings handle save, export trigger existence, Privacy modal.
- Console `status`, `help`, `ls /view`, `cd /view/incidents`, and `exit` behavior.

Do not execute paid checkouts.

- [ ] **Step 3: Update production-config contract**

Require `stripeConfigured`, Fourthwall provider keys, Supabase public config, and correct Uptime Lounge metadata.

- [ ] **Step 4: Run full local/CI suite**

Run all existing Node contract scripts plus Playwright smoke. Expected: no missing DOM bindings, no page errors, no meaningful console errors.

- [ ] **Step 5: Commit**

Commit message: `test: harden Uptime Lounge release gates`

---

### Task 4: Preview, review, merge, and production verification

**Files:**
- No feature files unless a preview bug is found.
- GitHub PR and Vercel deployment only.

**Interfaces:**
- Preview must use branch code.
- Production promotion occurs only after preview evidence is green.

- [ ] **Step 1: Create pull request**

Head: `uptime-lounge-premium-launch`
Base: `main`

- [ ] **Step 2: Review branch diff**

Confirm there is no database migration, Stripe price mutation, webhook secret change, or unrelated refactor.

- [ ] **Step 3: Build/deploy Vercel preview**

Expected: deployment `READY`; homepage and all static assets HTTP 200.

- [ ] **Step 4: Preview smoke**

Check `/api/config`, `/api/health?deep=1`, legacy endpoints HTTP 410, Fourthwall shop reachability, and runtime logs.

- [ ] **Step 5: Merge only when preview is green**

Use the repository's normal merge strategy.

- [ ] **Step 6: Promote/verify production**

Production acceptance:
- homepage 200
- title `Uptime Lounge`
- `/api/config` 200 with provider semantics
- `/api/health?deep=1` 200 and `ok:true`
- Supabase reachable true
- Stripe reachable true
- webhook reachable true
- Fourthwall provider reachable true
- Corporate provisioning configured true
- legacy checkout/webhook routes 410
- no fresh Vercel runtime error group

- [ ] **Step 7: Final evidence report**

Report the green checks separately from the non-error catalog content state (`awaiting_products`) so no product availability is overstated.
