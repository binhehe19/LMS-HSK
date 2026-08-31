# LMS HSK — Frontend quản lý (Next.js)

Frontend mới (App Router, TypeScript) cho **khu vực quản lý Admin/Giảng viên** của LMS HSK. Giao diện và nghiệp vụ lấy từ `LMS_Frontend`
(React/Vite cũ), cấu trúc code theo `LMS_IELTS/frontend`, chạy sau gateway của backend chung `LMS_IELTS/backend`. Backend và Authentication do người khác phụ trách.

Trạng thái: **M5 — toàn bộ mục menu Admin (22) và Giảng viên (14) đã là trang thật**; tích hợp backend thật
mới ở mức AVAILABLE cho lớp/học viên/giáo trình (`/api/lms`), thông báo (`/api/notification`), tải tệp (`/api/storage`) — phần còn lại chờ backend (WAITING FOR BACKEND).
Hai kết luận tách riêng và bảng trạng thái từng màn: **`docs/FEATURE-STATUS.md`**. Kế hoạch/ma trận: `docs/M5-FULL-DEMO-PLAN.md`. Triển khai: **`docs/DEPLOY.md`**.
Lịch sử milestone: `docs/M1-MANIFEST.md`, `M1.5-REFACTOR.md`, `M3A-LAYOUT.md`, `M3B1-NAVIGATION.md`, `M3B2-WELCOME.md`, `M3B3-NOTIFICATIONS.md`, `M3B4-ADMIN-NOTIFICATIONS.md`, `M4A-LIST-CLASS.md`, `M4B-LIST-LESSON.md`, `M4C0-SURVEY.md`.
Quy ước phát triển: **`docs/code-standards.md`** (+ `docs/M5-AGENT-BRIEF.md` cho màn M5). Backlog kỹ thuật: `docs/TECH-BACKLOG.md`.

## Yêu cầu

Node.js ≥ 20.9 (đã kiểm tra với Node 22.19, npm 10.9). Next 16.3.5, React 19.2.8 (cùng phiên bản `LMS_IELTS/frontend`). Build/dev dùng **webpack** (Turbopack làm rơi `.shadow-sm` của SCSS cũ — `docs/M3B2-WELCOME.md` mục 8).

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm ci` | Cài dependencies |
| `npm run dev` | Dev server cổng **3100** (HMR); cần biến môi trường trỏ backend/Auth thật (`.env.example`) |
| `npm run build` / `npm start` | Build production / chạy (cổng 3100). Build **từ chối** cấu hình trỏ `localhost`/`.invalid`/`.test` hoặc `*_API_PROXY_TARGET` |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint CLI |
| `npm test` | Vitest (hook, view, hàm thuần, client API từng dịch vụ, guard production) |
| `npm run test:all` | typecheck → lint → vitest |
| `docker compose build && docker compose up -d` | Container theo mẫu IELTS (Traefik, `HSK_DOMAIN`) — `docs/DEPLOY.md` |

Biến môi trường: `.env.example` (không có giá trị mặc định trỏ hệ thống thật; để trống = dịch vụ chưa tích hợp ⇒ màn hiện WAITING FOR BACKEND, không gọi mạng, không dữ liệu giả).
Công tắc thao tác ghi `NEXT_PUBLIC_WRITE_*` mặc định ĐÓNG — chỉ mở sau khi backend xác nhận hợp đồng (`docs/DEPLOY.md` mục 5).

## Kiến trúc dữ liệu

```
trình duyệt ─ Auth chung (NEXT_PUBLIC_AUTH_*: /users/me, refresh một lần, logout)
           ├─ lmsClient          /api/lms           backend chung repo-lms (Java): lớp, học viên, giáo trình — ROLE_ADMIN, chỉ đọc (proxy ERP)     AVAILABLE/PARTIAL
           ├─ notification-client /api/notification backend chung repo-notification (Go): chuông, danh sách, đã đọc (lọc ở client)               AVAILABLE
           ├─ storage-client     /api/storage       backend chung repo-storage (Go): presign → PUT → confirm, tải tệp                            AVAILABLE
           ├─ hskClient          NEXT_PUBLIC_HSK_API_BASE_PATH   hợp đồng ĐỀ XUẤT HSK: giảng viên, thanh toán, khoá học, kho nội dung, dashboard… MISSING
           ├─ quizClient         NEXT_PUBLIC_QUIZ_API_BASE_PATH  hợp đồng ĐỀ XUẤT luồng giảng viên/chấm bài (B0 OPEN)                             BLOCKED
           └─ ticket-client      NEXT_PUBLIC_TICKET_API_BASE_PATH ticket phân công / toast chào mừng                                                MISSING
