# Màn Khoá học học viên (`/student/student-courses`)

Chuyển từ HSK cũ (`LMS_Frontend/src/features/student/student-course`, URL `https://lms-ai.hoc-ba.edu.vn/student/student-courses`).
Frontend nằm trong `hsk_frontend`, backend dùng chung `backend/repo-lms` của LMS_IELTS.

## Luồng dữ liệu

| Thành phần | Nguồn |
|---|---|
| Danh mục khoá (mã, tên, loại, đầu ra, số buổi, giáo trình, giá) | ERP HSK `GET /internal/lms/courses/list?type=GROUP\|1-1`, đồng bộ vào bảng `hsk_courses` |
| Ảnh bìa, mô tả, danh mục, đối tượng, hình thức học, đầu vào, số tháng, giờ/buổi, thứ tự | Bảng `hsk_courses`, quản trị nhập qua `POST /hsk-courses/import` hoặc script `backend/scripts/import-hsk-courses.mjs`. Trường nào trống thì frontend lấy dữ liệu biên tập tĩnh theo mã (`course/data/catalog-courses.ts`), rồi mới suy ra từ mã/tên như bản cũ |
| Đã sở hữu, tiến độ (`completed_sessions / total_sessions`) | ERP HSK `GET /internal/lms/lms-integration/students/{email}/online-courses`, gọi sống mỗi lần mở trang. Khi ERP lỗi thì dùng bản lưu Redis 7 ngày (`CACHED`); chưa có bản lưu thì trả `UNAVAILABLE` và màn hình báo cho học viên |
| Lộ trình buổi học, tài liệu (modal) | ERP HSK `GET /internal/lms/syllabus/{syllabusId}` (cache 15 phút). Chỉ trả cho học viên đã sở hữu; chưa sở hữu chỉ thấy tên 5 buổi đầu |

ERP HSK cấu hình bằng `HSK_CMS_API_BASE_URL` (khoá `hsk-course.erp-base-url`), xác thực bằng token nội bộ (`internal.config.*`) như dịch vụ
onl-learning cũ. Màn Quản lý Syllabus đã chuyển sang CMS IELTS (commit `0b698c1`), nhưng danh mục khoá và đăng ký của học viên HSK chỉ có
ở ERP HSK nên màn Khoá học vẫn gọi ERP này qua client riêng `HskCourseCmsClient`. Client có timeout, để ERP treo thì trang báo lỗi thay vì
treo theo. Biến này trống thì backend vẫn chạy, màn hình báo không tải được đăng ký.

## API repo-lms (`/api/lms` qua gateway)

