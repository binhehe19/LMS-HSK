# Trạng thái chức năng — sau M5 (toàn bộ khu quản lý Admin/Giảng viên)

Cập nhật 2026-10-27. Kế hoạch và ma trận mục tiêu: `docs/M5-FULL-DEMO-PLAN.md`; xem trước cục bộ: `docs/PREVIEW-LOCAL.md`; triển khai: `docs/DEPLOY.md`;
hợp đồng API từng màn: `docs/api-requirements/*.md`; sổ route: `docs/ROUTE-STATUS.md` (tự sinh từ `route-registry`); bàn giao backend/Auth: `docs/BACKEND-AUTH-HANDOVER.md`.

## 0. Quy ước và hai kết luận tách riêng

**UI** — `UI COMPLETE`: đủ nghiệp vụ của màn HSK cũ (phần lớn đối chiếu từng pixel ở M1–M4B; màn M5 đối chiếu nghiệp vụ, không đo pixel) · `UI STD`: chuẩn hoá theo pattern của `LMS_IELTS/frontend`, khác HSK cũ có chủ đích (D-UI-2) · `UI PARTIAL`: phạm vi rút gọn có ghi rõ phần chưa chuyển (D-UI-3).

**API** — `API INTEGRATED`: đã xác minh trên môi trường thật — **chưa có chức năng nào** (chưa có môi trường/tài khoản dev/staging) · `AVAILABLE`: endpoint tồn tại trong source backend chung `LMS_IELTS/backend`, client viết theo DTO đó, có test hợp đồng trên mock · `PARTIAL`: AVAILABLE nhưng thiếu trường/nghiệp vụ so với HSK cũ (giao diện hiện "—", không bịa) · `MISSING`: backend chung không có; hợp đồng ĐỀ XUẤT trong `docs/api-requirements/`; production để trống biến ⇒ màn hiện **WAITING FOR BACKEND** · `BLOCKED (B0)`: MISSING và còn vướng hợp đồng định danh/quyền giảng viên (`docs/B0-IDENTITY-AUTHORIZATION-CONTRACT.md`).

**Ghi** — mọi thao tác ghi chưa có hợp đồng xác nhận đi qua công tắc `lib/api/write-gate.ts` (mặc định ĐÓNG: nút khoá + "chưa tích hợp", **không tạo request**); mở bằng chế độ xem trước cục bộ hoặc `NEXT_PUBLIC_WRITE_<FEATURE>=enabled` sau khi backend xác nhận (`docs/DEPLOY.md` mục 5).

### Kết luận 1 — ADMIN/TEACHER UI (xem trước cục bộ): **SẴN SÀNG**

Mọi mục menu Admin (22) và Giảng viên (14) đều là **trang thật** (không còn mục nào là "Chức năng đang được chuyển đổi"); luồng Admin và Giảng viên trong `docs/M5-FULL-DEMO-PLAN.md` mục 1 đi hết trên `npm run preview:local` với một bộ dữ liệu giả lập nhất quán (12 lớp, 40 học viên, 4 giảng viên, bài nộp/chấm bài, thông báo, ticket, nội dung). Phần rút gọn có chủ đích ghi ở cột UI dưới đây và mục 3.

### Kết luận 2 — TÍCH HỢP BACKEND THẬT: **CHƯA SẴN SÀNG** (một phần AVAILABLE, phần lớn MISSING/BLOCKED)

Đã nối theo source backend chung (chưa xác minh trên môi trường thật): Auth chung (`/users/me`, refresh, logout), `/api/lms` cho lớp/học viên/giáo trình của Admin, `/api/notification` cho thông báo cá nhân, `/api/storage` cho tải tệp. **Toàn bộ luồng giảng viên** (lớp được phân công, buổi, bài nộp, chấm, phân tích) và **toàn bộ nội dung HSK, ticket, thanh toán, dashboard, giảng viên, khoá học trực tuyến** không có endpoint trong backend chung ⇒ WAITING FOR BACKEND ở production. Việc cần từ phía backend/chủ dự án: mục 4.

