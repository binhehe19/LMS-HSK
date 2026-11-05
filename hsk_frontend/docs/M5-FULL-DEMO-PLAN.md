# M5 — Hoàn thiện toàn bộ frontend quản lý LMS HSK + Demo Mode (kế hoạch và ma trận)

Ngày lập: 2026-10-27. Chủ dự án phê duyệt triển khai toàn bộ phạm vi Admin/Teacher + bản demo (master prompt), không dừng sau từng màn.
Đích bàn giao cuối: `LMS_IELTS/hsk_frontend` (sao chép working tree, không push). Tài liệu này là **kế hoạch + ma trận**, trạng thái cuối ở `docs/FEATURE-STATUS.md` và báo cáo bàn giao.

## 0. Ba kết luận khảo sát quyết định kiến trúc

| Nguồn | Kết luận | Hệ quả |
|---|---|---|
| `LMS_IELTS/backend` (repo-lms Java + repo-notification/repo-storage Go) | Chỉ phân quyền `ROLE_ADMIN`; **không có endpoint giảng viên** (lớp được phân công, học viên, chấm bài theo lớp); class/enrollment/session/syllabus là **proxy chỉ đọc từ ERP (CMS)**; `EmailVerifiedFilter` bật (403 `233`); không có ticket, teacher/user CRUD, HSK (hanzi/pinyin), dashboard admin; notification Go có contract khác HSK cũ; storage chỉ có presign/upload/tải, không có listing | Admin: tích hợp thật được `GET /classes`, `/classes/{id}`, `/sessions`, `/enrollments`, `/syllabuses*` (PARTIAL: thiếu trường HSK). Teacher: toàn bộ **MISSING/BLOCKED (B0)** → chỉ demo mock. Nội dung HSK (flashcard/hanzi/quiz…) **MISSING** → mock + hợp đồng |
| `LMS_IELTS/frontend` | Tailwind + shadcn (base-ui), chỉ khu Admin, không responsive shell, không teacher. Pattern tốt: `AdminPageHeader` (tiêu đề + bộ lọc + hành động), `SmartDataTable` (skeleton/rỗng/phân trang), `BaseModal/ConfirmModal`, `EmptyState`, `SearchInput/SelectFilter`, race-guard theo `requestId` | **Không bê component** (khác stack). Mang **pattern** sang bằng Bootstrap/antd của HSK: `ManagementPageHeader`, `DataTable` (port antd DataTable cũ), trạng thái loading/empty/error/waiting thống nhất, xoá luôn qua modal xác nhận |
| `LMS_Frontend` (HSK cũ) | 148 route quản lý; menu Admin 22 mục / Teacher 14 mục; màn nội dung ~30k dòng (package→folder→study-set→item, Excel import, publish, ticket-access) | Chuyển **nguyên nghiệp vụ** cho luồng demo đã cam kết; màn nội dung chuyển theo **mẫu chung** (tree + CRUD item cốt lõi), phần Excel/publish/karaoke… ghi rõ chưa chuyển |

## 1. Luồng demo cam kết (không còn placeholder)

**Admin:** `/demo` → Dashboard → Quản lý lớp học → chi tiết/học viên lớp → Quản lý giảng viên (xem/sửa/khoá trong mock) → Khoá học trực tuyến → Giáo trình → Bài tập / Thẻ ghi nhớ / Hán tự / Ngữ pháp / Từ vựng / Từ điển / Phát âm → Tài liệu học tập → Kho lưu trữ → Quản lý thông báo (lịch sử, gửi mock) → Phân tích hành vi → Sao kê → Phân công công việc → Gói thành viên → reload/back.

**Teacher:** `/demo` → Tổng quan → Quản lý lớp học → Danh sách bài học → Danh sách nộp bài → Chấm bài (chấm, lưu, gửi kết quả — mock) → Chi tiết bài học → Phân tích học tập (danh sách, chi tiết, nhận xét) → Thông báo của tôi → Phân công công việc → các mục nội dung dùng chung (quyền theo ticket).

