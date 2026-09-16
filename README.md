# v0.30 — Chỉ rõ nơi chỉnh dữ liệu nguồn

Bản này kế thừa toàn bộ v0.29 (sync Edit → bảng ngoài + Audit log) và bổ sung UX cho các dữ liệu dùng chung/read-only.

## Thay đổi chính

- Mọi field bị khóa do dữ liệu thuộc module khác sẽ có ghi chú ngay dưới field: **“Chỉ sửa tại …”**.
- Partner Selection: term thương mại khi đã link Deal sẽ ghi rõ **Chỉ sửa tại Deal Making · Deal ID** ở từng field, không chỉ ở banner phía trên.
- Market Intelligence: các block lấy từ Sourcing/Game Selection ghi rõ module sở hữu và nơi cần cập nhật dữ liệu nguồn.
- Sourcing: các block tham chiếu Partner/Market ghi rõ Hard Gate/Fit/Risk sửa ở Partner Selection, term thương mại sửa ở Deal Making, benchmark market sửa ở Market Intelligence.
- Deal Making và Game Selection: các chỉ số tự tính/read-only có note phân biệt rõ **tự tính** với **dữ liệu được chỉnh ở module nguồn**.
- Viewer mode: thông báo rõ tài khoản Viewer không thể sửa ở bất kỳ module nào; muốn chỉnh cần Editor/Admin.

## Audit

Không thay đổi schema hoặc SQL so với v0.29. Audit log v0.29 tiếp tục ghi mọi thay đổi dữ liệu.

## Update từ v0.29

Ghi đè:

- `app.js`
- `styles.css`
- `README.md`

Không cần chạy thêm SQL.
