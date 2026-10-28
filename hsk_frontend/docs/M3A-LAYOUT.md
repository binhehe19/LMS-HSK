# M3A — Khung quản lý (layout, sidebar, điều hướng, chuông/toast)

> **Cập nhật M3B.1:** mục 1 (guard theo tiền tố trong layout `admin`/`instructor`) và mục 3 (xử lý route chưa chuyển) đã được thay bằng guard theo từng route và trang placeholder — xem `docs/M3B1-NAVIGATION.md`. Phần còn lại giữ nguyên.

Phạm vi: nền tảng giao diện cho khu Admin và Giảng viên. **Không** gồm dashboard, màn hình nghiệp vụ mới, hay backend thông báo.
Phân biệt: `UI COMPLETE` ≠ `API INTEGRATED` ≠ `WAITING FOR BACKEND`.

## 1. Cấu trúc

```
app/admin/layout.tsx       AuthInitializer + RequireAuth(ROLE_ADMIN)            + ManagementShell area="admin"
app/instructor/layout.tsx  AuthInitializer + RequireAuth(ROLE_TEACHER|MENTOR)   + ManagementShell area="instructor"

components/management/
  management-shell.tsx          .main-wrapper + BackToTop + .sidebar-overlay; cấp `area` qua context
  management-area-context.tsx   ManagementAreaProvider / useManagementArea (thiếu provider => lỗi, không mặc định âm thầm)
  management-page-frame.tsx     .content > .container > .row > <ManagementSidebar/> + .col-lg-9   (trang chỉ khai báo nội dung)
  management-sidebar.tsx        MỘT sidebar dùng chung (DOM/CSS của AdminSidebar & InstructorSidebar cũ)
  management-areas.ts           phần khác nhau giữa hai khu: phụ đề, khóa cuộn, tên mặc định, link toast, hàm dựng menu
  management-nav.ts             kiểu NavItem + quy tắc active
  admin-nav.ts / instructor-nav.ts   menu tĩnh (golden test)
  use-sidebar-collapse.tsx      thu gọn/mở rộng (localStorage `management-sidebar-collapsed`)
  notifications/                SidebarNotificationBell, useUnreadCount (poll 30s + sự kiện), useNotificationList, CSS nguyên văn
  tickets/                      TicketWelcomeToast (2 biến thể manager/instructor), useTicketWelcomeToast, CSS gộp
lib/management/route-status.ts  sổ route đã chuyển (migrated/scaffold) → trạng thái từng mục menu
lib/api/notification-client.ts, ticket-client.ts   client theo service (env base path, chưa cấu hình ⇒ WAITING FOR BACKEND)
lib/notifications/, lib/tickets/                    hàm thuần (huy hiệu, đích bấm, thống kê/thông điệp toast, thời gian tương đối)
```

Không có header quản lý riêng: HSK cũ không có (header công khai bị ẩn ở khu quản lý), nên không tạo mới. Overlay `.sidebar-overlay` giữ như cũ
nhưng không có hành vi (cũ cũng chỉ dùng cho header công khai); sidebar ở màn hình hẹp xếp **phía trên** nội dung (không phải ngăn kéo) và nút thu gọn
bị ẩn ≤ 991.98px — đúng HSK cũ.

Tái sử dụng từ M1.5: `use-sidebar-collapse`, `AssetImage`, `BackToTop`, `RequireAuth/AuthInitializer`, `NavItem`/`isNavItemActive`, `admin-nav`, DOM `AdminPageFrame`
(đổi tên thành `ManagementPageFrame`, `AdminShell` → `ManagementShell`, `AdminSidebar` → `ManagementSidebar`; không tạo `features/core/routes/store`).

## 2. Ma trận menu × vai trò

Quyền truy cập khu vực (nguyên văn, không ánh xạ role; ẩn menu **không** thay thế bảo vệ ở API):

