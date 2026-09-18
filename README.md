# v0.39 — Tách ngưỡng màu Market Score và SAVA Fit

Bản này sửa rule màu tại **Lựa chọn trò chơi** để hai loại score không còn dùng chung một ngưỡng.

## Rule màu mới

### Thị trường /100
- **≥75** → xanh: **Thị trường mạnh**
- **55–74.9** → cam: **Cần kiểm chứng**
- **<55** → đỏ: **Thị trường yếu**
- Thiếu dữ liệu → xám

### Phù hợp SAVA /100
- **≥80** → xanh: **Phù hợp cao**
- **60–79.9** → cam: **Phù hợp có điều kiện**
- **<60** → đỏ: **Phù hợp thấp**
- Thiếu dữ liệu → xám

## Phạm vi áp dụng
- Bảng Game decision pipeline.
- Thanh điểm và label dưới score.
- Popup cấu thành Market Score.
- Popup cấu thành SAVA Fit.
- Hồ sơ Game Quick View.
- Legend giải thích màu ngay trên bảng được tách thành 2 dòng rule riêng.

## Không thay đổi logic quyết định

Màu chỉ giúp đọc chất lượng **từng score**. Quyết định Pre-Scan vẫn dùng công thức trong workbook: Market 45% · Publishing Readiness 20% · Deal Economics 20% · SAVA Fit 15%, cùng Hard Gate. Không dùng màu của một score đơn lẻ để suy ra Proceed/Stop.

Không cần migration SQL.
