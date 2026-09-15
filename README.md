# SAVA Publishing OS v0.6 — Compact Partner Executive View

Internal publishing workspace for **Partner Selection, Deal Making, Market Intelligence, Game Selection, Sourcing, and Publishing Operation**.

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

For upgrading from v0.4, only these files changed and need to be uploaded over the existing repo files:

- `index.html`
- `app.js`
- `styles.css`
- `README.md`

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