## 1. Admin

| Màn | URL (giữ nguyên HSK cũ) | Role | UI | API (backend chung / hợp đồng) | Ghi | Kiểm thử |
|---|---|---|---|---|---|---|
| Overview (dashboard) | `/admin/dashboard` | ADMIN | **UI STD** (thẻ số liệu lớp/học viên/giảng viên/bài chờ chấm + doanh thu theo kênh; thay 4 lời gọi gộp ở client của bản cũ) | **MISSING** → `GET {HSK}/management/dashboard/overview?days=30` (`admin-overview.md`) | chỉ đọc | vitest + mock |
| Phân tích hành vi | `/admin/analytics` | ADMIN | UI COMPLETE | **MISSING** → `GET {HSK}/analytics/admin/overview?days=` | chỉ đọc | vitest + mock |
| Quản lý lớp học | `/admin/class-management` | ADMIN | UI COMPLETE (0 pixel so HSK cũ, M1) | **AVAILABLE / PARTIAL**: `GET /api/lms/classes` (duyệt trang); thiếu endDate/actualEndDate/studentCount/ungradedCount/totalSessions ⇒ "—" (`class-management.md` mục 0) | chỉ đọc | vitest + Playwright + visual |
| Học viên của lớp | `/admin/class-management/students?classId=` | ADMIN | UI COMPLETE | **AVAILABLE / PARTIAL**: `GET /classes/{id}`, `/sessions`, `/enrollments` (chuyên cần, điểm từ enrollment) | chỉ đọc | vitest + mock |
| Quản lý giảng viên | `/admin/teacher-management` | ADMIN | UI COMPLETE (danh sách/lọc, tạo/sửa, khoá/mở, tài khoản mới, gửi lại email, import CSV, đồng bộ CMS) | **MISSING** → `{HSK}/id/teachers/*` (`teacher-management.md`) | gate `teacher-management` | vitest + mock |
| Quản lý thông báo | `/admin/settings/notifications` | ADMIN | UI COMPLETE (0 pixel, M3B.4) | danh sách: **AVAILABLE** (repo-notification, lọc ở client — `notifications.md` mục 0); lịch sử/gửi chiến dịch: **MISSING** (`{HSK}/notification/admin/campaigns`); người nhận: `NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH` (MISSING) | gửi: `NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND` | vitest + Playwright + visual |
| Khoá học trực tuyến | `/learning-path/online-course/manage` | ADMIN | UI COMPLETE (lưới card, thống kê, tạo/sửa/xoá qua modal antd) | **MISSING** → `{HSK}/online-learning/courses*` (`online-course.md`) | gate `online-course` | vitest + mock |
| Đăng ký khoá học (leads) | `/learning-path/online-course/leads` | **chỉ ADMIN** (bản cũ: endpoint mở công khai — U5) | UI COMPLETE | **MISSING** → `{HSK}/online-learning/leads*` | gate `online-course` | vitest + mock |
| Tài liệu học tập | `/learning-path/lesson-materials/manage` | ADMIN | UI COMPLETE (bộ tài liệu → tài liệu, tải một/nhiều tệp, DRAFT/PUBLISHED/ARCHIVED) | byte tệp: **AVAILABLE** (repo-storage presign→PUT→confirm); metadata: **PARTIAL/MISSING** → `{HSK}/lesson-materials/*` (`lesson-materials.md`) | gate `lesson-materials`, `storage` | vitest + mock |
| Quản lý Giáo trình | `/learning-path/syllabus/manage` | ADMIN, TEACHER, MENTOR | **UI PARTIAL** (bảng giáo trình + chi tiết: thông tin, CLO, tài liệu, lịch trình, cấu trúc đánh giá, mẫu bài kiểm tra, phiên bản; module ôn luyện theo buổi xem/thêm/sắp xếp/xoá; **không** chuyển tạo nội dung trong modal, đề luyện, chọn video, import Excel — `syllabus-modules.md` mục 6) | giáo trình: **AVAILABLE** (`GET /api/lms/syllabuses`, `/{id}`, `/{id}/versions`); module theo buổi: **MISSING** → `{HSK}/online-learning/schedule-modules*` | gate `content` + ticket `OTHER` cho giảng viên | vitest + mock |
| Kho lưu trữ đa phương tiện | `/instructor/manage-storage` | ADMIN, TEACHER, MENTOR | **UI PARTIAL** (cây gói → thư mục → bộ học → video, tải video, publish; **không** chuyển phụ đề karaoke) | byte: **AVAILABLE** (repo-storage); cây/metadata video: **MISSING** → `{HSK}/storage/*` (`hsk-storage.md`) | gate `storage` + ticket `STORAGE`; giảng viên không ticket = chỉ xem | vitest + mock |
| Sao kê | `/admin/statements` | ADMIN | UI COMPLETE (4 thẻ + bảng giao dịch phân trang/sắp xếp phía máy chủ; bỏ việc tự duyệt 50 trang để tính bù) | **MISSING** → `{HSK}/payment/reports/*` (`payment.md`) | chỉ đọc | vitest + mock |
| Phân công công việc (quản lý) | `/admin/tickets` | ADMIN | UI COMPLETE (thẻ thống kê, bảng, tạo theo người × module, sửa khi OPEN, xoá khi CLOSE) | **MISSING** → gốc `NEXT_PUBLIC_TICKET_API_BASE_PATH` (`work-tickets.md`) | gate `work-tickets` | vitest + mock |
| Gói thành viên | `/admin/membership-management` | ADMIN | UI COMPLETE (CRUD gói; **không** rơi về 2 gói giả khi API lỗi như bản cũ) | **MISSING** → `{HSK}/payment/membership*` | gate `membership` | vitest + mock |
| Quản lý người dùng | liên kết ngoài Authentication_Frontend | ADMIN | giữ liên kết (mở tab mới) | Auth FE | — | golden menu |
| Kho nội dung HSK (dùng chung với giảng viên) | xem mục 2b | | | | | |

