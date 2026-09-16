# v0.34 — CEO Market Coverage & Mechanic Mapping

Bản này sửa bubble chart **Dòng game: Market × Năng lực thực thi** để không còn chỉ hiện những mechanic đã có đủ cả Market Score và Execution Fit.

## Thay đổi chính

### Hiển thị toàn bộ mechanic
- Mọi mechanic có **Market Score** đều xuất hiện trên chart.
- Mechanic chưa có **Execution Fit** vẫn xuất hiện bằng **bubble rỗng** ở dải “Chưa có evidence thực thi”; hệ thống không tự quy thiếu dữ liệu thành 0.
- Mechanic chưa đủ **Market Score** được liệt kê riêng ở nhóm “Thiếu dữ liệu Market” thay vì biến mất.
- Bỏ giới hạn 14 bubble.
- Legend hiển thị đủ **P1 / P2 / P3 / P4 / P5** và trạng thái chưa có Execution evidence.

### Mapping Market ↔ Game Selection
Bổ sung chuẩn hóa tên mechanic giữa hai module để các tên tương đương không bị mất liên kết, ví dụ:
- Merge / Merge ...
- Idle RPG / AFK Progression
- Tower Defense / Defense RPG / RPG-TD
- Arrow / Archer
- Logic / Brain
- Tycoon / Economy Management

Vẫn ưu tiên match chính xác trước; alias chỉ dùng cho các nhóm mechanic tương đương rõ ràng.

### UX
- Label luôn hiện cho opportunity ưu tiên / execution cao; các bubble còn lại hiện tên khi hover để chart không bị chồng chữ.
- Có chip danh sách những mechanic chưa có execution evidence để TGĐ nhìn ra ngay khoảng trống sourcing/candidate.
- Click bubble/chip vẫn mở Market drill-down như trước.

## Update từ v0.33
Ghi đè:
- `app.js`
- `styles.css`
- `index.html`
- `README.md`

Không cần chạy SQL. Database, Auth và Audit không thay đổi.
