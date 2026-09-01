# Danh sách bàn giao cho Backend / Authentication (tổng hợp đến M4C.0)

Mục đích: một nơi duy nhất liệt kê những gì frontend **đang chờ** hoặc **cần xác minh** từ người phụ trách Backend/Auth. Frontend không sửa backend/Auth; mọi hợp đồng dưới đây là **giả định rút từ code HSK cũ** cho tới khi được xác nhận.
**M2 — REAL AUTH VERIFICATION: PENDING.** Mọi kiểm thử hiện tại dùng mock cách ly (`scripts/mock-server.mjs`); **không có màn hình nào ở mức `API INTEGRATED`**.
**B0 (định danh giảng viên + phân quyền theo lớp): OPEN.** Đã có tài liệu đề xuất bàn giao backend — [`B0-IDENTITY-AUTHORIZATION-CONTRACT.md`](B0-IDENTITY-AUTHORIZATION-CONTRACT.md) (bằng chứng: [`M4C0-SURVEY.md`](M4C0-SURVEY.md)). **Mới là đề xuất; chưa backend nào xác nhận; KHÔNG phải RESOLVED.**
**Rà soát P0 U1–U6 + đề xuất khắc phục (2026-10-27):** [`B0-P0-SECURITY-REVIEW.md`](B0-P0-SECURITY-REVIEW.md) — phân tích 10 tiêu chí/U, trạng thái triển khai (không xác minh được hạ tầng), thiết kế `ClassAccessService`, phương án D7b, danh sách thay đổi C1–C13, thứ tự khắc phục, kế hoạch test staging, tiêu chí nghiệm thu B0 (hiện 0/9). **Chưa thay đổi gì ở production/Auth.**
**Xác minh sâu backend (2026-10-26, đọc source):** [`B0-BACKEND-VERIFICATION-REPORT.md`](B0-BACKEND-VERIFICATION-REPORT.md) — phân loại từng rủi ro, **6 phát hiện KHẨN (U1–U6)** đang nằm trên đường chạy thật (ghi nhận xét không kiểm quyền + phát thông báo; điểm danh/ghi chú đọc không xác thực; `/admin/*` không role check; `GET /leads` và `/schedule-modules/all-student-progress` mở cho người ẩn danh), đánh giá tĩnh T1–T20, quyết định D1–D11. Chưa chạy thật; CMS/AI-CNH không xác minh được.

## 0. Quy ước trạng thái

| Nhãn | Nghĩa |
|---|---|
| **UI COMPLETE** | Giao diện + lớp gọi API + trạng thái loading/rỗng/lỗi đã xong, đã kiểm thử trên mock cách ly |
| **WAITING FOR BACKEND** | Chưa có endpoint tương thích hoặc chưa xác nhận hợp đồng; giao diện hiện "chưa tích hợp", không dữ liệu giả |
| **API BLOCKED** | Không thể tích hợp vì thiếu quyết định/điều kiện bên ngoài (vd. quyền, mô hình định danh) — cần chốt trước khi backend làm tiếp |
| **API INTEGRATED** | Đã nối API thật và xác minh (hiện **chưa có**) |
| **REAL AUTH VERIFICATION PENDING** | Auth mới chạy trên mock; chưa thử với Auth thật |

Ưu tiên: **P0** chặn việc dùng thật; **P1** cần sớm để mở tính năng; **P2** nên xác nhận, có phương án tạm. Tình trạng việc: OPEN (chưa trả lời), BLOCKED (chờ môi trường), DECISION (cần quyết định).
Người/nhóm xử lý: chưa được chỉ định trong tài liệu dự án — cột "Chủ trì" ghi nhóm dự kiến (**chưa xác nhận**); chủ dự án cần điền.

## 1. Tổng quan theo màn hình

