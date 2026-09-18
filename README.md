# SAVA Publishing OS v0.50 — Explicit Market Mapping & CPI Data Lineage

## File cần replace

Chỉ cần replace 2 file code sau trên repo hiện tại:

- `app.js`
- `index.html`

`README.md` là changelog/tài liệu đi kèm, không bắt buộc để app chạy nhưng nên commit cùng version để truy vết logic.

---

## Mục tiêu v0.50

Khóa lại **One Source of Truth cho Market Score** và loại bỏ các trường hợp một tab tự tạo điểm thị trường khi chưa map được Market Mechanic.

Luồng chuẩn:

`Phân tích thị trường (db.market)`  
→ `Market Score theo Mechanic`  
→ `Lựa chọn trò chơi / Game Market Score`  
→ `Pre-Scan`  
→ `Tổng quan / Dashboard`  
→ `Tìm kiếm cơ hội` chỉ đọc lại khi Lead đã map Market Mechanic.

Không tab downstream nào được tự dựng Market Score thứ hai.

---

## 1. Market Score — công thức đang dùng

### Market Score /100

`Market Score = 25% Quy mô + 20% Growth + 30% Monetization + 25% UA`

Nếu một cấu phần thiếu dữ liệu, cấu phần đó **không bị tính là 0**. Hệ thống tự chuẩn hóa lại trọng số trên các cấu phần còn dữ liệu.

### Quy mô /100

`Scale = 40% × Percentile(Downloads 30D) + 60% × Percentile(Revenue 30D)`

- Downloads 30D = độ rộng demand/volume.
- Revenue 30D = quy mô kinh tế tuyệt đối.
- Đây là percentile tương đối trong dataset, **không phải market share %**.
- RPD không nằm trong Scale.

### Growth

Trọng số raw Growth:

- DL Growth 3M: **25%**
- DL Growth 6M: **15%**
- DL Growth 12M: **10%**
- Revenue Growth 3M: **25%**
- Revenue Growth 6M: **15%**
- Revenue Growth 12M: **10%**

`25/15/10` là **trọng số**, không phải điểm.

### Monetization

`Monetization = 70% RPD Score + 30% Top100 Grossing Score`

- **RPD = Revenue per Download = Revenue / Downloads**.
- RPD đo giá trị kinh tế trên mỗi download, không phải raw download volume.
- Top100 Grossing đo mức hiện diện trong nhóm game doanh thu cao.

### UA

Không dùng percentile CPI chung giữa các genre.

Benchmark US hiện tại:

- **Puzzle:** CPI `$10–15` = vùng Trung bình / bình thường.
- **Tycoon / Simulation / Strategy / RPG-TD:** CPI `$4–6` = vùng Trung bình / bình thường.

CPI thấp hơn vùng benchmark → UA Score tăng dần.  
CPI cao hơn vùng benchmark → UA Score giảm dần.

**v0.50 thay đổi:** nếu mechanic chưa map được vào benchmark UA, hệ thống để **UA Score = thiếu dữ liệu** và Market Score tự chuẩn hóa trên các cấu phần còn lại. Không fallback sang percentile CPI chéo genre.

---

## 2. Phân biệt hai loại CPI

### CPI Median (Market)

- Owner: **Phân tích thị trường**.
- Ý nghĩa: benchmark CPI cấp mechanic/market.
- Dùng để tính **UA component của Market Score**.
- Khi cập nhật và Save Market:

`CPI Median (Market)`  
→ `UA Market Score`  
→ `Market Score`  
→ `Game Market Score`  
→ `Pre-Scan`  
→ `Dashboard / downstream snapshot`.

### Test CPI Actual

- Owner: **Vận hành phát hành / Product Test**.
- Ý nghĩa: CPI thực tế của một game/cohort test cụ thể.
- Dùng cho Product Test Gate.
- Không được tự động coi là CPI Median của market.

### Test CPI Benchmark

- Benchmark dùng riêng để đánh Product Test Gate.
- Tách biệt với CPI Median (Market).

UI v0.50 đã đổi tên các field để tránh nhầm ba khái niệm trên.

---

## 3. Fix mapping trong Tìm kiếm cơ hội

### Trước v0.50

Nếu Lead không map được tới record trong Phân tích thị trường, hệ thống có thể fallback từ `Genre` thành điểm chiến lược:

- đúng trọng tâm → 100
- liền kề → 60
- ngoài trọng tâm → 20

Điểm fallback này có thể trông giống một Market Score thật dù không có Market record.

### Từ v0.50

**Đã xóa hoàn toàn fallback 100/60/20 khỏi Market Alignment của Lead.**

Lead chỉ nhận Market Score khi:

1. đã link Game và Mechanic của Game map được với Market record; hoặc
2. BD chọn trực tiếp trường **Market Mechanic** trong Lead.

Nếu không map được:

- hiển thị **`Chưa map Market`**;
- Market Score = `—`;
- Screening action yêu cầu `link Game hoặc chọn Market Mechanic`;
- không tự suy ra điểm từ Genre mô tả.

`Genre` vẫn được giữ làm mô tả nhưng không còn tạo Market Score.

---

## 4. Mapping trong Lựa chọn trò chơi

Game vẫn map Market theo trường `Mechanic`.

- Map thành công + đủ dữ liệu → đọc đúng Market Score từ Phân tích thị trường.
- Map thành công nhưng Market chưa đủ dữ liệu → `Đã map · chưa đủ dữ liệu`.
- Không tìm thấy Market record → hiển thị **`Chưa map Market`** thay vì chỉ `—`.

Market Score không sửa trực tiếp tại Game.

---

## 5. Data ownership

| Dữ liệu | Owner | Downstream chỉ đọc |
|---|---|---|
| Downloads / Revenue / Growth / RPD / Top100 | Phân tích thị trường | Game, Dashboard, Sourcing |
| CPI Median (Market) | Phân tích thị trường | UA Market Score, Game, Pre-Scan, Dashboard |
| Market Score | Phân tích thị trường | Game, Pre-Scan, Dashboard, Sourcing |
| Game Mechanic | Lựa chọn trò chơi | dùng để map Market |
| Lead Market Mechanic | Tìm kiếm cơ hội | chỉ là khóa mapping, không tự tính Market Score |
| Test CPI Actual | Vận hành phát hành | Product Test Gate |
| Test CPI Benchmark | Vận hành phát hành | Product Test Gate |

---

## 6. Các tab đã được đồng bộ logic

- **Tổng quan:** đọc derived score / snapshot đã refresh từ nguồn.
- **Phân tích thị trường:** owner duy nhất của Market Score.
- **Lựa chọn trò chơi:** đọc Market Score theo Game Mechanic; hiện rõ `Chưa map Market` khi thiếu mapping.
- **Tìm kiếm cơ hội:** chỉ đọc Market Score khi có mapping hợp lệ; không fallback 100/60/20.
- **Vận hành phát hành:** field CPI được đổi thành `Test CPI Actual` và `Test CPI Benchmark` để tách khỏi market CPI.
- **Export / Supabase / GitHub:** derived snapshot vẫn được refresh trước khi persist/export theo logic đã khóa từ v0.45.

Các tab Partner / Deal không tự tính Market Score.

---

## 7. Files / version

- `app.js`: v0.50 logic + UI wording.
- `index.html`: cache bust `app.js?v=0.50`, `styles.css?v=0.50`.
- `README.md`: changelog và data lineage của v0.50.

Không cần replace `styles.css`, `supabase-data.js`, `supabase-config.js` hoặc seed để áp dụng patch này.
