# SAVA Publishing OS v0.8 — Deal Making + BD Guidance

Internal publishing workspace for **Partner Selection, Deal Making, Market Intelligence, Game Selection, Sourcing, and Publishing Operation**.

## v0.8 changes — RS policy + hướng dẫn BD

- Deal Making now exposes the **SAVA / Partner Revenue Share matrix** directly: 50/50 pre-Soft Launch without support, 60/40 at Soft Launch+ without support, 70/30 for supported deals, and ~80/20 target for material support.
- UA tiers are shown next to the RS matrix: T1 70/30, T2 75/25, T3/T4 80/20, with T4 requiring management review.
- The **no-free-concession / Give-Get** principle is highlighted next to the RS policy.
- Deal Edit now contains collapsible **Hướng dẫn BD** blocks sourced from the workbook guidance in `02_DỮ_LIỆU_DEAL`, `03_ĐÀM_PHÁN`, and `04_MỐC_PHÊ_DUYỆT`.
- Guidance includes what to enter, how to interpret each field, examples, the 1–5 scoring quick guide, negotiation anchor/acceptable/stop definitions, term-by-term tips, milestone rules, and final approval checks.
- Color legend in the edit view mirrors the workbook meaning: blue = BD input, green = linked data, purple = derived/check, orange = review.


## v0.7 changes — Deal Making

The **Deal Making** module is rebuilt from `SAVA_Deal_Making_Playbook_Thuan_Viet_v14_Huong_Dan_03_04(1).xlsx`. The web keeps the workbook as the business-rule source of truth while presenting it as an executive operating flow.

### Executive Deal register

Each Deal now shows:

- Partner / Game, status and Game stage
- **Mức sẵn sàng /100**
- **Rủi ro Deal /100** and risk band
- SAVA support level and recommended Deal direction
- RS **ngưỡng / hiện tại / mục tiêu**
- UA tier and monthly UA commitment
- Maximum investment capacity and proposed initial commitment
- Auto decision and next action

### Source workbook logic implemented

- Deal Risk /100: Partner 15% · Game evidence 25% · SAVA risk tolerance 20% · Deal competition 10% · bargaining power 10% · protection 20%.
- Readiness /100: Partner 20% · Game evidence 30% · strategic value 15% · bargaining 10% · protection 15% · inverse risk tolerance 10%.
- Risk bands: `<30 Thấp`, `30–49 Trung bình`, `50–69 Cao`, `≥70 Rất cao`.
- Revenue Share floor: 50% before Soft Launch with no support; 60% at Soft Launch+ with no support; 70% for supported deals; material support targets 80%.
- UA tiers: T1 `≤$10K/month → 70% target`, T2 `≤$30K → 75%`, T3 `≤$100K → 80%`, T4 `>$100K → 80% / management review`.
- Initial commitment by stage: Concept 10% · Prototype 15% · MVP 25% · Full Game 30% · Soft Launch 40% · Live/Scale 60%.
- High SAVA risk tolerance `≥4` requires protection `≥4`.
- Hard Gate, RS floor, protection, risk and capital checks override readiness in the final recommendation.

### Negotiation workspace

The Deal modal now mirrors the workbook negotiation structure:

- Điều khoản
- auto-generated **Logic / Mặc định SAVA**
- Tham chiếu thị trường
- Mục tiêu / Mức chấp nhận / Ngưỡng dừng
- Yêu cầu Partner / Kết quả cuối
- Giá trị đổi lại nếu nhượng bộ
- Auto-check for final SAVA Revenue Share
- Ghi chú

The 10 workbook term types are pre-created for a Deal that has not yet entered negotiation data.

### Milestone & final approval

- Default stages: Ký kết / Thiết lập → Test / Prototype → Soft Launch / Xác thực → Scale / Commercial.
- Fields include KPI/pass condition, capital unlocked, Partner obligation, fail action, SAVA right, owner, status and notes.
- Final approval tracks Data / IP / Exit, final RS, signing conditions, open risks, approver and decision date.

### Publisher references

The evidence-backed reference cases in the source workbook are available in Deal Making for Supersonic, Homa, SayGames, AppQuantum, Tilting Point and Voodoo. The app does not infer unpublished economics from these references.

