# v0.38 — Màu điểm theo chất lượng tín hiệu

## Lựa chọn trò chơi

UI của **Thị trường /100** và **Phù hợp SAVA /100** được chỉnh theo feedback sử dụng thực tế:

- **Loại điểm được phân biệt bằng tên/label**, không khóa bằng một màu cố định.
- **Màu của điểm thể hiện chất lượng tín hiệu**:
  - **>75** → xanh: **Tín hiệu tốt**
  - **60–75** → cam: **Cần kiểm chứng**
  - **<60** → đỏ: **Cần xem xét**
  - thiếu dữ liệu → xám
- Áp dụng đồng nhất tại:
  - bảng Game decision pipeline;
  - popup cấu thành Market Score;
  - popup cấu thành SAVA Fit;
  - Hồ sơ Game Quick View.
- Dòng hướng dẫn trên bảng có legend màu rõ ràng để người xem không hiểu màu là loại score.

## Không thay đổi logic chấm điểm

v0.38 chỉ thay **cách thể hiện UI/UX**. Công thức Market Score, SAVA Publishing Fit, Pre-Scan, Product Evidence và Hard Gate vẫn giữ nguyên theo workbook/source logic hiện tại.

Ngưỡng màu dùng để giúp scan nhanh chất lượng tín hiệu của từng score; quyết định cuối vẫn phải đọc cùng Hard Gate, Pre-Scan và evidence.

## Cập nhật từ v0.37

Ghi đè 4 file:

- `app.js`
- `styles.css`
- `index.html`
- `README.md`

Không cần chạy SQL. Audit log hiện tại tiếp tục hoạt động.
