# Source mapping

This document shows how the three input workbooks were consolidated into the six modules requested for the operating tool.

## 1. Partner Selection

**Primary source:** `Publishing_Partner_Selection_Playbook (1).xlsx`

Mapped from:
- `01_Partner_Master`
- `02_Hard_Gate`
- `03_Evidence`
- `04_Scorecard`
- `05_Decision`

The app retains partner master data, evidence, hard gates, Partner Fit scoring, final decision logic, and risk log.

## 2. Deal Making

**Primary sources:**
- `SAVA_Mobile_Game_Decision_Pub(3)_UPDATED_SCORES_SAFE (3).xlsm` → `07_PUBLISHING_INTAKE`
- `Publishing_Partner_Selection_Playbook (1).xlsx` → commercial fields in Partner Master / evidence

Seeded fields include Publisher/Studio Share, SAVA test budget, MG/upfront, recoup flag, rights/control dimensions, commercial/rights gates, contract link, and deal confidence. Additional negotiation fields are editable in the web tool so the playbook can expand without changing workbook structure.

## 3. Market Intelligence + Publisher Landscape

**Primary source:** `SAVA_Mobile_Game_Decision_Pub(3)_UPDATED_SCORES_SAFE (3).xlsm`

Mapped from market/UA benchmark sheets such as:
- `02_MECHANIC_MARKET`
- `05_UA_BENCHMARK`

The source files do not provide a complete structured Publisher Landscape covering what every publisher is currently seeking, testing, investing, and dealing. The web module is therefore created but intentionally not pre-filled with invented benchmark data.

## 4. Game Selection

**Primary source:** `SAVA_Mobile_Game_Decision_Pub(3)_UPDATED_SCORES_SAFE (3).xlsm`

Mapped from:
- `07_PUBLISHING_INTAKE`
- `10_SCORECARD`
- market, UA, prototype, and gamefeel evidence sheets where available

The web app calculates Market Fit, Product Evidence, Publishing Readiness, Deal Economics, SAVA Publishing Fit, Pre-Scan, Final Score, Hard Gate, and Recommendation.

## 5. Sourcing

**Sources:** candidate/game and partner master data from the existing workbooks.

The requested standard funnel — Lead → Qualified → Evaluation → Test → Deal → Launch → Scale — does not exist as a complete historical event table in the three source workbooks. Existing candidate/project records are seeded where they can be mapped, and the module is designed for the team to start tracking stage conversion consistently from now on.

## 6. Publishing Operation

**Primary source:** `Publishing_Launching_1 (1).xlsx`

Mapped from:
- `Tổng quan`
- `Publishing scope`
- `2 luồng Publishing`
- `Publishing flow`
- `Hybrid IAP Game`
- `Hybrid IAA Game`
- `KPI reference`
- `Publishing projects`

The web app keeps the overall G0 → G1 → P0 → Product Test → Monetization → Expansion → Scale operating flow and the current Hybrid IAP / Hybrid IAA gate logic.
