# Root Lounge mobile wrappers

App name: Root Lounge
Bundle/package ID: `com.stormandme.rootlounge`
Current production host: `https://root-lounge.vercel.app/`
Planned custom domain: `https://rootlounge.app/`

The Android and iOS wrappers add native share, haptic feedback, connectivity state, external-link handling, local notification hooks, native navigation controls, and packaged runtime gates around the Root Lounge social experience.

Store signing is intentionally separate from source/runtime QA. Android Play upload signing and Apple App Store signing must use persistent account-owned credentials, never ephemeral CI keys.