**Ngoài luồng (báo cáo riêng, không tự cấp quyền):** `Yêu cầu hỗ trợ` (`/instructor/instructor-support-tickets`, UNKNOWN — HSK cũ không PrivateRoute; cần quyết định D-UI-1), mọi route Teacher-manager/Collaborator, các route template tĩnh DreamsLMS (quiz/certificates/earnings/payouts/settings/*), `/admin/admin-user-management` (menu trỏ Auth FE), `/learning-path/manage`, `/kanji-origin/*`, `/ai-practice/*`, `/learning-path/listening-practice/*` (mục menu đã bị comment ở HSK cũ).

## 2. Ma trận route (khu quản lý) — trạng thái mục tiêu

Ký hiệu UI: UI_COMPLETE (parity HSK cũ) · UI_STD (chuẩn hoá theo IELTS pattern, khác HSK cũ có chủ đích) · UI_PARTIAL · NOT_MIGRATED. Tích hợp: API_INTEGRATED (đã xác minh trên môi trường thật — **chưa có môi trường nào**) · AVAILABLE (endpoint IELTS tồn tại, client đã viết, chưa xác minh) · PARTIAL · MISSING · BLOCKED (B0) · DEMO_ONLY (ghi chỉ trong mock).

| Nhóm | Route HSK cũ = mới | Component mới | Quyền (registry) | API backend chung | UI mục tiêu | Tích hợp |
|---|---|---|---|---|---|---|
| Admin tổng quan | `/admin/dashboard` | `admin-dashboard/*` | ADMIN | không có (đề xuất `GET /management/dashboard/overview`) | UI_STD (số liệu HSK: lớp/HV/GV/bài chờ chấm + biểu đồ) | MISSING → mock |
| Admin tổng quan | `/admin/analytics` | `admin-analytics/*` | ADMIN | không có (HSK cũ `/id/analytics/admin/overview`) | UI_COMPLETE | MISSING → mock |
| Lớp học | `/admin/class-management` | có sẵn + adapter LMS | ADMIN | `GET /classes` (paged, ClassSummaryResponse) | UI_COMPLETE | **PARTIAL** (thiếu endDate/actualEndDate/studentCount/duration) |
| Lớp học | `/admin/class-management/students` | `admin-class-students/*` | ADMIN | `GET /classes/{id}`, `/sessions`, `/enrollments` | UI_COMPLETE | **AVAILABLE/PARTIAL** |
| Giảng viên | `/admin/teacher-management` | `teacher-management/*` | ADMIN | không có (HSK cũ `/id/teachers/*` thuộc Auth) | UI_COMPLETE (CRUD trong mock) | MISSING → DEMO_ONLY |
| Thông báo | `/admin/settings/notifications`, `/instructor/instructor-notifications` | có sẵn | ADMIN / TEACHER,MENTOR | repo-notification `GET /notifications` (không lọc), `/unread-count`, `POST /{id}/read`, `/seen/all`; campaign không có REST | UI_COMPLETE | PARTIAL (contract khác); gửi = DEMO_ONLY |
| Khoá học | `/learning-path/online-course/manage` | `online-course/*` | ADMIN | không có | UI_COMPLETE (lưới card + modal) | MISSING → mock |
| Khoá học | `/learning-path/online-course/leads` | `online-course-leads/*` | ADMIN | không có (U5 ở HSK cũ: phải ADMIN) | UI_COMPLETE | MISSING → mock |
| Chương trình | `/learning-path/syllabus/manage` | `syllabus/*` | ADMIN,TEACHER,MENTOR | `GET /syllabuses`, `/syllabuses/{id}`, `/versions` (chỉ đọc, Auth) | UI_PARTIAL (danh sách + chi tiết + module buổi học; modal 4.345 dòng cũ không chuyển hết) | **AVAILABLE** (đọc) / module buổi học MISSING |
| Tài liệu | `/learning-path/lesson-materials/manage` | `lesson-materials/*` | ADMIN | gần: content-packages MATERIAL/SLIDE + storage presign | UI_COMPLETE | PARTIAL (chưa map) → mock |
| Kho tài nguyên | `/instructor/manage-storage` | `storage/*` | ADMIN,TEACHER,MENTOR | storage presign/upload/tải; không có listing | UI_PARTIAL (tree + upload mô phỏng; phụ đề karaoke không chuyển) | MISSING → mock |
| Nội dung HSK | `/flashcard/package`, `/flashcard/manage*`, `/sets/create`, `/sets/:id/edit` | `content/flashcard*` | ADMIN,TEACHER,MENTOR | gần: learning-resources VOCABULARY (khác mô hình) | UI_PARTIAL (tree + thẻ; Excel import chưa chuyển) | MISSING → mock |
| Nội dung HSK | `/vocab-set/manage` | dùng chung flashcard | như trên | như trên | UI_PARTIAL | MISSING |
| Nội dung HSK | `/quiz/manage` | `content/quiz*` | như trên | gần: learning-resources ASSESSMENT | UI_PARTIAL (tree + quiz + câu hỏi cốt lõi) | MISSING |
| Nội dung HSK | `/hanzi/manage`, `/hanzi/create`, `/hanzi/edit/:id`, `/hanzi/manage/create-package`, `/hanzi/manage/select-type` | `content/hanzi*` | như trên | không có | UI_PARTIAL | MISSING |
| Nội dung HSK | `/grammar/manage` | `content/grammar*` | như trên | gần: learning-resources GRAMMAR | UI_PARTIAL | MISSING |
| Nội dung HSK | `/pronunciation/manage`, `/select-type` | `content/pronunciation*` | như trên | không có | UI_PARTIAL | MISSING |
| Nội dung HSK | `/vocabulary/manage` (từ điển) | `content/dictionary*` | như trên | gần: `/learning-resources/dictionary/*` (đọc, VOCABULARY không có hanzi/pinyin) | UI_PARTIAL (tìm + CRUD; import bất đồng bộ chưa chuyển) | MISSING |
| Khác | `/admin/statements` | `statements/*` | ADMIN | không có (payment) | UI_COMPLETE | MISSING → mock |
| Khác | `/admin/tickets` | `work-tickets/*` (quản lý) | ADMIN | không có (`/id/tickets`) | UI_COMPLETE | MISSING → DEMO_ONLY |
| Khác | `/instructor/instructor-tickets` | `work-tickets/*` (giảng viên) | TEACHER,MENTOR | không có | UI_COMPLETE | MISSING → DEMO_ONLY |
| Quản trị | `/admin/membership-management` | `membership/*` | ADMIN | không có (payment) | UI_COMPLETE | MISSING → DEMO_ONLY |
| Quản trị | Quản lý người dùng | liên kết ngoài Auth FE (giữ) | — | Auth FE | — | — |
| Teacher | `/instructor/welcome`, `/instructor/list-class`, `/list-lesson` | có sẵn | TEACHER,MENTOR | không có (`/me/classes` của IELTS là góc nhìn học viên, ERP quyết định) | UI_COMPLETE | **BLOCKED (B0)** → mock |
| Teacher | `/instructor/list-class/submissions` | `instructor-submissions/*` | TEACHER,MENTOR | không có | UI_COMPLETE | BLOCKED → mock |
| Teacher | `/instructor/list-class/grading` | `instructor-grading/*` | TEACHER,MENTOR | không có; IELTS `/management/assessment-attempts` là ADMIN-only, mô hình khác | UI_COMPLETE (ghi: chấm/lưu/gửi) | BLOCKED → DEMO_ONLY |
| Teacher | `/instructor/list-class/lesson-detail` | `instructor-lesson-detail/*` | TEACHER,MENTOR | không có (đề xuất 1 endpoint gộp) | UI_COMPLETE (chỉ đọc như HSK cũ) | BLOCKED → mock |
| Teacher | `/instructor/list-class/learning-analysis`, `/detail` | `instructor-learning-analysis/*` | TEACHER,MENTOR | không có (U1–U3 ở HSK cũ) | UI_COMPLETE (nhận xét = ghi) | BLOCKED → DEMO_ONLY |
| UNKNOWN | `/instructor/instructor-support-tickets` (2 menu) | — | — | không có | NOT_MIGRATED (404) | cần D-UI-1 |

## 3. Demo Mode (thiết kế)

- **Bản build demo = bản build production bình thường** với cấu hình đường dẫn cùng origin (`/api/*`, `/__auth`) + cờ `NEXT_PUBLIC_DEMO_MODE=1`; "giả" nằm ngoài artifact: `scripts/mock-server.mjs` (`MOCK_PROFILE=demo`) + gateway cách ly `scripts/e2e-gateway.mjs`. Guard production của `next.config.ts` không bị nới.
- **An toàn:** demo chỉ chạy khi trang được phục vụ từ host loopback / mạng riêng (`lib/demo/demo-mode.ts`); trên host khác, `AuthInitializer` từ chối chạy (giống guard mock hiện có). Không có fallback mock trong REAL mode: cờ demo chỉ (1) hiện băng-rôn + nút Reset/Đổi vai trò, (2) mở **write gate** cho các thao tác ghi chưa có hợp đồng (`lib/api/write-gate.ts`).
- **Dữ liệu:** `scripts/mock/data/demo.mjs` + `grading-model.mjs` — một tập dữ liệu, mọi số liệu suy ra từ đó; `/__auth/mock-reset` đưa về trạng thái ban đầu.
- **Vào demo:** `npm run demo` → `http://localhost:3100/demo` → chọn Admin / Giảng viên / Mentor / Học viên.

## 4. Gói việc và thứ tự

| # | Gói | Người làm | Ghi chú |
|---|---|---|---|
| I1–I7 | Nền tảng: Demo Mode, `lmsClient`, component dùng chung, DTO/clients chấm bài, mock handlers lõi, `scripts/demo.mjs`, 404 | điều phối (chính) | làm trước để agent dùng |
| W1 | Teacher: submissions + grading + lesson-detail · learning-analysis (+detail) · tickets (GV + Admin) · dashboard/analytics/statements/membership · teacher-management · class students + adapter LMS | 4–5 agent song song | mỗi agent: UI + hook + client + types + mock handler riêng + vitest; không sửa file dùng chung (registry, page-styles, server.mjs, nav/golden) |
| W2 | Nội dung: tree manager chung + flashcard/vocab-set/hanzi/pronunciation · quiz + grammar + dictionary · online-course + leads + lesson-materials + storage · syllabus (rút gọn) | 4 agent song song | như trên |
| Tích hợp | registry/MIGRATED_ROUTES, page-styles, nav tests, ROUTE-STATUS regen, server.mjs HANDLERS, FEATURE-STATUS, typecheck/lint/vitest | điều phối | sau mỗi đợt |
| Kiểm thử | vitest toàn bộ; e2e: specs cũ + smoke demo mới (luồng Admin/Teacher) + visual có chủ đích | điều phối | 343 ca cũ phải xanh (mock profile e2e) |
| Bàn giao | README demo, DEMO-GUIDE, báo cáo 2 kết luận, checkpoint, sao chép sang `LMS_IELTS/hsk_frontend` | điều phối | không push |

## 5. Quyết định chủ dự án cần có (gom về báo cáo cuối)

- D-UI-1 `Yêu cầu hỗ trợ` cho vai trò nào (UNKNOWN). D-UI-2 chấp nhận UI_STD cho Dashboard và các modal react-bootstrap → antd. D-UI-3 phạm vi rút gọn của màn nội dung/giáo trình/kho lưu trữ.
- D-API-1 môi trường dev/staging backend IELTS + tài khoản để xác minh AVAILABLE → INTEGRATED. D-API-2 backend bổ sung endpoint giảng viên theo B0 (`docs/B0-P0-SECURITY-REVIEW.md` mục 9). D-API-3 contract campaign/notification lọc.