## 2. Giảng viên (ROLE_TEACHER, ROLE_MENTOR — PrivateRoute HSK cũ hoặc quyết định giao diện M3B.2)

| Màn | URL | UI | API | Ghi | Kiểm thử |
|---|---|---|---|---|---|
| Tổng quan | `/instructor/welcome` | UI COMPLETE (pixel, M3B.2) | ticket: **MISSING**; số chưa đọc: **AVAILABLE** (repo-notification) | — | vitest + Playwright + visual |
| Thông báo của tôi | `/instructor/instructor-notifications` | UI COMPLETE (M3B.3) | **AVAILABLE** (`GET /notifications`, `/unread-count`, `POST /{id}/read`; lọc + "đọc tất cả" làm ở client — `notifications.md` mục 0) | — | vitest + Playwright + visual |
| Quản lý lớp học | `/instructor/list-class` | UI COMPLETE (0 pixel, M4A) | **BLOCKED (B0)** → `GET {QUIZ}/grading/classes` (`instructor-list-class.md`) | chỉ đọc | vitest + Playwright + visual |
| Danh sách bài học | `/instructor/list-class/list-lesson` | UI COMPLETE (M4B) | **BLOCKED (B0)** (`instructor-list-lesson.md`) | chỉ đọc | vitest + Playwright + visual |
| Danh sách nộp bài | `/instructor/list-class/submissions` | UI COMPLETE (bỏ N+1 tải từng bài để tính điểm — backend trả điểm sẵn) | **BLOCKED (B0)** → `GET {QUIZ}/grading/schedules/{id}/students?classId=` (`instructor-grading.md`) | chỉ đọc | vitest + Playwright (điều hướng) |
| Chấm bài | `/instructor/list-class/grading` | UI COMPLETE (bài làm theo học viên, chấm từng câu/ từng câu hỏi, gửi kết quả) | **BLOCKED (B0)** | gate `quiz-grading` | vitest + mock |
| Chi tiết bài học | `/instructor/list-class/lesson-detail` | UI COMPLETE (xem; sửa khi gate mở — bản cũ "lưu thành công giả") | **BLOCKED (B0)** → một endpoint gộp GET/PUT `lesson-detail` thay 3 lời gọi | gate `lesson-detail` | vitest + mock |
| Phân tích học tập (+ chi tiết) | `/instructor/list-class/learning-analysis`, `/detail` | UI COMPLETE (bài làm theo nhóm, chuyên cần, điểm kỹ năng, nhận xét, gợi ý AI chỉ tư vấn) | **BLOCKED (B0)**; học viên định danh bằng `userId` (bỏ email trên URL API — U1–U3) (`learning-analysis.md`) | gate `teacher-note` (nhận xét, snapshot AI, duyệt báo cáo) | vitest + mock |
| Phân công công việc (giảng viên) | `/instructor/instructor-tickets` | UI COMPLETE (ticket được giao, báo cáo hoàn thành) | **MISSING** (`work-tickets.md`) | gate `work-tickets` | vitest + mock |
| Giáo trình, Kho lưu trữ, Kho nội dung | dùng chung với Admin (mục 1, 2b) | | | quyền ghi theo ticket OPEN/DONE đúng module; không publish | |
| Yêu cầu hỗ trợ | `/instructor/instructor-support-tickets` (2 mục menu) | **UNKNOWN → 404** | — | — | chờ quyết định D-UI-1 |
| Cài đặt hồ sơ, Teacher-manager/Collaborator | `/instructor/instructor-settings`, `/teacher-manager/*` | **UNKNOWN → 404** (không cấp quyền, không ánh xạ role) | — | — | Playwright (ma trận role) |