### Supabase

No SQL migration is required. New Deal fields are stored inside the existing `deals.data` JSON and Deal rule parameters use the existing `playbook_configs` table. `supabase-data.js` is updated so the `dealMaking` playbook config syncs across the team.

This version uses **Supabase Auth + Postgres** as the shared source of truth. GitHub Pages only hosts the static frontend.

## v0.6 changes

- Compact Partner Master table to reduce horizontal scrolling.
- Combine Deal model + Partner fee into **Hợp tác** and UA commitment + condition into **UA** while keeping **SAVA / Đối tác** separate.
- Score bars now use the original Partner Selection workbook thresholds: **≥85 Ưu tiên, ≥75 Đạt, ≥65 Có điều kiện, <65 Cần xem xét**.
- Partner Fit follows those rules exactly; Production Potential uses the same visual bands for consistent /100 reading because the source workbook does not define a separate Production Potential /100 classification.
- Added score legend and compact two-line cells/tooltips for long commercial text.

## v0.5 changes

### Partner Selection

The Partner master table is rebuilt for executive review. It now prioritizes:

- Đối tác / quốc gia / quy mô team
- Thể loại chính
- Giai đoạn
- **Tiềm lực sản xuất /100**
- **Mức độ phù hợp /100**
- Mô hình hợp tác
- Phí đối tác
- **SAVA / Đối tác** revenue share
- Cam kết UA
- Điều kiện UA
- Rủi ro
- Kết luận
- Hành động tiếp theo

The previous Coverage / Confidence / Hard Gate columns remain available in Partner detail instead of occupying the executive master view.

### Production Potential

Each Partner now has a dedicated **Tiềm lực đội sản xuất** section, scored on a 0–100 scale across six dimensions:

1. Năng lực team
2. Chất lượng sản phẩm
3. Tốc độ sản xuất
4. Năng lực kỹ thuật
5. Khả năng LiveOps
6. Khả năng mở rộng

The overall Production Potential score is the average of available dimensions. Existing legacy scores on the old 1–5 scale are automatically interpreted as /100 so current records remain compatible.

### Partner scoring

Partner score inputs are now presented as **/100** in the UI. Existing 1–5 values are automatically normalized when opened, so the current database does not need a migration.

### Partner detail layout

Partner detail now starts with an executive summary, then separates:

- Thông tin đối tác
- Thông tin hợp tác & UA
- Tiềm lực đội sản xuất
- Hard Gate
- Bằng chứng & trạng thái xác minh
- Điểm đánh giá /100
- Risk Register riêng theo Partner
- Quyết định tự động + chỉnh sửa thủ công

### SAVA visual system

The web UI now follows the supplied SAVA visual reference:

- **Roboto** for body/UI text
- **Space Grotesk** for headings and display text
- Electric Blue `#0741E1`
- Azure `#0078D7`
- Cyan `#00AFF0`
- Iris `#EDECFF`
- Void `#03041C`
- Ink `#3A3A50`
- Slate `#6F6C8F`
- Mist `#A0A3BD`

The UI uses the blue system primarily for actions, hierarchy and focus states, with neutral colors for dense data views.

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

The publishable key is intended for frontend use. Security is enforced by Supabase Authentication and Row Level Security.

Never put these values in frontend source:

- `service_role` key
- Supabase secret key
- database password

## Deploy to GitHub Pages

### Upgrade from v0.6 to v0.7

Upload/replace these **5 files** in the current GitHub repo:

- `index.html`
- `app.js`
- `styles.css`
- `supabase-data.js`
- `README.md`

Do **not** upload anything to Supabase and do not run a SQL migration for this version.

Then wait for GitHub Pages to redeploy and hard-refresh the site once.

For a clean deployment:

1. Upload the contents of this folder to the repository root.
2. In GitHub, open **Settings → Pages**.
3. Choose **Deploy from a branch** → `main` → `/ (root)`.
4. Open the generated Pages URL.
5. Sign in with a user already created under Supabase **Authentication → Users**.

No build step or package installation is required.

## Security model

The deployable repository contains no seeded internal partner/game/deal database. Business records remain in Supabase behind login + RLS.

The files under `data/` are empty fallbacks and do not contain the migrated internal records.
