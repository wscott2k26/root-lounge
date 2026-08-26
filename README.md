# Uptime Lounge

> Formerly developed under the internal project name `root-lounge`. Internal repo, storage, migration, and deployment identifiers remain unchanged intentionally.

Uptime Lounge is a dual-interface decompression workspace for SysAdmins, SREs, developers, and IT teams.

**Live production:** https://root-lounge.vercel.app

This repository was rebuilt from the surviving production deployment and recovery artifacts after the original source repository was no longer available.

## Recovery status

The current production frontend is split across several Vercel asset projects. The GitHub workflow in `.github/workflows/recover-live.yml` retrieves those public production assets, decodes the real HTML shell stored inside `loader.js`, verifies JavaScript syntax, and commits the recovered files into `recovered-live/`.

The recovery process intentionally retrieves **public application assets only**. It does not extract private Stripe, Supabase service-role, or Vercel credentials.

## Current app capabilities

- GUI and Console interfaces sharing one application state
- Anonymous/local operator telemetry
- Incident vent board with support patches
- Recovery-room chat
- 60-second breathing reset
- Five-minute focus timer
- Shift-handoff builder
- Runbook library
- Community and corporate workspace modes
- Supabase-ready anonymous auth, persistence, RLS, and realtime
- Server-side Stripe Checkout/webhook architecture when billing is configured

## Important directories

- `recovered-live/` — byte-for-byte public frontend recovered from production by GitHub Actions
- `scripts/recover-live.mjs` — recovery script
- `supabase/schema.sql` — recovered Uptime Lounge production schema
- `recovery/` — historical setup/recovery material

## Billing safety

Do not commit secret keys. Uptime Lounge must keep `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` in server-side environment variables only.

The currently connected Stripe context should not be assumed to be the original Uptime Lounge billing account. Verify the intended Stripe account before changing live billing configuration.
