# Data model

Supabase Postgres is the shared source of truth.

| App collection | Supabase table | Purpose |
|---|---|---|
| `partners` | `partners` | Partner master, evidence, hard gates, scores |
| `partnerRisks` | `partner_risks` | Partner risk log |
| `deals` | `deals` | Commercial/deal terms and negotiation status |
| `market` | `market_benchmarks` | Market/UA benchmark by mechanic |
| `publisherLandscape` | `publisher_landscape` | Publisher benchmark registry |
| `games` | `games` | Game candidate intake + selection evidence |
| `sourcing` | `sourcing` | Sourcing funnel records |
| `projects` | `projects` | Publishing operation after deal |
| `audit` | `audit_logs` | Database insert/update/delete history |
| `settings/meta` | `app_config` | Application configuration |
| `playbook` | `playbook_configs` | Decision/gate framework configuration |

## Relationships

- `partner_risks.partner_id` → `partners.id`
- `deals.partner_id` → `partners.id`
- `deals.game_id` → `games.id`
- `sourcing.partner_id` → `partners.id`
- `sourcing.game_id` → `games.id`
- `projects.partner_id` → `partners.id`
- `projects.game_id` → `games.id`

## Roles

User role is stored in `profiles.role`: `admin`, `editor`, or `viewer`.

## Derived logic

Partner/Game/Publishing scores are calculated by the frontend from the structured source fields. The database stores the full record in each table's `data` JSONB column plus selected top-level columns for indexing and relationships.