### 2b. Kho nội dung HSK (ADMIN, TEACHER, MENTOR; `docs/api-requirements/content-tree.md`)

Nền dùng chung: cây **Package → Folder → Study set → mục**, URL state (`?packageId=&folderId=&studySetId=&view=search`), CRUD/publish qua modal antd, quyền giao diện theo ticket (`lib/tickets/ticket-access.ts`: Admin luôn; Teacher/Mentor cần ticket OPEN/DONE đúng module, không publish), ảnh/âm thanh qua repo-storage. API: **MISSING** cho mọi module (hợp đồng generic `{HSK}/{prefix}/packages|folders|study-sets|items`); ghi qua gate `content`.

| Module | URL | UI | Ghi chú |
|---|---|---|---|
| Thẻ ghi nhớ | `/flashcard/create-package`, `/flashcard/manage`, `/flashcard/manage-learning-path`, `/flashcard/manage-learning` | **UI PARTIAL**: tree + bảng thẻ + xem nhanh lật thẻ; **không** chuyển import Excel | tiền tố `/flashcard`; ticket FLASHCARD |
| Bộ từ vựng | `/vocab-set/manage` | UI PARTIAL (dùng chung module thẻ) | tiền tố `/flashcard`; ticket FLASHCARD |
| Bộ thẻ (tạo/sửa kèm thẻ) | `/sets/create`, `/sets/:id/edit` | UI COMPLETE cho phần tạo/sửa bộ + thẻ; `returnUrl` về đúng vị trí cây | |
| Luyện viết (Hán tự) | `/hanzi/manage`, `/hanzi/manage/select-type`, `/hanzi/manage/create-package`, `/hanzi/create`, `/hanzi/edit/:id` | **UI COMPLETE** cho cây 4 cấp (bản cũ 3 cấp: nay thêm cấp chữ với Thêm/Sửa/Xoá + xem nhanh ô 田字格, đọc bằng Web Speech), tạo gói theo 4 loại, tạo/sửa bộ kèm chữ (bắt buộc chữ Hán + pinyin + nghĩa, báo lỗi thay vì lặng lẽ bỏ dòng); **không** chuyển import Excel 2 kiểu + tệp mẫu (nút chỉ báo "chưa chuyển"), hoạt hình nét chữ (`hanzi-writer`) | tiền tố `/writing`; ticket WRITING |
| Luyện phát âm | `/pronunciation/manage`, `/pronunciation/manage/select-type` | **UI PARTIAL**: cây + mục phát âm (text, pinyin, gợi ý, âm thanh/hình miệng qua repo-storage, xem nhanh có Phát âm/Tạm dừng); **không** chuyển import Excel và các trường cũ `type` SHENGMU/YUNMU, `hanzi`, `exampleWord/Pinyin/Meaning` (chờ backend quyết định — `content-tree.md`) | tiền tố `/pronunciation`; ticket PRONUNCIATION |
| Bài tập (quiz) | `/quiz/manage` (cấp 5 câu hỏi ở cùng URL `?quizId=`) | **UI PARTIAL**: cây 4 cấp + bộ đề có kỹ năng (8 kỹ năng) + **trình soạn câu hỏi** 6 loại (MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_BLANK TYPE/SELECT, MATCHING_PAIRS, SHORT_ANSWER, AUDIO_RESPONSE; media câu hỏi/bài nghe/đoạn đọc qua repo-storage); **không** chuyển import Excel, loại SENTENCE_BUILDER (hiện nhưng khoá), chấm AI (tự luận/ghi âm = giáo viên chấm tay), ảnh cho từng lựa chọn | tiền tố `/quiz` + `GET/POST /quiz/questions/{quizId}`, `PUT/DELETE /quiz/questions/{id}`; ticket QUIZ |
| Ngữ pháp | `/grammar/manage` | **UI PARTIAL**: cây đủ 4 cấp (bản cũ bỏ cấp thư mục) + điểm ngữ pháp đủ trường của GrammarPointModal cũ (cấu trúc, định nghĩa, giải thích, ví dụ zh/pinyin/vi, phân loại, trình độ 1–9, bộ đề liên kết); **không** chuyển import Excel | tiền tố `/grammar`; ticket GRAMMAR |
| Từ điển | `/vocabulary/manage` (màn riêng, không dùng cây) | **UI PARTIAL**: bộ lọc trong URL (`keySearch, hskLevel, isSingleVocab, wordType, radical, page`), tìm phía máy chủ (debounce), bảng + dòng mở rộng (nghĩa/ví dụ, bộ thủ–chiết tự, phát âm speechSynthesis), phân trang máy chủ, modal 5 tab (nhiều pinyin, từ loại, nghĩa/ví dụ, từ ghép, lượng từ, đồng/trái nghĩa, media); **không** chuyển import Excel bất đồng bộ, link Google Sheets mẫu, bảng 214 bộ thủ (rút gọn thành ô nhập), upload ảnh (nhận URL) | **MISSING** → `{HSK}/dictionary/vocabularies/*` (`dictionary.md`; backend chung có `/learning-resources/dictionary/*` chỉ đọc, thiếu hanzi/pinyin); ticket DICTIONARY |

