# v0.44 — One Source of Truth cho Market Score

## Sửa lỗi chính
- `Thị trường /100` trong **Lựa chọn trò chơi** không còn tự tính lại theo công thức 5 cấu phần cũ.
- Market Score giờ được tính **duy nhất tại Phân tích thị trường** và Game đọc lại nguyên điểm theo mechanic.
- Công thức Market nguồn: Quy mô **trọng số 30%** · Growth **25%** · Khả năng kiếm tiền **20%** · UA **15%**; thiếu cấu phần thì tự phân bổ lại trọng số trên dữ liệu có sẵn.
- Growth: DL 3M/6M/12M có trọng số **25%/15%/10%**; Revenue 3M/6M/12M có trọng số **25%/15%/10%**.
- Monetization: RPD **trọng số 60%** + Top100 Grossing Presence **40%**.
- CPI là input live của UA: chỉnh CPI tại Phân tích thị trường → UA percentile → Market Score → Game Market Score → Pre-Scan → Dashboard tự cập nhật khi Save/Refresh.
- `Entry Accessibility` vẫn giữ làm evidence phụ nhưng không còn tạo một Market Score thứ hai.
- Market override cũ ở Game được giữ trong record để truy vết nhưng không còn tham gia tính Market Score từ v0.44.

## Data ownership
**Phân tích thị trường sở hữu Market Score.** Lựa chọn trò chơi, Tìm kiếm cơ hội và Tổng quan chỉ đọc lại dữ liệu theo mechanic.

## Update từ v0.43
Ghi đè `app.js`, `index.html`, `README.md`. Không cần chạy SQL.

---


Đã rà lại toàn bộ 8 tab sau khi đổi công thức Growth/Market ở v0.42.

## Kết quả rà soát
- **Tổng quan:** dùng `marketAnalytics()` và `gameDerived()` live, nên P1/P2, Game có thể đi tiếp và Market map cập nhật theo công thức mới.
- **Lựa chọn đối tác:** không phụ thuộc Market/Growth; không thay logic.
- **Đàm phán & Thỏa thuận:** không dùng snapshot Market Score; không thay logic.
- **Phân tích thị trường:** Growth weighted-recency + Monetization RPD/Grossing tính live; công thức trên UI ghi rõ **Trọng số %**.
- **Lựa chọn trò chơi:** Market Size/Growth/Market Monetization/UA AUTO đọc live từ Phân tích thị trường; Market Score và Pre-Scan tự tính lại.
- **Tìm kiếm cơ hội:** sửa mapping mechanic để dùng cùng `mechanicNamesMatch()` như Game/Market, tránh tên alias làm rơi về fallback chiến lược.
- **Vận hành phát hành:** độc lập với Market Score; Gate/KPI giữ nguyên.
- **Tài liệu nguồn & Lịch sử thay đổi:** read-only/lineage; edit dữ liệu nguồn vẫn được audit theo record sở hữu.

## Hotfix trong v0.43
1. Tất cả công thức Growth hiển thị rõ `Trọng số 25% / 15% / 10%`, không còn số 25/15/10 đứng riêng dễ hiểu nhầm là điểm.
2. Market formula hiển thị `Trọng số 30% / 25% / 20% / 15%`.
3. Monetization hiển thị `Trọng số 60% RPD / 40% Top100 Grossing`.
4. Tìm kiếm cơ hội dùng cùng mapping mechanic alias với Phân tích thị trường/Lựa chọn trò chơi.

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
