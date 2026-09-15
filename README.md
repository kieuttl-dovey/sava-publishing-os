# SAVA Publishing OS

A lightweight GitHub Pages tool that turns the current publishing spreadsheets into one operating workspace for **Partner Selection, Deal Making, Market Intelligence, Game Selection, Sourcing, and Publishing Operation**.

## What is included

- **Dashboard**: portfolio counts, sourcing funnel, game recommendations, partner decisions, active project gates, and recent activity.
- **1. Partner Selection**: partner master, six hard gates, evidence coverage/confidence, weighted Partner Fit score, classification, and risk log.
- **2. Deal Making**: commercial terms, Rev Share, MG/upfront, recoup, rights/control, contract gates, and editable negotiation fields.
- **3. Market Intelligence**: mechanic market table from the current workbook plus an editable Publisher Landscape. The publisher landscape starts empty where the source workbooks do not contain structured benchmark data.
- **4. Game Selection**: intake, Market Fit, Product Evidence, Publishing Readiness, Deal Economics, SAVA Publishing Fit, Pre-Scan/Post-Test score, hard-gate logic, and recommendation.
- **5. Sourcing**: Lead → Qualified → Evaluation → Test → Deal → Launch → Scale board and conversion summary.
- **6. Publishing Operation**: project registry, SOP stage, Hybrid IAP / Hybrid IAA gate review, KPI checks, and next actions.

## Source logic retained

The seed database is built from the three supplied workbooks:

- `SAVA_Mobile_Game_Decision_Pub(3)_UPDATED_SCORES_SAFE (3).xlsm`
- `Publishing_Partner_Selection_Playbook (1).xlsx`
- `Publishing_Launching_1 (1).xlsx`

Important rules kept in the web tool include:

- Partner hard gates cannot be overridden by score.
- Partner Fit weights: Track Record 10, Team 15, Production & Execution 15, Data & Tech 10, Collaboration 15, Strategic Fit 15, Long-term 10; normalized to 100.
- Game Selection has separate Pre-Scan and Post-Test scores and keeps the workbook's hard-gate / completeness / recommendation thresholds.
- Publishing Operation keeps the existing Product Test, Monetization, Expansion, and Scale logic for Hybrid IAP and Hybrid IAA.

## Run locally

Because the app reads `data/db.json`, serve the folder through a small local HTTP server instead of double-clicking the file.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

> **Internal-data warning:** the seeded database contains business information from the supplied workbooks. Before deploying, confirm that your GitHub Pages access is appropriate for internal data. If the site is public, do not publish the seeded `data/db.json` / `data/seed.js`. See `docs/SECURITY.md`.

1. Create a GitHub repository.
2. Upload the **contents of this folder** to the repository root.
3. In GitHub, go to **Settings → Pages**.
4. Choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Open the GitHub Pages URL after the deployment completes.

No build step or package install is required.

## Team editing / GitHub Sync

The browser always autosaves edits to `localStorage`. For shared data, click **GitHub Sync**.

Each team member should:

1. Create a **fine-grained GitHub token** limited to this repository with **Contents: Read and write**.
2. Open **GitHub Sync** in the app.
3. Enter repository owner, repository name, branch (`main` by default), and `data/db.json` as the data path.
4. Paste the token. It is stored only in the browser's `sessionStorage`; it is not written to the repository database.
5. **Pull latest from GitHub before editing/pushing.**
6. After reviewing local changes, use **Commit current data to GitHub**.

The tool uses the GitHub file SHA from the latest Pull. If another teammate commits first, GitHub rejects the stale update instead of silently overwriting it.

### Collaboration model

This version is intentionally GitHub-native and has no backend. It is suitable for asynchronous team editing and auditable file history, but it is **not real-time simultaneous editing**. If the team later needs permissions, comments, live collaboration, or row-level history, the same UI/data model can be moved to Supabase/Firebase without redesigning the operating framework.

## Backup / restore

- **Export JSON** downloads the current database.
- **Import JSON** restores a database into the browser.
- `data/db.json` is the shared GitHub copy.
- `data/seed.js` is the packaged fallback if the app cannot fetch the JSON file.

## Data model

See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) and [`docs/SOURCE_MAPPING.md`](docs/SOURCE_MAPPING.md).