## 3. Khung nền tảng

| Hạng mục | Trạng thái |
|---|---|
| Khung quản lý, sidebar Admin 22 mục / Giảng viên 14 mục, active, thu gọn, responsive | UI COMPLETE (0 pixel so HSK cũ, M3A); TESTED (golden + Playwright + visual) |
| Registry route + guard theo từng route + placeholder | TESTED. 148 route khu quản lý: **41 MIGRATED** · 34 NOT_MIGRATED · 49 UNKNOWN · 24 OUT_OF_SCOPE (`docs/ROUTE-STATUS.md`). Sau M5 **không mục menu nào còn là placeholder** (Admin 20 MIGRATED + 1 UNKNOWN + 1 liên kết ngoài; Giảng viên 13 MIGRATED + 1 UNKNOWN); placeholder chỉ còn cho route HSK cũ hợp lệ không có mục menu (vd `/admin/profile`, `/learning-path/manage`, `/kanji-origin/*`) |
| Auth chung (`/users/me`, refresh một lần, logout, callback hash/cookie, chống lặp redirect) | API theo mã + mock; **REAL AUTH VERIFICATION PENDING** (`docs/AUTH-INTEGRATION.md` mục 8) |
| Tầng API: `lmsClient` (/api/lms), notification-client (repo-notification), storage-client (repo-storage) = backend chung; `hskClient` (`NEXT_PUBLIC_HSK_API_BASE_PATH`), `quizClient` (`NEXT_PUBLIC_QUIZ_API_BASE_PATH`), ticket-client = hợp đồng đề xuất | Xong; envelope `{success,data}` hoặc JSON trần; 401 ⇒ refresh một lần; phản hồi sai hình dạng ⇒ lỗi hợp đồng (không coi là rỗng) |
| Write gate (`lib/api/write-gate.ts`, 10 feature + công tắc gửi chiến dịch) | Xong; mặc định ĐÓNG; test `tests/demo-mode-write-gate.test.ts` + ca "gate đóng ⇒ không request" trong test client của từng gói |
| Xem trước cục bộ (`npm run preview:local`: build production + mock `MOCK_PROFILE=demo` + gateway 3100; `/demo` chọn tài khoản; băng-rôn + Reset/Đổi vai trò) | Xong; cờ chỉ hoạt động trên loopback/mạng riêng; không fallback mock trong code (`docs/PREVIEW-LOCAL.md`) |
| Mock cách ly (`scripts/mock/{core,server,data/{legacy,demo,grading-model},handlers/*}`) | Hồ sơ `e2e` (đóng băng cho Playwright) + `demo` (nhất quán); `/__auth/mock-reset`; handler đăng ký resettable |
| Docker (`Dockerfile`, `docker-compose.yml` theo mẫu IELTS, Traefik priority 1) | Xong, chưa chạy trên máy chủ nào (`docs/DEPLOY.md`) |
| antd 5 + React 19: `Modal.confirm`/`message` tĩnh | Vá bằng `unstableSetRender` (`components/shared/antd-static-render.tsx`, test render thật) |
| Build **webpack**, 22 `overrides` antd | Giữ (quyết định M4A; `docs/TECH-BACKLOG.md`) |
| Kiểm thử | Vitest: ~1.260 ca (hợp đồng client, hook, view, hàm thuần, guard production). Playwright: 343 ca gốc + spec cập nhật theo route đã chuyển (xem báo cáo bàn giao để biết kết quả lần chạy cuối) |