| Method | Đường dẫn | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/hsk-courses` | đăng nhập | `{ items: HskCourseResponse[], enrollmentSource: LIVE\|CACHED\|UNAVAILABLE }` |
| GET | `/hsk-courses/{id}` | đăng nhập | `{ course, syllabusStatus: OK\|NONE\|UNAVAILABLE, sessions, materials, previewTopics, enrollmentSource }` |
| POST | `/hsk-courses/sync` | ROLE_ADMIN | Đồng bộ từ ERP. Một loại khoá lỗi hoặc ERP trả rỗng thì chỉ cập nhật, không ẩn khoá nào (`partial: true`) |
| POST | `/hsk-courses/import` | ROLE_ADMIN | ≤ 200 mục; khớp theo `externalId` rồi theo `code`; trường null giữ nguyên; `removed: true` thì ẩn khoá |

## Cấu hình (env)

Backend (`backend/.env.*.example`, `docker-compose.yml`):

- `HSK_CMS_API_BASE_URL`: ERP HSK (biến đã có trong compose).
- `HSK_COURSE_SYNC_ON_STARTUP` (mặc định `true`): đồng bộ một lần sau khi khởi động, chạy ở luồng riêng.
- `HSK_COURSE_SYNC_CRON` (mặc định `0 0 */6 * * *`): đồng bộ định kỳ; đặt `-` để tắt.
- `HSK_CMS_CONNECT_TIMEOUT_MS` / `HSK_CMS_READ_TIMEOUT_MS` (mặc định 5000 / 8000).

Frontend (`hsk_frontend/.env.example`, đọc lúc build):

- `NEXT_PUBLIC_LMS_API_BASE_PATH`: đã có từ trước.
- `NEXT_PUBLIC_STUDENT_COURSE_PROMO`: nhãn ưu đãi trên banner, ví dụ `20%`. Trống thì ẩn dòng ưu đãi.
- `NEXT_PUBLIC_STUDENT_COURSE_UNLOCK_URL`: trang đăng ký khi bấm "Mở khoá ngay!". Trống thì hiện hộp thông báo "Đăng ký khóa học".

## Đưa lên server

1. Deploy backend: Hibernate `ddl-auto: update` tự tạo bảng `hsk_courses`. Khi khởi động, backend tự đồng bộ danh mục từ ERP;
   log ghi `Đồng bộ khoá học HSK: nhận=..`.
2. (Tuỳ chọn) Mang ảnh bìa và mô tả đã sửa ở hệ cũ sang:
   `HSK_COURSE_SOURCE_API_BASE=https://lms-ai.hoc-ba.edu.vn/api/online-learning HSK_COURSE_SOURCE_AUTH="Bearer <token hệ cũ>" LMS_API_BASE=https://<domain>/api/lms LMS_ADMIN_TOKEN=<token admin> node backend/scripts/import-hsk-courses.mjs --dry-run`,
   rồi chạy lại không có `--dry-run`. Danh mục, đối tượng, hình thức học có thể bổ sung bằng `--extra-file`.
3. Deploy frontend với env ở trên.

## Khác bản cũ có chủ đích

- Bỏ dữ liệu giả: danh sách khoá mẫu khi API rỗng, tiến độ 65% cho "đang học", trình độ cố định "0 → HSK2 → HSK5" trên banner
  (giờ suy từ các khoá đã sở hữu).
- Bản cũ gọi 4–5 API; bản mới chỉ 1 request cho trang và 1 request khi mở chi tiết.
- Thanh giá có trần theo khoá đắt nhất, không ẩn khoá trên 2 triệu.
- Ảnh bìa lỗi thì đổi sang ảnh mặc định của danh mục.
- Nút "Vào thời khoá biểu" bị ẩn vì khu học viên mới chưa có trang thời khoá biểu.
- Tab "Khoá học của tôi" quay lại hành vi của bản cũ: lọc các khoá đã sở hữu trong cùng lưới. Component `registered-courses.tsx`
  hiển thị lớp IELTS (`/me/classes`, ERP IELTS) nên không còn dùng ở màn này.

## Kiểm thử

- Backend: `HskCourseBackendTest` (H2 cô lập, ERP giả lập).
- Frontend: `tests/student-course-view-model.test.ts`, `tests/student-courses-page.test.tsx`.
- Đã chạy đầu-cuối trên máy (2026-11-06): Postgres/Redis tạm, `repo-lms` thật, ERP HSK giả lập (token nội bộ + 17 khoá), gateway giả lập
  oauth2-proxy và bản build production. Đã kiểm: đồng bộ khi khởi động, sở hữu và tiến độ, modal lộ trình/tài liệu/khoá bị khoá,
  ERP sập (`CACHED` / `UNAVAILABLE`, danh mục vẫn còn), script nhập dữ liệu chạy lại không tạo trùng, giao diện mobile 390px.
- Chưa kiểm với ERP HSK thật và đăng nhập Auth thật. Cần xác nhận khi deploy: ERP mới vẫn trả các endpoint `courses/list` và
  `lms-integration/students/{email}/online-courses` như dịch vụ onl-learning cũ đã dùng ở production, và id khoá ở hệ cũ trùng id trên ERP.
