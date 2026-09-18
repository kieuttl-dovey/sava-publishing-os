# v0.37 — Game drill-down & hồ sơ nhanh

## Lựa chọn trò chơi

Bảng Game được nâng từ bảng kết quả thành dashboard có thể drill-down:

- **Click Tên Game hoặc Game ID** → mở **Hồ sơ Game** dạng Quick View.
- Hồ sơ Game hiển thị thông tin Candidate, Studio/Partner, Mechanic, GEO, Monetization, Build stage, Owner, trạng thái luồng, Deal/Sourcing liên quan và link Store/Build/APK nếu đã có dữ liệu.
- **Click Partner/Studio đã map** → mở **Hồ sơ đối tác** nhanh, có Partner Fit, Tiềm lực sản xuất, Hard Gate, Risk, Deal term và các Game/Candidate liên quan.

## Tách rõ 2 loại score

- **Thị trường /100**: Cyan/Azure. Click để xem 5 cấu phần Market Score, trọng số, AUTO/Override, công thức và evidence thị trường.
- **Phù hợp SAVA /100**: Electric Blue/Indigo. Click để xem 7 tiêu chí SAVA Publishing Fit, cách quy đổi, coverage, confidence và evidence/override.

Hai score được giữ độc lập về ý nghĩa và màu sắc; không thay đổi scoring framework gốc.

## Đồng bộ score

Cột **Phù hợp SAVA /100** ngoài bảng dùng đúng **effective score**: Override (nếu có) → AUTO từ 7 tiêu chí. Vì vậy chỉnh Override trong Edit Game sẽ phản ánh ngay ra bảng và Pre-Scan.

## Cập nhật từ v0.36

Ghi đè 4 file:

- `app.js`
- `styles.css`
- `index.html`
- `README.md`

Không cần chạy SQL. Audit log v0.29 tiếp tục hoạt động cho các thay đổi dữ liệu.