| Màn hình (route) | UI | API | Quyền (frontend) | Tài liệu hợp đồng |
|---|---|---|---|---|
| Quản lý lớp (Admin) `/admin/class-management` | UI COMPLETE | WAITING FOR BACKEND | ADMIN | `api-requirements/class-management.md` |
| Tổng quan Giảng viên `/instructor/welcome` | UI COMPLETE | WAITING FOR BACKEND (ticket + đếm thông báo) | TEACHER, MENTOR (quyết định giao diện) | `api-requirements/instructor-welcome.md` |
| Thông báo của tôi `/instructor/instructor-notifications` | UI COMPLETE | WAITING FOR BACKEND | TEACHER, MENTOR (quyết định giao diện) | `api-requirements/notifications.md` mục 1–3 |
| Quản lý thông báo (Admin) `/admin/settings/notifications` | UI COMPLETE; **gửi KHOÁ mặc định** | WAITING FOR BACKEND; gửi: **API BLOCKED** tới khi xác nhận hợp đồng | ADMIN | `notifications.md` mục 5 |
| Quản lý lớp học (Giảng viên) `/instructor/list-class` | UI COMPLETE | WAITING FOR BACKEND | TEACHER, MENTOR | `instructor-list-class.md` |
| Danh sách bài học `/instructor/list-class/list-lesson` | UI COMPLETE | WAITING FOR BACKEND; **API BLOCKED** về mô hình định danh/quyền sở hữu lớp (mục 2) | TEACHER, MENTOR | `instructor-list-lesson.md` |
| Danh sách bài nộp `/instructor/list-class/submissions` | NOT_MIGRATED (M4C.1 đề xuất, **chưa làm**) | **API BLOCKED** (B0) | TEACHER, MENTOR (D3) | `B0-…-CONTRACT.md` mục 6.2 |
| Phân tích học tập `/…/learning-analysis` (danh sách) | NOT_MIGRATED | **API BLOCKED** (B0) | TEACHER, MENTOR | như trên |
| Chi tiết phân tích `/…/learning-analysis/detail` | NOT_MIGRATED; **có 3 thao tác GHI** (nhận xét, tạo/duyệt AI) | **API BLOCKED** | TEACHER (D4) | như trên |
| Chấm bài `/…/grading` | NOT_MIGRATED; **GHI** (chấm, gửi kết quả) | **API BLOCKED** | TEACHER (D4) | như trên |
| Chi tiết bài học `/…/lesson-detail` | NOT_MIGRATED; frontend cũ **lưu giả** (không gọi backend nhưng báo thành công) | **API BLOCKED** (chưa có hợp đồng lưu) | — | `M4C0-SURVEY.md` mục 6 |
| Chuông + toast ticket (mọi sidebar) | UI COMPLETE | WAITING FOR BACKEND | mọi role quản lý | `notifications.md`, mục D |
| Đăng nhập/refresh/đăng xuất | UI COMPLETE (mock) | **REAL AUTH VERIFICATION PENDING** | — | `AUTH-INTEGRATION.md` |

## 2. Quyết định kiến trúc cần chốt trước (ảnh hưởng nhiều màn hình)

**Danh tính giảng viên ↔ dữ liệu lớp học.** HSK cũ xác định giảng viên **bằng email** lấy từ principal (`authentication.getName()`), rồi `onl-learning` tra lớp theo email (timetable `TUTOR`, rơi về CMS) và **kiểm tra quyền sở hữu lớp ở đó**; service quiz chỉ chuyển tiếp danh tính. Frontend **không** được và sẽ không dùng email/id tuỳ ý từ client để xác định quyền truy cập lớp.
Yêu cầu backend: (1) xác định giảng viên từ **principal đã xác thực** của Auth chung; (2) tự ánh xạ principal ↔ dữ liệu lớp (không mặc định email); (3) **kiểm tra quyền sở hữu/truy cập từng `classId` ở server** (403/404 khi không thuộc); (4) ghi rõ cách ánh xạ cho các endpoint dưới đây. Đây là mục **A3/B0**: chưa có nó thì `/instructor/list-class` và `/instructor/list-class/list-lesson` (và các màn con) không thể tích hợp an toàn.

**Kết quả khảo sát M4C.0 (đọc source, chưa chạy thật):** Auth chung có **userId ULID ổn định** (`sub`/`uid`); `getName()` là email-hoặc-userId nên không phải khoá; dữ liệu lớp HSK gắn giảng viên **bằng email** (`timetable_class_participants`, `TUTOR`); HSK cũ thiếu kiểm tra role ở nhiều endpoint, `/admin/*` mở cho mọi người đã đăng nhập, có endpoint ghi + thông báo không kiểm tra quyền, `classId` tuỳ chọn, có chỗ trả 200 rỗng khi bị từ chối; backend chung IELTS không có endpoint giảng viên tương đương. Đề xuất (**chưa duyệt**): chủ thể = userId từ principal, phân công theo userId, `ClassAccessService` tập trung, 401/403/404 chuẩn hoá. Chi tiết, DTO, mã lỗi, kịch bản kiểm thử, quyết định D1–D10 và điều kiện hoàn tất ở `B0-IDENTITY-AUTHORIZATION-CONTRACT.md`.

