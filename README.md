# SAVA Publishing OS v0.2 — Supabase Team Edition

A lightweight internal publishing workspace for **Partner Selection, Deal Making, Market Intelligence, Game Selection, Sourcing, and Publishing Operation**.

This version uses **Supabase Auth + Postgres** as the shared source of truth. GitHub Pages only hosts the static frontend.

## What is included

- **Dashboard**: portfolio counts, sourcing funnel, game recommendations, partner decisions, active project gates, and recent database activity.
- **1. Partner Selection**: partner master, hard gates, evidence coverage/confidence, weighted Partner Fit score, decision, and risk log.
- **2. Deal Making**: Rev Share, MG/upfront, recoup, rights/control, KPI, responsibilities, exit/stop conditions, and negotiation fields.
- **3. Market Intelligence**: mechanic/UA benchmark plus editable Publisher Landscape.
- **4. Game Selection**: intake, Market Fit, Product Evidence, Publishing Readiness, Deal Economics, SAVA Publishing Fit, Pre-Scan/Post-Test score, hard-gate logic, and recommendation.
- **5. Sourcing**: Lead → Qualified → Evaluation → Test → Deal → Launch → Scale board and conversion summary.
- **6. Publishing Operation**: project registry, SOP stage, Hybrid IAP / Hybrid IAA gate review, KPI checks, and next actions.

## Team collaboration

Users sign in with Supabase email/password accounts.

Roles:

- **Admin**: read/write/delete, full database import, user-role administration through Supabase.
- **Editor**: read/write business records; destructive deletes are blocked by RLS.
- **Viewer**: read-only.

The browser saves edits to Supabase. The app also refreshes from the shared database every 60 seconds while visible and provides a manual **Refresh** button.

## Supabase configuration

The frontend reads the project configuration from `supabase-config.js`:

```js
window.SAVA_SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  publishableKey: 'YOUR_PUBLISHABLE_KEY'
};
```

The **publishable key is intended for frontend use**. Security is enforced by Supabase Authentication and Row Level Security.

Never put these values in frontend source:

- `service_role` key
- Supabase secret key
- database password

## Deploy to GitHub Pages

1. Upload the **contents of this folder** to the repository root.
2. In GitHub, open **Settings → Pages**.
3. Choose **Deploy from a branch** → `main` → `/ (root)`.
4. Open the generated Pages URL.
5. Sign in with a user already created under Supabase **Authentication → Users**.

No build step or package installation is required.

## Security model

GitHub Pages serves static files publicly in many setups, so this deployment package intentionally contains **no seeded partner/game/deal database**. The original workbook-derived records now live in Supabase behind login + RLS.

The files under `data/` are only empty fallbacks and do not contain the migrated internal records.

See `docs/SECURITY.md` for details.

## Backup / restore

- **Export** downloads the current in-memory database as JSON.
- **Import** is available to Admin users and syncs the imported records to Supabase.
- Supabase remains the shared source of truth.

## Source framework

The operating logic was consolidated from the three supplied publishing workbooks. The database migration/seed SQL was already run separately in Supabase and is intentionally **not included in this deployable repository**, so publishing the frontend does not expose the seeded business data.
