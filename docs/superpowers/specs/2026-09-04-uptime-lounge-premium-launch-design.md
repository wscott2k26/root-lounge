# Uptime Lounge Premium Launch Design

## Purpose

Rebrand the public product from Root Lounge to **Uptime Lounge**, raise the visual quality to a premium modern standard, connect a real fulfillment provider for future physical merchandise, and harden the release pipeline so every visible control and backend path is verified before production promotion.

The GitHub repository, Vercel project, Supabase project ref, database schema names, and existing billing identities remain unchanged where renaming them would create unnecessary deployment risk. The public-facing brand changes; stable infrastructure identifiers do not.

## Product Positioning

Uptime Lounge is a decompression workspace for SysAdmins, SREs, developers, and IT teams. It combines operator check-ins, sanitized incident venting, recovery tools, runbooks, a community layer, a simulated console experience, and an optional private Corporate workspace.

The product should feel like a polished reliability platform rather than a prototype or game skin. It may borrow broad interaction patterns and hierarchy principles from modern incident-management and productivity products, but it must not copy another product's exact trade dress, assets, wording, or layout.

## Public Brand Contract

- Public product name: **Uptime Lounge**.
- Public title, metadata, onboarding copy, Community copy, Corporate copy, console intro, footer, help content, and funding copy must use Uptime Lounge.
- No user-facing `Root Lounge` or `Uptime Lounge` mismatch may remain after launch.
- Internal repo/project/database identifiers may remain `root-lounge` for stability.
- Visual identity remains text-and-CSS driven for this release; no new images are required or surfaced to the user.

## Visual System

### Direction

Use a restrained Liquid-Glass-inspired material system informed by Apple's current guidance: translucent materials should emphasize navigation, controls, and hierarchy rather than coating every content card.

### Palette

- Base background: near-black graphite (`#08090c` to `#0d1015`).
- Primary signal/accent: emerald/teal family centered on the existing `#34d399` accent.
- Secondary ambient accent: restrained blue-violet used only in background glow and selected states.
- Text: near-white primary, cool gray secondary.
- Warning, danger, and info semantic colors remain distinct from the brand accent.

### Materials

- Glass is limited to: global top bar, sidebar/navigation shell, segmented controls, modal chrome, floating action surfaces, search/filter controls, and selected high-value CTA surfaces.
- Content cards use solid or lightly translucent elevated materials with subtle border highlights, not full heavy blur.
- Edge highlights use low-opacity white/brand-tinted lines.
- Backdrop blur must degrade gracefully when unsupported.
- `prefers-reduced-motion` and reduced-transparency accessibility states must preserve legibility.

### Motion

- 140-220ms hover/selection transitions.
- Small scale/translate motion on cards and controls only where it communicates state.
- No continuous decorative animation.
- Existing breathing/recovery animation remains functional and respects reduced motion.

### Layout and hierarchy

- Stronger top-of-page value hierarchy on Overview.
- Cleaner grouping of action buttons into one primary CTA and lower-emphasis secondary actions.
- Community, Funding, Corporate, and Settings surfaces receive consistent premium treatment.
- Responsive layouts must remain usable at desktop, tablet, and mobile breakpoints.

## Merch and Fulfillment Architecture

Fourthwall is the fulfillment provider for physical merchandise.

### Fourthwall state

- Fourthwall shop is connected.
- The shop is currently an auto-generated placeholder and contains zero offers.
- The shop should be renamed to **Uptime Lounge** with an internal slug based on `uptime-lounge`.
- The shop may remain `COMING_SOON` until a real product catalog exists.

### Readiness semantics

The site must stop using a single ambiguous false flag for all merch concerns.

Expose separate state:

- `merchProviderConfigured`: Fourthwall provider and public shop URL are configured.
- `merchFulfillmentReady`: provider can fulfill orders once products are published; this reflects provider operational readiness, not catalog inventory.
- `merchCatalogStatus`: string enum such as `awaiting_products`, `live`, or `unavailable`.
- `merchCheckoutEnabled`: true only when at least one real Fourthwall-fulfilled public offer exists.

A provider-ready empty catalog is not an error. The UI should show a clear `Merch collection opening soon` state rather than disabled fake product cards.

### Product creation constraint

No physical merch offer should be fabricated without user-provided or previously approved artwork. The current connected Fourthwall shop has zero offers, and Fourthwall requires artwork for normal on-demand product creation. This release therefore makes the fulfillment integration operational and honest, while keeping merch sales disabled until a real product exists.

## Billing Architecture

- Keep the $3 support contribution on Stripe-hosted checkout.
- Keep Corporate at $49/month on Stripe-hosted recurring checkout.
- Keep the existing Supabase Stripe webhook and Corporate entitlement provisioning.
- Keep legacy Vercel checkout/webhook endpoints retired with HTTP 410.
- Physical merch must not use those Stripe payment links once Fourthwall products go live; merch checkout belongs to Fourthwall so Fourthwall can own taxes, customer support, manufacturing, and fulfillment.

## Backend and Data Safety

- Existing Supabase project, RLS policies, Corporate entitlement enforcement, Community tables, and Stripe webhook remain intact.
- Rebrand changes must not rename tables/functions or break existing user data.
- Corporate access remains controlled by active billing entitlement.
- Community safety/moderation and crisis interception behavior remain unchanged.

## QA and Pipeline Contract

The existing test suite is extended rather than replaced.

Required gates before production promotion:

1. DOM binding audit passes with no missing IDs.
2. Brand contract test proves no stale `Root Lounge` user-facing copy remains in runtime files.
3. Liquid-glass accessibility contract verifies reduced-motion and readable fallback styles exist.
4. Browser smoke test verifies every primary nav item, GUI/Console switch, mode switch, theme switch, check-in controls, incident form, recovery controls, runbooks navigation, Funding actions, Settings actions, help/onboarding controls, Community entry, and Corporate CTA bind successfully.
5. Billing contract verifies Stripe support and Corporate links, legacy 410 routes, and entitlement provisioning contract.
6. Merch contract verifies Fourthwall provider URL is present, `merchProviderConfigured=true`, `merchFulfillmentReady=true`, `merchCheckoutEnabled=false` while the catalog is empty, and no physical Stripe checkout is exposed.
7. Supabase live smoke passes.
8. Production deep health returns `ok=true` with Supabase, Stripe, webhook, Corporate, and Fourthwall provider checks healthy.
9. Vercel production deployment reaches READY with no new runtime error group.

## Release Strategy

- Implement on branch `uptime-lounge-premium-launch`.
- Preserve current production until branch tests and a Vercel preview pass.
- Merge only after tests pass.
- Promote the verified build to production.
- Re-run public homepage, API config, deep health, legacy endpoint, Supabase, Stripe, Fourthwall shop, and runtime-log checks.

## Success Criteria

The release is complete when:

- Public brand is consistently Uptime Lounge.
- Premium glass/material system is deployed without hurting readability or mobile behavior.
- Fourthwall shop is correctly named and provider-ready.
- Empty merch catalog is represented honestly without a red health failure.
- Stripe support and Corporate paths still work.
- Supabase Community and Corporate backends still work.
- Every visible primary control is bound and covered by automated browser/DOM checks.
- Preview and production deployment checks are green.
