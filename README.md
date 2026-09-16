# v0.35 — Market-Driven CEO Opportunity Map

Bản này sửa logic Tổng quan theo đúng mô hình Publishing: **chọn thị trường trước → sau đó đi tìm game/đối tác phù hợp**. Candidate/Partner/Execution không còn quyết định một market có được ưu tiên hay không.

## Thay đổi chính

### Dashboard TGĐ: Bản đồ cơ hội thị trường
Chart cũ **Market × Năng lực thực thi** được thay bằng:
- Trục X: **Sức hấp dẫn thị trường /100**
- Trục Y: **Phù hợp chiến lược SAVA /100**
- Kích thước bubble: **Revenue 30D**
- Màu bubble: **P1 → P5**
- Bubble đặc: đã có candidate/lead sourcing
- Bubble rỗng nét đứt: **chưa có candidate/lead** — đây là khoảng trống sourcing, không phải điểm trừ của market.

Góc trên phải giờ thể hiện đúng ý nghĩa: **market hấp dẫn + đúng hướng chiến lược SAVA**.

### Khoảng trống sourcing
Dưới chart có block **Khoảng trống sourcing**:
- liệt kê market chưa có candidate/lead phù hợp;
- ưu tiên hiển thị P1/P2 trước;
- click vẫn mở Market Intelligence để drill-down.

### P1–P5 không còn phụ thuộc Execution Fit
Đã loại **Năng lực thực thi / Execution Fit** khỏi rule xếp P1–P5.

Priority market hiện dựa trên:
1. Market Attractiveness
2. Trend / Economics
3. Strategic Fit

Execution Fit vẫn được giữ ở Market Intelligence để biết **SAVA đã có evidence thực thi/candidate đến đâu**, nhưng chỉ là downstream coverage.

### Priority Drill-down
Modal “Vì sao P1/P2/…” giờ tách rõ:
- tín hiệu dùng để xếp priority;
- coverage sau khi chọn market: Candidate, Lead sourcing, Partner/Studio đã map, Execution evidence;
- ghi rõ coverage **không dùng để nâng/hạ P1–P5**.

## Update từ v0.34
Ghi đè:
- `app.js`
- `styles.css`
- `index.html`
- `README.md`

Không cần chạy SQL. Database, Auth, Audit và dữ liệu hiện tại không thay đổi.