## 4. Việc cần từ backend / chủ dự án (gom từ các hợp đồng)

| Mã | Việc | Tài liệu |
|---|---|---|
| D-API-1 | Môi trường dev/staging + tài khoản ADMIN/TEACHER để xác minh AVAILABLE → INTEGRATED (Auth, `/api/lms`, `/api/notification`, `/api/storage`) | `BACKEND-AUTH-HANDOVER.md`, `DEPLOY.md` mục 4 |
| D-API-2 | Endpoint giảng viên theo B0 (lớp được phân công, buổi, bài nộp, chấm, phân tích; `classId` bắt buộc; không `200 []` khi từ chối) | `B0-*.md`, `instructor-*.md`, `learning-analysis.md` |
| D-API-3 | repo-notification: lọc server (`readStatus/fromDate/toDate`), `POST /notifications/read/all`, `targetUrl` trong payload; REST cho chiến dịch Admin | `notifications.md` mục 0 |
| D-API-4 | Dịch vụ HSK theo hợp đồng đề xuất: dashboard/analytics, giảng viên, thanh toán (sao kê, gói), khoá học trực tuyến + leads, tài liệu, kho lưu trữ, kho nội dung (7 module), module theo buổi của giáo trình, ticket | `admin-overview.md`, `teacher-management.md`, `payment.md`, `online-course.md`, `lesson-materials.md`, `hsk-storage.md`, `content-tree.md`, `syllabus-modules.md`, `work-tickets.md` |
| D-API-5 | `/api/lms/classes`: bổ sung endDate/actualEndDate/studentCount/ungradedCount/totalSessions hoặc endpoint thống kê lớp; phân trang/lọc server | `class-management.md` mục 0 |
| D-UI-1 | `Yêu cầu hỗ trợ` (`/instructor/instructor-support-tickets`) cho vai trò nào | `M3B2-WELCOME.md` |
| D-UI-2 | Chấp nhận UI STD cho Dashboard và modal react-bootstrap → antd | `M5-FULL-DEMO-PLAN.md` mục 5 |
| D-UI-3 | Chấp nhận phạm vi rút gọn: giáo trình, kho lưu trữ (karaoke), nội dung (Excel import, import từ điển bất đồng bộ) | như trên |