| Role | `/admin/*` | `/instructor/*` | Sidebar | Căn cứ |
|---|---|---|---|---|
| `ROLE_ADMIN` | vào được | **chặn** | Admin (22 mục) | `router.link.tsx` cũ: `/admin/*` = ADMIN |
| `ROLE_TEACHER` | chặn | vào được | Giảng viên (14 mục) | `listClass` cũ: TEACHER, MENTOR |
| `ROLE_MENTOR` | chặn | vào được | Giảng viên (cùng menu Teacher) | `selectIsTeacher` cũ coi MENTOR như TEACHER; ngữ nghĩa với Auth chung **chưa xác minh** |
| `ROLE_TEACHER_MANAGER` | chặn | chặn | không có | **UNKNOWN** — chưa xác minh quyền; không cấp |
| `ROLE_COLLABORATOR` | chặn | chặn | không có | **UNKNOWN** — cũ có menu riêng và vài route cho role này; chưa xác minh |
| `ROLE_MANAGER`, `ROLE_USER`, không role | chặn | chặn | không có | không phải role quản lý đã xác nhận |

Kiểm thử: `tests/route-layouts.test.tsx` (ma trận 9 role × 2 khu), `m3a-browser` (trình duyệt, luồng thật với mock).

Menu Admin (golden `tests/fixtures/admin-nav.golden.json`) và Giảng viên (golden `tests/fixtures/instructor-nav.golden.json`, sinh bằng cách chạy lại **nguyên logic lọc**
của `InstructorSidebar` cũ cho ROLE_TEACHER) — cột cuối là trạng thái đích:

### Admin

| # | Nhóm | Mục | Đích | Trạng thái |
|---|---|---|---|---|
| 1 |  | Overview | `/admin/dashboard` | not-migrated |
| 2 |  | Quản lý thông báo (+huy hiệu) | `/admin/settings/notifications` | not-migrated |
| 3 |  | Phân tích hành vi | `/admin/analytics` | not-migrated |
| 4 |  | Quản lý lớp học | `/admin/class-management` | **migrated** |
| 5 |  | Yêu cầu hỗ trợ | `/instructor/instructor-support-tickets` | not-migrated (*) |
| 6 | HỆ THỐNG ÔN LUYỆN | Quản lý Luyện viết (Hán tự) | `/hanzi/manage` | not-migrated |
| 7 |  | Quản lý Luyện Phát âm | `/pronunciation/manage` | not-migrated |
| 8 |  | Quản lý Thẻ ghi nhớ | `/flashcard/create-package` | not-migrated |
| 9 |  | Quản lý Ngữ pháp | `/grammar/manage` | not-migrated |
| 10 |  | Quản lý Từ vựng | `/vocab-set/manage` | not-migrated |
| 11 |  | Quản lý Bài tập | `/quiz/manage` | not-migrated |
| 12 |  | Quản lý Từ điển | `/vocabulary/manage` | not-migrated |
| 13 | KHÓA HỌC TRỰC TUYẾN | Quản lý Khóa học Trực tuyến | `/learning-path/online-course/manage` | not-migrated |
| 14 |  | Quản lý Tài liệu học tập | `/learning-path/lesson-materials/manage` | not-migrated |
| 15 | CHƯƠNG TRÌNH HỌC | Quản lý Giáo trình | `/learning-path/syllabus/manage` | not-migrated |
| 16 |  | Quản lý Giảng viên | `/admin/teacher-management` | not-migrated |
| 17 |  | Quản lý Thông tin Đăng ký Khóa học Trực tuyến | `/learning-path/online-course/leads` | not-migrated |
| 18 | KHO TÀI NGUYÊN | Quản lý Kho lưu trữ Đa phương tiện | `/instructor/manage-storage` | not-migrated (*) |
| 19 | KHÁC | Sao kê | `/admin/statements` | not-migrated |
| 20 |  | Phân công công việc | `/admin/tickets` | not-migrated |
| 21 | QUẢN TRỊ HỆ THỐNG | Quản lý Gói thành viên | `/admin/membership-management` | not-migrated |
| 22 |  | Quản lý người dùng | `<Auth_FE>/admin/users` (tab mới) | external |

