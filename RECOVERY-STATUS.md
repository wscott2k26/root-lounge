# Root Lounge Recovery Status — 2026-08-25

## Confirmed live

- Production URL: https://root-lounge.vercel.app
- Root Vercel project ID: `prj_sru55k34glDNjBTa3qGmtFzs1YJt`
- Production deployment is READY.
- `/api/health` returns `ok: true`, version `3.1.1`.
- Supabase is configured in the live deployment.
- Stripe and the Stripe webhook are **not** currently configured; the live secret/webhook values are placeholders.

## GitHub recovery repository

- Repository: https://github.com/wscott2k26/root-lounge
- Visibility: public
- Owner: `wscott2k26`
- This repository is now the recovery/source-control home for Root Lounge.

## Frontend recovery

Production is split across several Vercel asset projects. The workflow `.github/workflows/recover-live.yml` runs `scripts/recover-live.mjs` from GitHub's runner, downloads the public production frontend, decodes the gzip/base64 HTML shell from `loader.js`, checks the recovered JavaScript syntax, and commits the recovered files under `recovered-live/`.

Known production assets:

- `app1.js` — root-lounge-assets-js1.vercel.app
- `app2.js` — root-lounge-assets-js2.vercel.app
- `app3.js` — root-lounge-assets-js3.vercel.app
- `styles.css` — root-lounge-assets-css.vercel.app
- `gui.js` — root-lounge-gui-js.vercel.app
- `gui.css` — root-lounge-gui-css.vercel.app

## Backend artifacts recovered

- `supabase/schema.sql` — recovered production schema
- Historical Stripe/Vercel setup kits remain preserved in the ChatGPT recovery package.

## Account mismatch discovered

The currently connected Stripe sandbox contains StormTerminal products, not the historical Root Lounge catalog. Do not copy the old Root Lounge `price_...` IDs into that account until the original Stripe account/context is identified.

The live Root Lounge config points to Supabase project ref `wfjkuajzkotihcpsxxgz`, but that project is not accessible through the currently connected Supabase session. Do not assume it was deleted; it may belong to another account or organization.

## Safe next step after frontend recovery

After the automated recovery commit lands, compare the recovered production files against this repository, promote the recovered app into a normal single-project structure, then link Vercel to GitHub without changing the live alias until a preview deployment passes QA.