## 5. Khác biệt có chủ đích so với HSK cũ

1. (M1) Thêm trạng thái lỗi / chưa tích hợp; thẻ thống kê hiện `—` thay vì `0` khi lỗi/chưa tích hợp. 2. Phản hồi API không đúng hình dạng bị coi là lỗi (bản cũ coi là rỗng). 3. `router.push` thay `window.location.assign`. 4. Sidebar do `ManagementPageFrame` cung cấp. 5. (M3A) Dropdown thông báo dùng state React + Popper; `targetUrl` chỉ nhận đường dẫn nội bộ. 6. `robots: noindex`. 7. Không có URL Auth mặc định trỏ hệ thống thật. 8. Role so khớp nguyên văn, không ánh xạ.
9. (M5) **Không có fallback dữ liệu giả trong code** (bản cũ: gói thành viên giả khi API lỗi, lưu chi tiết bài học "thành công giả", số 0 khi lời gọi phụ lỗi).
10. (M5) **Thao tác ghi khoá mặc định** (write gate) cho tới khi backend xác nhận hợp đồng.
11. (M5) Bỏ các mẫu N+1 ở client (điểm từng bài nộp, hydrate giáo trình cho từng khoá, duyệt 50 trang giao dịch): backend trả sẵn.
12. (M5) Sửa lỗ hổng từ hợp đồng: `classId` bắt buộc, học viên định danh bằng `userId` thay email trên URL (U1–U3), `/leads` chỉ ADMIN (U5), kiểm tra sở hữu lớp ở server (B0).
13. (M5) Dashboard chuẩn hoá (UI STD); modal react-bootstrap → antd; thư mục gắn gói ngay khi tạo (một bước thay hai).
14. (M5) Teacher-manager/Collaborator không được phục vụ (UNKNOWN, 404) dù HSK cũ liệt kê trong PrivateRoute.

## 6. Sửa lỗi SCSS kế thừa (bắt buộc để build bằng Next; không đổi hiển thị)

- `styles/scss/components/_forms.scss`: 5 khai báo `rgba(var($primary), α)` biên dịch ra CSS không hợp lệ ⇒ bỏ (chú thích `[M1]`).
- 2 cảnh báo còn lại là lỗi cũ trong SCSS, giữ nguyên: `.footer .subscribe-input input:placeholder`, `option:select` (pseudo-class không tồn tại; trình duyệt bỏ qua).
- Google Fonts: `@import url()` thứ nhất bị bundler làm rơi ⇒ chuyển sang `<link>` trong `app/layout.tsx`.
- Thứ tự CSS: CSS riêng của từng trang nạp **trước** Bootstrap như bản cũ (`src/styles/page-styles.ts`).
