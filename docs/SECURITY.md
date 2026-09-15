# Security notes — Supabase Team Edition

## What GitHub Pages contains

The GitHub Pages repository contains only the static frontend. The deployable repository intentionally does **not** contain the migrated partner, deal, game, sourcing, project, or market dataset.

`data/db.json` and `data/seed.js` are empty fallback structures only.

## Supabase keys

The frontend contains:

- Supabase project URL
- Supabase **publishable key**

These values are designed to be used by browser clients. They do not bypass Row Level Security.

Never commit or expose:

- `service_role` key
- secret key
- database password
- user passwords

## Authentication and authorization

The application requires a Supabase Auth session before business data is loaded.

Database access is enforced by Row Level Security:

- `admin`: read/write/delete
- `editor`: read/write
- `viewer`: read-only

New Auth users default to `viewer` and should be promoted deliberately by an Admin.

## Static-site visibility

A login screen does not make the static GitHub Pages source private. Therefore no confidential business records should ever be committed into the frontend repository. Confidential records belong in Supabase.

## Operational recommendations

- Use work email accounts for team members.
- Disable/delete Auth users when they leave the team.
- Grant the lowest role needed.
- Review `audit_logs` for sensitive changes.
- Export periodic backups if the database becomes business-critical.
