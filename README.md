# v0.41 — Làm rõ trọng số Growth

- Growth Score dùng 6 tín hiệu với **trọng số** rõ ràng: DL 3M/6M/12M = **25% / 15% / 10%** và Revenue 3M/6M/12M = **25% / 15% / 10%**. Đây là trọng số ưu tiên theo thời gian, **không phải điểm**.
- Mỗi tín hiệu chấm 1–5 theo percentile của chính cửa sổ; thiếu dữ liệu được loại khỏi mẫu số, không coi là 0.
- Growth chỉ hợp lệ khi có ≥2 tín hiệu và có ít nhất 1 DL + 1 Revenue.
- Monetization = 60% RPD + 40% Top100 Grossing Presence; thiếu một metric thì re-normalize.
- RPD không đi vào Growth để tránh double-count.
- Growth AUTO + Market Monetization AUTO của Game Selection đọc trực tiếp từ Phân tích thị trường; manual override vẫn ưu tiên nếu có evidence.
- Popup Cách tính Market Score hiển thị raw signal → score 1–5 → **trọng số (%)** → contribution; UI ghi rõ 25% / 15% / 10% là trọng số.
- Edit Market bổ sung Growth 6M/12M, Top100 Grossing và Confidence.
- Xu hướng 3M vẫn dùng rule matrix DL/Revenue song song, không lấy trung bình cộng.
- Không thay đổi Hard Gate, Pre-Scan threshold hay SAVA Fit.

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

## Làm rõ cách đọc trọng số Growth
- **3M = trọng số 25%** cho mỗi phía Downloads và Revenue.
- **6M = trọng số 15%** cho mỗi phía.
- **12M = trọng số 10%** cho mỗi phía.
- Dữ liệu gần hiện tại được ưu tiên cao hơn; thiếu metric thì bỏ khỏi mẫu số và tự chuẩn hóa lại trọng số, không coi là 0.


## v0.42 · Recalculate Game Market Score
- Game Market Score no longer keeps old AUTO snapshots for market-owned inputs.
- Market Size, Growth, Market Monetization and UA AUTO are recalculated live from Phân tích thị trường.
- Entry Accessibility remains owned by Competition.
- Any manual Override remains authoritative and is shown in the score drill-down.
- Therefore a change to Market data/formula immediately flows to Game Market Score and Pre-Scan after refresh.
