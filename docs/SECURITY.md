# Security notes

This repository is designed for internal publishing operations and its seeded database contains business information derived from the supplied workbooks.

## Before publishing with GitHub Pages

**Do not assume that a GitHub Pages URL is private just because the repository is private.** Check your organization's GitHub Pages access settings before deploying internal data.

If the Pages site or repository is publicly accessible, do not publish the seeded `data/db.json` / `data/seed.js` containing internal partner, deal, game, or market information.

## GitHub token handling

- Use a **fine-grained** personal access token scoped only to the data repository.
- Grant only **Contents: Read and write** where possible.
- The app stores the token in `sessionStorage`, not `localStorage` or `data/db.json`.
- Close the browser session when finished on a shared device.
- Never paste a token into source code, JSON, screenshots, or Git commits.

## Collaboration behavior

- Always **Pull latest** before editing/pushing.
- Push requires the SHA from the last Pull.
- A stale SHA causes GitHub to reject the write instead of silently overwriting a newer commit.
- Export JSON periodically if the database is business-critical.