(*) Đích nằm dưới `/instructor/*`. Ở HSK cũ các route này **không có `PrivateRoute`** (hoặc cho phép ADMIN) nên Admin vào được; layout `/instructor/*` của app mới
chỉ cho TEACHER/MENTOR, nên khi chuyển các trang này phải **đặt ở nhóm route dùng chung** (không dưới layout chỉ-Teacher). Quyết định thuộc M3B (xem mục 6).

### Giảng viên (Teacher / Mentor)

| # | Nhóm | Mục | Đích | Trạng thái |
|---|---|---|---|---|
| 1 | TỔNG QUAN | Tổng quan | `/instructor/welcome` | not-migrated |
| 2 |  | Thông báo của tôi (+huy hiệu) | `/instructor/instructor-notifications` | not-migrated |
| 3 |  | Yêu cầu hỗ trợ | `/instructor/instructor-support-tickets` | not-migrated |
| 4 | HỆ THỐNG ÔN LUYỆN | Luyện viết / Phát âm / Thẻ ghi nhớ / Ngữ pháp / Từ vựng / Bài tập / Từ điển (7 mục) | `/hanzi/manage` … `/vocabulary/manage` | not-migrated |
| 11 | CHƯƠNG TRÌNH HỌC | Quản lý Giáo trình | `/learning-path/syllabus/manage` | not-migrated |
| 12 | HỌC VIÊN & LỚP HỌC | Quản lý lớp học | `/instructor/list-class` | **scaffold** (khung kiểm tra, không phải màn thật) |
| 13 | KHO TÀI NGUYÊN | Quản lý Kho lưu trữ Đa phương tiện | `/instructor/manage-storage` | not-migrated |
| 14 |  | Phân công công việc | `/instructor/instructor-tickets` | not-migrated |

Giảng viên không có: Bảng thống kê, Sao kê, Quản lý Tài liệu học tập (cũ: "chưa xử lý cho giảng viên — ẩn"), Học viên/Khóa học trực tuyến/Đăng ký, Gói thành viên.

## 3. Xử lý route chưa chuyển (NOT MIGRATED)

Hiện trạng (chưa có hành vi tạm nào được áp dụng): mọi mục menu vẫn hiện đủ như HSK cũ; mục chưa chuyển có `data-migration-status="not-migrated"` trong DOM và
bấm vào ra **404 của Next** (prefetch tắt). Không có mục nào bị xóa/ẩn, không dẫn tới màn hình không tương đương.
`tests/route-status.test.ts` bắt buộc sổ `lib/management/route-status.ts` khớp các file `page.tsx` thật.

**Đề xuất cần chủ dự án duyệt trước khi đổi hành vi** (khuyến nghị: B):

| | Cách làm | Ưu | Nhược |
|---|---|---|---|
| A | Giữ 404 của Next | không làm gì thêm | người dùng thấy trang lỗi trống, mất khung sidebar |
| **B** | Trang "Chưa chuyển" (catch-all dưới `/admin/[...slug]`, `/instructor/[...slug]` + route dùng chung) hiện **trong khung sidebar**, nói rõ màn đang chuyển, kèm nút về màn đã chuyển | giữ điều hướng, rõ ràng, không giả chức năng | thêm 1 trang + route catch-all (guard role kế thừa layout) |
| C | Mục chưa chuyển thành disabled (tooltip "Chưa chuyển") | không dẫn tới đâu | đổi hành vi so với HSK cũ (mục bấm được → không bấm được); lệch nhận thức "menu giống cũ" |
| D | Liên kết sang HSK cũ (tab mới) | dùng được ngay | cần URL HSK cũ + chạy song song hai app + phiên Auth chung; không "tương đương" nếu UI khác |

