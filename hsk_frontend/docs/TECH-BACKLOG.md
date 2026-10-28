# Backlog kỹ thuật (frontend) — không thuộc milestone tính năng

Quyết định của chủ dự án (M4A): **giữ nguyên** 22 `overrides` và build **Webpack** đang ổn định; không dành milestone tính năng để tối ưu hạ tầng. Các mục dưới đây chỉ là hàng đợi.

| # | Mục | Mô tả / bằng chứng hiện có | Ưu tiên | Điều kiện làm |
|---|---|---|---|---|
| T1 | Rà soát 22 `overrides` của dependency | `docs/M3B4-ADMIN-NOTIFICATIONS.md` mục 8: chỉ `@rc-component/trigger` 2.2.6 được **chứng minh** cần (popup lịch lệch 1px khi bỏ); 21 gói còn lại là ghim phòng ngừa theo lockfile cũ, đều nằm trong dải semver của `antd@5.23.0`. Giảm bớt cần thí nghiệm theo nhóm (bỏ nhóm → build → `css-fidelity` + so ảnh popup/bảng với HSK cũ) | Thấp | Khi có thời gian riêng; không đổi độ chính xác giao diện để giảm số lượng |
| T2 | Chính sách xem xét bản vá của gói bị ghim | Gói ghim ở đầu thấp dải semver không tự nhận bản vá | Thấp | Định kỳ (vd. mỗi quý) hoặc khi có cảnh báo bảo mật |
| T3 | Quay lại Turbopack? | Build/dev dùng webpack vì Turbopack (lightningcss) làm rơi `.shadow-sm !important` (`docs/M3B2-WELCOME.md` mục 8). Không phải quyết định vĩnh viễn | Thấp | Khi có cách đảm bảo CSS không bị làm rơi; giữ `e2e/specs/css-fidelity.spec.ts` |
| T4 | Bộ phát hiện "nhảy đồng hồ" của reporter chẩn đoán chưa thử với một lần ngủ thật | `docs/TESTING.md` mục timeout | Thấp | Khi có dịp kiểm thử thủ công |
| T5 | Bản build e2e thứ ba cho tổ hợp "có địa chỉ dịch vụ thông báo nhưng công tắc gửi đóng" | Hiện chứng minh bằng Vitest | Thấp | Nếu muốn bằng chứng trình duyệt |
| T6 | Thời lượng bộ Playwright (M5: 344 ca ~25 phút khi xanh hết, ~35 phút khi có ca timeout; M4B: 343 ca ~24 phút; M4A: 308 ca ~23 phút; M3B.4: 274 ca ~18 phút) | Chạy đầy đủ khi nghiệm thu; targeted khi phát triển | Thấp | Cân nhắc chạy song song (workers) nếu mock được cách ly theo worker |
| T9 | Spec Playwright riêng cho từng màn M5 (hiện chỉ vitest + điều hướng tới trang thật) | Các màn M5 có vitest hợp đồng/hook/view; trình duyệt mới kiểm tra điều hướng và dấu hiệu trang thật | Trung bình | Khi có backend thật hoặc khi chủ dự án duyệt phạm vi rút gọn (D-UI-3) để chốt giao diện |
| T7 | Thông điệp riêng cho 403 code `233` (email chưa xác minh) của backend chung | `EmailVerifiedFilter` của repo-lms trả 403 `{code: 233}`; frontend hiện coi là lỗi API chung (khối lỗi + Thử lại). Cần câu hướng dẫn "xác minh email" + liên kết Auth FE | Trung bình | Khi xác minh được hình dạng phản hồi trên môi trường thật (M2 pending) |
| T8 | Thời lượng Vitest sau M5 (~1.260 ca, ~4,5 phút cả bộ; `tests/content-tree-manager.test.tsx` nặng nhất, một ca đặt timeout 60s) | Nhiều ca render antd Table/Modal trong jsdom | Thấp | Tách pool/worker theo thư mục hoặc chuyển vài ca nặng sang Playwright |