write gate (lib/api/write-gate.ts): mọi thao tác ghi chưa có hợp đồng xác nhận bị chặn trước khi tạo request; mở bằng xem trước cục bộ hoặc NEXT_PUBLIC_WRITE_<FEATURE>=enabled
```

Không có fallback mock trong `src/`.

## Cấu trúc

```
src/
  app/                       routing, layout (page mỏng → <XPageContent/>)
    layout.tsx               CSS theo thứ tự cascade của HSK cũ (styles/page-styles.ts trước Bootstrap), font, ReduxProvider, AntdRegistry, vá antd static API cho React 19
    (management)/layout.tsx  ManagementRouteGate: guard THEO TỪNG ROUTE (lib/management/route-registry.ts) + khung quản lý theo role
    (management)/…           trang thật ở ĐÚNG URL HSK cũ; (management)/[...slug]/ chỉ phục vụ placeholder cho route NOT_MIGRATED (còn lại 404)
    demo/                    trang chọn tài khoản của chế độ xem trước cục bộ (chỉ hoạt động khi NEXT_PUBLIC_DEMO_MODE=1 trên loopback/mạng riêng)
  components/
    auth/                    AuthInitializer, RequireAuth, ReduxProvider, auth-panels
    management/              khung (ManagementShell, ManagementPageFrame, ManagementSidebar, admin-nav/instructor-nav, migration-placeholder) và từng màn:
                             admin-dashboard, admin-analytics, class-management, admin-class-students, teacher-management, notifications, online-course-*,
                             lesson-materials-management, syllabus, manage-storage, statements, work-tickets, membership-management,
                             instructor-welcome, instructor-class-list, instructor-lesson-list, instructor-submissions, instructor-grading,
                             instructor-lesson-detail, instructor-learning-analysis, content-tree (nền) + content-flashcard/-hanzi/-pronunciation/-quiz/-grammar, dictionary
    shared/                  PageHeader, DataTable (antd), confirmAction, FetchStateNotice/WriteLockedNotice, ApexChart, AssetImage, antd-static-render
    demo/                    băng-rôn xem trước + Reset/Đổi vai trò
  hooks/                     useWriteGate, useDemoMode, useContentAccess (quyền theo ticket)
  lib/
    api/                     api-client, auth-client (chỉ /users/me)/auth-session (thông báo hết phiên), lms-client + lms-*-client, notification-client, storage-client, hsk-client + *-client, quiz-grading-client, ticket-client, write-gate
    auth/ management/ tickets/ demo/ notifications/ class-management/ grading/ content/ …   hàm thuần theo miền
  redux/                     store, slices/auth-slice (chỉ auth)
  types/                     DTO theo dịch vụ (lms, grading, content-*, payment, ticket, …)
  styles/                    SCSS/CSS của HSK cũ, page-styles.ts (thứ tự cascade)
scripts/   survey-old-routes.mjs
tests/ (Vitest)   docs/ (api-requirements/*.md = hợp đồng gửi backend)
```

Nguyên tắc: view (`*-view.tsx`) không gọi API; dữ liệu đi qua hook → `lib/api/*-client`. Màn thiếu API vẫn hoàn thiện UI, hiện trạng thái `WAITING FOR BACKEND`/lỗi (+ Thử lại), **không** có dữ liệu giả tự động, không "thành công giả".

## Vai trò

Quyền theo **từng route** (`docs/ROUTE-STATUS.md`, tự sinh từ `route-registry`): role HSK cũ cho phép (PrivateRoute) ∩ {ADMIN, TEACHER, MENTOR}. Role so khớp nguyên văn, không gộp/ánh xạ;
route HSK cũ không có PrivateRoute, hoặc chỉ dành cho Teacher-manager/Collaborator, ở trạng thái UNKNOWN và trả 404 (`Yêu cầu hỗ trợ` chờ quyết định D-UI-1). Quyền sửa nội dung của giảng viên theo ticket phân công (`lib/tickets/ticket-access.ts`).
Bằng chứng và việc cần xác minh với Auth thật: `docs/AUTH-INTEGRATION.md`, `docs/BACKEND-AUTH-HANDOVER.md`, `docs/B0-*.md`.

## Đối chiếu giao diện với HSK cũ

M1–M4B: sidebar, chuông/toast/dropdown, `/admin/class-management`, `/instructor/welcome`, thông báo, lớp/bài học của giảng viên khớp HSK cũ **từng pixel** (3 khung, dữ liệu fixture, công cụ ngoài repo).
M5: các màn mới đối chiếu **nghiệp vụ** (trường, bộ lọc, hành động, thuật ngữ) và giữ DOM/class để SCSS cũ áp dụng; khác có chủ đích (modal antd, dashboard chuẩn hoá, phạm vi rút gọn) ghi ở `docs/FEATURE-STATUS.md` mục 3 và 5. Chưa so sánh với dữ liệu thật.