## 4. Chuông thông báo và toast ticket

| Hạng mục | UI | API | Ghi chú |
|---|---|---|---|
| Chuông trong `.sidebar-brand` (+ dropdown) | UI COMPLETE, so ảnh với HSK cũ 0 pixel (3 khung × 2 vai trò, có/không huy hiệu, dropdown mở) | **WAITING FOR BACKEND** | chưa cấu hình ⇒ "chưa tích hợp", không số/toast giả; kiểm thử API qua MOCK |
| Huy hiệu chưa đọc ở "Quản lý thông báo"/"Thông báo của tôi" | UI COMPLETE | WAITING FOR BACKEND | `99+` khi > 99; ẩn khi 0/lỗi/chưa cấu hình |
| Toast chào mừng ticket (Admin: manager; Giảng viên: instructor) | UI COMPLETE, 0 pixel so HSK cũ (3 khung × 2 vai trò) | WAITING FOR BACKEND | 1 lần/phiên tab, tự đóng 10 giây |
| Trang "Xem tất cả thông báo", `/admin/tickets`, `/instructor/instructor-tickets` | chưa chuyển | — | not-migrated (M3B+) |
| Huy hiệu VIP cạnh tên giảng viên | **chưa làm** | UNKNOWN | cần cờ `isPremium`; `GET /users/me` của Auth chung không trả cờ này |
| Phát sự kiện `exercise-graded` khi có thông báo chấm bài | chưa port | UNKNOWN | cấp dữ liệu cho màn chưa chuyển |

Khác bản cũ có chủ đích: dropdown điều khiển bằng state React + Popper cùng cấu hình Bootstrap (app mới chưa nạp JS Bootstrap); chuông có `role="button"`, `aria-*`, phím Enter/Space/Escape;
`targetUrl` chỉ nhận đường dẫn nội bộ; chỉ gọi API đếm một lần cho cả chuông và huy hiệu (bản cũ gọi hai lần). Yêu cầu API: `docs/api-requirements/notifications.md`.

## 5. Phát hiện và sửa trong M3A

1. **Lệch phiên bản thư viện (từ M1)**: `bootstrap` 5.3.8 / `@tabler/icons-webfont` 3.49.0 / `@ant-design/icons` 5.6.1 / `dayjs` 1.11.23 (do `^`) so với HSK cũ 5.3.3 / 3.27.1 / 5.5.2 / 1.11.13.
   Biểu hiện: icon "thu gọn menu" lệch glyph vài pixel so với bản cũ (phát hiện khi so ảnh sidebar). **Đã ghim đúng phiên bản của HSK cũ** (+ `@popperjs/core` 2.11.8); ảnh `/admin/class-management` ngoài sidebar không đổi (0 pixel khác so với baseline M1.5).
2. **`joinUrl` thêm `/` trước `?query`** (`.../notification/?page=0`), URL khác với `.../notification?page=0` mà Spring 6 không khớp → sửa + test.

## 6. Kế hoạch M3B (đề xuất — chưa làm)

1. Quyết định cách xử lý route chưa chuyển (mục 3) và chỗ đặt các trang dùng chung dưới `/instructor/*` mà Admin cũng vào được (hỗ trợ, kho lưu trữ, thông báo của tôi).
2. Màn hình khung nhỏ nhất, ít phụ thuộc API: `/admin/settings/notifications` + `/instructor/instructor-notifications` (hoàn thiện luồng chuông), Overview/Welcome.
3. Xác minh vai trò TEACHER_MANAGER và COLLABORATOR với Auth chung; thêm layout/menu khi có bằng chứng.
4. Nối backend thông báo/ticket khi có đường dẫn thật; thay MOCK bằng kiểm thử tích hợp; xác minh Auth thật (blocker M2 vẫn còn).
