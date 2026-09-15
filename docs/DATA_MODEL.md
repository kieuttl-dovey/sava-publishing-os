# Data model

The app stores one JSON database in `data/db.json`.

## Main collections

| Collection | Purpose | Main relationships |
|---|---|---|
| `partners` | Partner master, evidence, hard gates, scores | Referenced by deals and sourcing |
| `partnerRisks` | Partner risk log | `partnerId` → `partners.id` |
| `deals` | Commercial/deal terms and negotiation status | `partnerId`, optional `gameId` |
| `market` | Market/UA benchmark by mechanic | Used as reference for game selection |
| `publisherLandscape` | Editable Publisher Landscape | Independent benchmark registry |
| `games` | Game candidate intake + selection evidence | Can be referenced by deals, sourcing, projects |
| `sourcing` | Funnel records | Optional `partnerId` / `gameId` links |
| `projects` | Publishing operation after deal | Optional `gameId` / `partnerId` links |
| `audit` | Recent local/shared actions | Stores actor, time, action text |

## IDs

IDs are human-readable and editable. Keep them stable after a record is referenced elsewhere.

- Partner: `P001`, `P002`, ...
- Game candidate: source IDs such as `PUB-001`
- Deal: `DEAL-001`, ...
- Sourcing record: `SRC-001`, ...
- Project: `PRJ-001`, ...

## Derived fields

Scores and decisions shown in the UI are calculated at render time from source inputs. The app does not require users to manually type total scores.

### Partner Selection

- Hard Gate: fail / pending / pass based on six gate checks.
- Production Composite: average of Production Capacity, Development Cadence, Milestone Reliability, and LiveOps Scalability when complete.
- Evidence Coverage: eight evidence groups.
- Minimum Evidence Gate: requires passed Hard Gate plus required evidence statuses.
- Partner Fit Total: normalized weighted score.
- Classification and Final Conclusion are derived from the above.

### Game Selection

- Hard Gate combines Legal/IP, Build, Tracking, Store, Commercial Terms, and Rights.
- Pre-Scan combines Market, Publishing Readiness, Deal Economics, and SAVA Publishing Fit.
- Post-Test / Final Score adds Product Evidence.
- Recommendation follows hard gate, completeness, stage, and the source score thresholds.

### Publishing Operation

The current gate evaluator supports:

- Product Test
- Monetization Test
- Expansion
- Scale

and applies the source workbook's Hybrid IAP / Hybrid IAA thresholds.
