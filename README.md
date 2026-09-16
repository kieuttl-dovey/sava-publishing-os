# v0.32 — Executive Drill-down System

Bản này kế thừa v0.31 và chuẩn hóa UX **click vào score / decision để xem “vì sao ra kết quả này”** ở các điểm quan trọng nhất của Publishing OS.

## Drill-down mới

### Market Intelligence
- **Sức hấp dẫn /100** → xem breakdown 4 nhóm: Quy mô, Đà tăng trưởng, Khả năng kiếm tiền, UA; hiển thị trọng số hiệu lực, contribution vào tổng điểm và raw evidence.
- **P1 / P2 / P3 / P4 / P5** → xem rule nào đang kích hoạt, điều kiện đạt/chưa đạt, Trend 3M, Market Score, Strategic Fit, Execution Fit, Monetization và UA.
- Giữ nguyên drill-down **Năng lực thực thi /100 → Candidate/Game** từ v0.31.

### Partner Selection
- **Phù hợp /100** → xem 7 nhóm tạo nên Partner Fit, trọng số, contribution, Evidence coverage, confidence, Hard Gate, Risk và kết luận.

### Deal Making
- **Rủi ro /100** → xem 6 nhóm rủi ro theo đúng weight playbook: Partner, Game Evidence, Risk Tolerance, Competition, Bargaining, Protection; hiển thị contribution vào tổng Deal Risk.

### Publishing Operation
- **Gate hiện tại** và **Decision** → xem KPI thực tế vs PASS rule, trạng thái từng metric, rule IAP/IAA, saved decision, auto-evaluate, reviewer và next action.

## UX chuẩn hóa
- Các giá trị có drill-down đều có hint `↗` và hover state thống nhất.
- Modal dùng chung cấu trúc: **Kết quả → Breakdown / KPI → Evidence / Source → Decision → Action**.
- Drill-down là read-only; nút action đưa người dùng tới đúng module/record sở hữu dữ liệu để sửa.
- Không tạo field mới, không đổi công thức score và không đổi database schema.
- Audit log v0.29 tiếp tục hoạt động cho mọi thay đổi khi user mở record và Save.

## Update từ v0.31

Ghi đè:

- `app.js`
- `styles.css`
- `index.html`
- `README.md`

Không cần chạy SQL.