## 3. Authentication (người phụ trách Auth chung)

| # | Việc cần xác nhận | Ưu tiên | Tình trạng | Chủ trì | Ghi chú |
|---|---|---|---|---|---|
| A1 | Môi trường Auth dev/staging an toàn + tài khoản test (Admin, Teacher, Mentor) để chạy kiểm chứng M2 thật | P0 | BLOCKED | Auth | `AUTH-INTEGRATION.md` mục 8 |
| A2 | `GET /users/me` trả `id`, `email`, `fullName`, `roles` đúng dạng; role đúng như `ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_MENTOR` (frontend so khớp nguyên văn) | P0 | OPEN | Auth | Frontend không ánh xạ role |
| A3 | **Định danh của principal** (JWT/`Authentication.getName()`): là email hay userId? Dịch vụ lớp học phải dùng định danh nào để tìm lớp của giảng viên | P0 | OPEN | Auth + Quiz/onl-learning | Xem mục 2; HSK cũ dựa vào email |
| A4 | Refresh/cookie/hash theo từng môi trường (`prod` không trả token trong body) | P1 | OPEN | Auth | Đã hiện thực theo code Auth; chưa thử thật |
| A5 | Quyền thật của route không có PrivateRoute ở HSK cũ: `/instructor/welcome`, `/instructor/instructor-notifications` (đang là quyết định giao diện TEACHER+MENTOR) | P1 | DECISION | Chủ dự án + Backend | Chưa phải xác nhận backend |
| A6 | Teacher-manager, Collaborator: có được vào khu quản lý mới không và route nào (hiện UNKNOWN, 49 route) | P2 | DECISION | Chủ dự án | `ROUTE-STATUS.md` |

## 4. API còn thiếu — chi tiết theo yêu cầu bàn giao

