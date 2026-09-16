# v0.33 — CEO Visual Executive Dashboard

Bản này redesign tab **Tổng quan** dành cho Tổng Giám Đốc theo hướng **ít chữ, nhiều chart, nhìn nhanh và drill-down được**.

## Dashboard mới

### KPI strip
6 KPI điều hành, click để đi thẳng tới module sở hữu dữ liệu:
- Cơ hội thị trường P1/P2
- Lead đang xử lý
- Partner sẵn sàng
- Game có thể đi tiếp
- Deal active
- Project sau Deal

### Dòng game: Market × Năng lực thực thi
Bubble chart:
- X = Sức hấp dẫn thị trường /100
- Y = Năng lực thực thi SAVA /100
- Kích thước bubble ~ Revenue 30D
- Màu bubble = P1 / P2 / P3...
- Click bubble → drill-down Market Intelligence

### Top Partner
Horizontal ranking theo Partner Fit /100, có thêm Production Potential và cảnh báo risk cao. Click Partner → mở Partner Selection.

### Deal Term · Revenue Share
100% stacked bar hiển thị tỷ lệ **SAVA / Partner** theo term đang hiệu lực; kèm Deal Risk. Click row → mở Deal Making.

### Publishing Funnel
Visual conversion từ **Lead → Qualified → Evaluation → Deal → Test → Launch → Scale**. Tự highlight bottleneck có conversion thấp nhất.

### Portfolio sau Deal
Roadmap compact cho từng project từ P0 → Product Test → Monetization → Expansion → Scale. Màu node phản ánh completed/current/hold/fail/future. Click project → mở Publishing Operation.

### Cần TGĐ xem
Chỉ giữ các blocker/risk/gate quan trọng, tối đa 6 alert, click để vào đúng module.

## Logic / dữ liệu
- Không tạo field mới.
- Không đổi formula Market / Partner / Deal / Sourcing / Operation.
- Chart đọc trực tiếp dữ liệu hiện tại từ Supabase qua cùng data layer.
- Audit v0.29 và drill-down v0.32 giữ nguyên.

## Update từ v0.32
Ghi đè:
- `app.js`
- `styles.css`
- `index.html`
- `README.md`

Không cần chạy SQL.
