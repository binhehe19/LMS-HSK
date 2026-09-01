# Giao diện học sinh — Next.js

- URL: `/student/student-dashboard`.
- Next.js App Router: `src/app/(student)/student/student-dashboard/page.tsx`.
- Client component và các widget: `src/components/student/dashboard/`.
- Chuyển giao diện từ `D:\dev-thue\LMS_Frontend`, dùng Next.js App Router và `next/link`.
- Theo phạm vi bổ sung của chủ dự án, có thêm năm màn phía sau sidebar: Khóa học, Yêu thích, Lịch sử ôn luyện, Hỗ trợ và Hồ sơ. Bỏ Lịch sử đơn hàng.
- Giao diện dùng JSX, assets và bản dịch tiếng Việt từ nguồn; bố cục tổng quan theo ảnh tham chiếu, có thẻ Thành tích.
- CSS giới hạn trong `.student-dashboard-wrapper`, tránh ảnh hưởng khu quản lý.
- Nhóm `(student)` dùng `AuthInitializer` + `RequireAuth`; dữ liệu cá nhân lấy từ tài khoản Auth hiện tại.
- API đã nối: lớp đã đăng ký, chi tiết/lịch buổi, tiến độ bài tập, nội dung/tài liệu theo buổi, Learning Orbit, lịch sử tự luyện/từ vựng, kết quả bài làm, hồ sơ đọc và thông báo.
- Theo phạm vi chủ dự án: Hỗ trợ, Yêu thích, Góc Mentor và tab Tất cả khóa học vẫn dùng giao diện/dữ liệu mẫu; không thêm backend cho bốn phần này.
- Link tới chức năng ngoài phạm vi mở hộp thông báo tại chỗ, không dẫn tới route chưa triển khai.
- `preview-navigation.tsx` dùng `next/link`; không phụ thuộc React Router.

| Màn hình | URL |
| --- | --- |
| Tổng quan | `/student/student-dashboard` |
| Khóa học | `/student/student-courses` |
| Yêu thích | `/student/student-wishlist` |
| Lịch sử ôn luyện | `/student/student-quiz` |
| Hỗ trợ | `/student/student-tickets` |
| Hồ sơ | `/student/student-profile` |

Tab **Khóa học của tôi** đọc `/me/classes` và chi tiết từng lớp, không ghép trạng thái sở hữu từ catalog mẫu. Tiến độ bài tập đọc `/me/classes/{id}/homework-progress`; nội dung/tài liệu từ `/content-packages/syllabus/{syllabusId}/session-resources?sessionNo=...`. Link họp chỉ chấp nhận HTTP/HTTPS. Tệp dùng `fileUrl` từ repo-storage.

Dashboard dùng `/me/learning-orbit`: điểm bài đã chấm và số lượt đã kết thúc được ghi đúng nhãn; không coi là điểm thưởng hay số bài duy nhất. Chuỗi ngày dựa trên nộp bài, không phải đăng nhập. Lịch tuần chỉ thể hiện các lượt tự luyện tải qua `/assessment-practice/history`. Sao, thời gian học, kỷ lục chuỗi và cấp độ đầu vào/mục tiêu chưa có nguồn thì hiển thị dấu “—”. Kỹ năng là tỷ lệ điểm bài gần nhất, không phải phần trăm hoàn thành khóa HSK; không tự tạo kỹ năng Dịch. Từ vựng là toàn bộ Kho, chưa có phạm vi từng khóa HSK.

Lịch sử tự luyện đọc riêng READING/LISTENING/WRITING/SPEAKING/QUIZ, giữ kết quả thành công khi một nhóm lỗi và báo nhóm bị lỗi. Từ vựng đọc `/dictionary/sessions?completed=false` (backend trả tối đa 100 phiên gần nhất, gồm cả phiên hoàn thành). Chưa có lịch sử hợp nhất mọi module của lớp. Màn làm bài chưa chuyển; lượt đã kết thúc có thể xem điểm/trạng thái qua `/assessment-attempts/{id}/result`.

Hồ sơ lấy `GET /users/me` của Authentication. Nút sửa mở `/account/profile` của Authentication, không giả lưu tên/email trong state. Ngày đăng ký chưa có trong hợp đồng đang dùng nên hiển thị chưa có dữ liệu. Chuông đọc và đánh dấu thông báo qua repo-notification; không gửi chiến dịch.

Cấu hình local đã đặt trong các file env được gitignore:

- `.env`: `NEXT_PUBLIC_LMS_API_BASE_PATH=/api/lms`, `NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH=/api/notification`, `NEXT_PUBLIC_STORAGE_API_BASE_PATH=/api/storage`.
- `.env.development.local`: proxy LMS tới `http://127.0.0.1:8090`, Notification/Storage tới service dev đã cấu hình. Production phải định tuyến các base path này qua gateway.
- `CmsClient` của `/me/classes` vẫn dùng cấu hình CMS chung từ backend. Cần tài khoản HSK thực tế và cấu hình CMS đúng để xác minh danh sách lớp HSK; frontend không tự thay bằng giáo trình hay lớp mẫu khi API lỗi.

Kiểm thử: TypeScript, ESLint, production build; unit tests về endpoint cá nhân, link an toàn, phiên request cũ và retry; browser với response API mô phỏng cho dashboard, lớp/buổi, nội dung, lịch sử/kết quả, hồ sơ, thông báo và lỗi một phần. Backend local trả health 200 và các endpoint cá nhân trả 401 khi chưa xác thực. Chưa xác minh dữ liệu HSK thực tế bằng tài khoản người dùng.

`NativeModal` dùng HTML dialog cho focus, Escape và đóng hộp thoại; không cần Bootstrap JS hay React Router. Styles dùng namespace riêng, khu quản lý giữ nguyên.