| # | Màn phụ thuộc | Endpoint/contract đề xuất | Trường dữ liệu cần | Role / quyền | Ưu tiên | Chủ trì (chưa xác nhận) | Phải xác nhận trước khi tích hợp |
|---|---|---|---|---|---|---|---|
| **B0** | list-class, list-lesson, submissions, learning-analysis, grading (+ màn con) | Mô hình xác thực giảng viên + kiểm tra sở hữu lớp/buổi ở server (mục 2). **Trạng thái: OPEN — đã có đề xuất, chưa được xác nhận** | — | TEACHER/MENTOR **và** sở hữu lớp | **P0** | Backend lớp học + Auth | Quyết định D1–D10 và M1–M15 trong `B0-IDENTITY-AUTHORIZATION-CONTRACT.md`; 403 hay 404; không nhận định danh từ client |
| B7 | submissions, learning-analysis | `GET …/classes/{classId}/schedules/{scheduleId}/students` (đề xuất) | `GradingStudentResponse` (điểm tổng/chuyên cần do backend tính) | TEACHER, MENTOR + sở hữu lớp/buổi | P0 (sau B0) | Backend quiz / onl-learning | Không 200 rỗng khi bị từ chối; `classId` bắt buộc; `scheduleId∈classId` |
| B8 | learning-analysis/detail, grading | Endpoint đọc/GHI theo lớp-buổi-học viên (nhận xét, báo cáo AI, chấm, gửi kết quả) | xem `B0-…` mục 6.2 | TEACHER (D4) | P1 (sau B0) | Backend quiz / onl-learning | Kiểm tra quyền ghi riêng, audit, idempotency (M7, M8) |
| B1 | `/instructor/list-class` | `GET {quiz}/grading/classes` — lớp của người đăng nhập | `classId, classCode, className, courseId, courseName, teacherName, teacherEmail, startDate, endDate, actualEndDate, studentCount, hasPendingGrading` | TEACHER, MENTOR | P0 | Backend quiz | Backend chung IELTS **không có** (`GET /classes` ADMIN-only, dữ liệu khác); định dạng ngày; phân trang phía server? |
| B6 | `/instructor/list-class/list-lesson` | `GET {quiz}/grading/classes/{classId}/schedules` — buổi học của một lớp | `sessionId, sessionNo, title, topic, syllabusScheduleId, hasAssignment, hasPendingGrading` | TEACHER, MENTOR + sở hữu lớp | P0 | Backend quiz / onl-learning | Backend chung IELTS `GET /classes/{classId}/sessions` **INCOMPATIBLE** (ADMIN-only, thiếu title/topic/syllabusScheduleId/hasAssignment/hasPendingGrading); nguồn `title/topic/hasAssignment`; cách tính `hasPendingGrading`; mã lỗi khi không thuộc lớp. `instructor-list-lesson.md` |
| B5 | `/admin/class-management` | `GET {quiz}/grading/admin/classes` | như `class-management.md` | ADMIN | P0 | Backend quiz | `class-management.md` |
| C1 | thông báo, chuông | `GET /unread-count`, `GET ?page&size`, `POST /{id}/read`, `POST /read/all` (gốc dịch vụ thông báo) | `NotificationResponse`, `NotificationPageResponse` | mọi role quản lý (chính mình) | P0 | Backend notification | Đường dẫn gốc; quyền Teacher/Mentor (C6) |
| C2 | Thông báo của tôi / Admin | thêm `readStatus, fromDate, toDate, page, size` | — | như C1 | P1 | Backend notification | Định dạng ISO/múi giờ; sắp xếp; `unreadCount` có phụ thuộc bộ lọc không |
| C3 | chuông, danh sách | `payload.targetUrl`/`deepLink` | — | — | P1 | Backend notification | Thuộc app mới hay cũ (frontend chỉ nhận đường dẫn nội bộ `/…`) |
| **C4** | Admin gửi thông báo | `POST /admin/campaigns/send-now` `{title, message, userIds[]}` | `CampaignResponse` | ADMIN | **P0 trước khi bật** | Backend notification | Hợp đồng, validation, mã lỗi, **chống gửi trùng (idempotency)**, đồng bộ/bất đồng bộ. **Frontend KHOÁ gửi mặc định**; không bật `NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND` khi chưa xác nhận |
| C5 | Admin: lịch sử + chọn người nhận | `GET /admin/campaigns?page&size`; danh sách người dùng (`/id/admin/users` ở HSK cũ — dịch vụ định danh) | `CampaignPageResponse`, `AdminUserListResponse` | ADMIN | P1 | Backend notification + identity | Giới hạn kích thước trang cho "Chọn tất cả …"; phạm vi vai trò |
| C6 | mọi màn thông báo | Teacher/Mentor gọi được API thông báo của chính họ | — | TEACHER, MENTOR | P1 | Backend notification | Chưa xác nhận |
| C7 | màn chấm bài (chưa chuyển) | Sự kiện `exercise-graded` (bản cũ phát khi gặp `EXERCISE_GRADED`) | — | — | P2 | — | Cần hợp đồng riêng nếu màn chấm bài mới cần |
| D1 | Tổng quan, toast | `GET {ticket}?page&size` | `status`, `assignedId` | mọi role quản lý | P1 | Backend ticket/identity | `assignedId` cùng không gian id với `GET /users/me` |
| D2 | `/instructor/instructor-support-tickets`, `/instructor-settings` | — | — | UNKNOWN | P2 | — | Quyền thật và hợp đồng |

## 5. Việc thuộc phía frontend (không cần backend) — `docs/TECH-BACKLOG.md`

Rà soát 22 `overrides`; cân nhắc Turbopack; định kỳ xem bản vá của gói bị ghim.

## 6. Điều kiện để kiểm chứng Authentication thật (M2) — chủ dự án/Auth cung cấp

Mock **không** tương đương Auth thật; M2 vẫn **REAL AUTH VERIFICATION PENDING**. Frontend không gọi Auth production và không dùng tài khoản thật. Cần:
1. **Môi trường staging an toàn** (Auth + backend lớp học), tách production, không dữ liệu học viên thật.
2. **Tài khoản thử theo role**: Admin; ≥ 2 giảng viên khác nhau (thử truy cập chéo lớp); Mentor; Teacher-manager; Collaborator; học viên; tài khoản không role.
3. **Dữ liệu lớp thử**: ≥ 2 lớp của giảng viên A, 1 lớp của B, hai lớp dùng chung `syllabusScheduleId`, học viên có bài nộp.
4. **Domain & cookie**: `ROOT_DOMAIN`, `COOKIE_DOMAIN`, `SameSite`, `Secure`; production chỉ cookie HttpOnly (không token trong body); CORS chỉ `https` thuộc `ROOT_DOMAIN`; frontend và Auth cùng domain gốc.
5. **Quy trình kiểm thử phiên thật**: đăng nhập → cookie → `GET /users/me` → hết hạn access → refresh một lần → logout; đổi role ⇒ hiệu lực sau token mới; bộ kịch bản truy cập chéo ở `B0-…` mục 9.
Người cung cấp môi trường: **chưa chỉ định** (chủ dự án cần điền).
