# M3B.1 — Nền tảng điều hướng, ranh giới quyền theo route, hạ tầng kiểm thử

> **Cập nhật M3B.2:** số liệu 278/148/129 được giải thích đầy đủ (278 khai báo = 277 đường dẫn + 1 khai báo trùng); `/instructor/welcome` và `/instructor/instructor-notifications` đã có quyết định quyền giao diện; `/instructor/welcome` là trang thật; E2E không còn dùng cờ ngoại lệ mock. Xem `docs/M3B2-WELCOME.md`.

Phạm vi: xử lý menu chưa chuyển (phương án B), phân quyền route dùng chung, đưa kiểm thử vào repository. **Không** có dashboard mới, trang thông báo đầy đủ, module nghiệp vụ,
API thật, thay đổi Authentication. M2 vẫn ở **REAL AUTH VERIFICATION PENDING**.

## 1. Nguồn sự thật duy nhất về route

```
scripts/survey-old-routes.mjs ──(đọc chỉ-đọc HSK cũ @ 72292b7)──▶ src/lib/management/old-routes.generated.ts   dữ kiện: route, component, guard, role
                                                                      │
 lib/auth/roles.ts  MANAGEMENT_SUPPORTED_ROLES (ADMIN, TEACHER, MENTOR)│
 lib/management/route-registry.ts  MIGRATED_ROUTES  ◀────────────────┘  quyết định: status + role app mới enforce
        │
        ├─▶ management-route-gate.tsx   guard theo TỪNG route (layout nhóm route `(management)`)
        ├─▶ app/(management)/[...slug]/page.tsx   chỉ phục vụ placeholder cho route NOT_MIGRATED, còn lại notFound()
        ├─▶ management-sidebar.tsx      data-migration-status của từng mục menu
        ├─▶ tests/route-registry.test.ts  đối chiếu với App Router thật + cấu hình menu; sinh docs/ROUTE-STATUS.md
        └─▶ e2e/specs/navigation.spec.ts  duyệt chính cấu hình menu, kiểm tra từng mục trong trình duyệt
```

Không còn danh sách route thứ hai (đã xóa `route-status.ts` với `SCAFFOLD_ROUTES`). `docs/ROUTE-STATUS.md` là hình chiếu tự sinh của registry; `docs/OLD-ROUTE-SURVEY.md` là khảo sát HSK cũ (278 route).

**Trạng thái** (148 route khu quản lý): MIGRATED 1 · NOT_MIGRATED 72 · UNKNOWN 51 · OUT_OF_SCOPE 24. Route học viên/công khai (129) không nằm trong registry (ngoài phạm vi, trả 404).

| Trạng thái | Quy tắc (cài trong `classifyRoute`, có test) | Hành vi |
|---|---|---|
| MIGRATED | có `page.tsx` thật + nằm trong `MIGRATED_ROUTES` | trang thật |
| NOT_MIGRATED | HSK cũ bọc `PrivateRoute allowedRoles`, và giao với role app mới hỗ trợ ≠ ∅ | trang "Chức năng đang được chuyển đổi" ở đúng URL cũ |
| UNKNOWN | HSK cũ **không bọc PrivateRoute**, hoặc chỉ dành cho role chưa xác minh (Teacher-manager, Collaborator) | **404** — không tự coi là hợp lệ |
| OUT_OF_SCOPE | HSK cũ chỉ hiện `UnderConstructionContent` | 404 |

## 2. Cách làm placeholder

- **Một component** (`MigrationPlaceholder`) và **một trang động** `app/(management)/[...slug]/page.tsx`. Không có chục trang placeholder. Trang này **không** bắt mọi URL: nó tra registry, chỉ route
  `NOT_MIGRATED` mới render, mọi URL khác (sai, UNKNOWN, OUT_OF_SCOPE, học viên) gọi `notFound()` ⇒ HTTP 404 (kiểm thử trong trình duyệt: 13 URL, cả khi chưa đăng nhập: không bị bắt đăng nhập, không lộ khung).
- Khi chuyển xong một màn: tạo `page.tsx` ở **đúng URL cũ** trong `app/(management)/…` và thêm đường dẫn vào `MIGRATED_ROUTES`. Next ưu tiên route tĩnh hơn route động nên trang thật thay placeholder, URL giữ nguyên;
  `route-registry.test.ts` fail nếu `page.tsx` và `MIGRATED_ROUTES` lệch nhau, hoặc nếu có trang nằm ngoài nhóm `(management)` (ngoài tầm guard).
- Sidebar, menu, active, điều hướng giữ nguyên (placeholder nằm trong `ManagementPageFrame`). Nội dung: tên mục menu (nếu có), lời giải thích "địa chỉ không đổi",
  nút "Về <màn hình đã chuyển>" **chỉ khi vai trò có màn đã chuyển** (Admin: Quản lý lớp học; Teacher/Mentor hiện **chưa có** nên chỉ hiện dòng "chưa có màn hình quản lý nào đã chuyển cho vai trò của bạn"),
  nút "Quay lại trang trước" chỉ khi có trang trước (Navigation API `canGoBack`). Không có nút/chức năng giả.

## 3. Ranh giới Auth guard theo route

Vấn đề M3A: layout `/instructor/*` chỉ cho TEACHER/MENTOR nên chặn nhầm Admin ở route dùng chung dưới `/instructor/*` (kho lưu trữ), còn guard theo tiền tố không biểu diễn được các URL dùng chung ngoài `/admin`, `/instructor` (`/hanzi/manage`, `/quiz/manage`…).
Điều chỉnh: bỏ `app/admin/layout.tsx` và `app/instructor/layout.tsx`; toàn bộ khu quản lý nằm trong nhóm route `app/(management)/` (không đổi URL). `ManagementRouteGate` (client) tra `getServedRoute(pathname)`:

- route được phục vụ → `AuthInitializer` + `RequireAuth allowedRoles={route.allowedRoles}` + khung quản lý, sidebar chọn theo **role** (Admin ưu tiên → menu Admin; Teacher/Mentor → menu Giảng viên, như `InstructorSidebar` cũ);
- route không phục vụ → không gọi Auth, không hiện khung; children chỉ có thể là 404.

`allowedRoles` = role HSK cũ liệt kê trong `PrivateRoute` ∩ {ADMIN, TEACHER, MENTOR}. **Quyền nghiệp vụ không đổi so với HSK cũ**, chỉ bỏ phần role chưa xác minh (không mở rộng cũng không thu hẹp phần đã xác minh).
Không cấp Admin trên toàn bộ `/instructor/*`, không cấp Teacher trên màn Admin (kiểm thử trong trình duyệt và vitest).

### Cơ chế guard thực tế của HSK cũ

`PrivateRoute` (`core/common/private-route.tsx`): chưa đăng nhập → chuyển Auth; có `allowedRoles` mà không có role nào khớp → `/error-403`; không `allowedRoles` → chỉ cần đăng nhập. Route không bọc `PrivateRoute` **không có guard nào ở tầng route**.
Ba route trong menu không bọc PrivateRoute; component của chúng không chặn truy cập mà chỉ đổi giao diện theo role (`selectIsAdmin`/`selectIsTeacher`/`selectIsTeacherManager`) — đó là bằng chứng **ý định dùng** chứ không phải guard, nên không được suy ra quyền.

### Route dùng chung Admin/Teacher đã xác minh bằng PrivateRoute (25 route)

HSK cũ liệt kê `TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR` cho: `/flashcard/{manage,create-package,manage-learning-path,manage-learning}`, `/vocab-set/manage`, `/instructor/manage-storage`, `/hanzi/{create,manage,manage/create-package,manage/select-type,edit/:id}`,
`/vocabulary/manage`, `/learning-path/{create,manage,syllabus/manage,listening-practice/manage}`, `/kanji-origin/manage` (+`/select-type`), `/pronunciation/manage` (+`/select-type`), `/quiz/manage`, `/grammar/manage`, `/ai-practice/manage`, `/sets/create`, `/sets/:id/edit`.
App mới enforce ADMIN + TEACHER + MENTOR (Teacher-manager, Collaborator: UNKNOWN, không cấp).

### Các route có liên quan đến yêu cầu của anh

| Route | Component cũ | Guard cũ | Role cũ | App mới | Menu |
|---|---|---|---|---|---|
| `/instructor/instructor-support-tickets` (ticket hỗ trợ) | InstructorSupportTickets | **không PrivateRoute** | — (component có nhánh cho ADMIN/TEACHER/TEACHER_MANAGER) | **UNKNOWN → 404** | Admin + Teacher |
| `/instructor/instructor-notifications` (thông báo của tôi) | InstructorNotification | **không PrivateRoute** | — (component có nhánh ADMIN/TEACHER_MANAGER) | **UNKNOWN → 404** | Teacher (Admin dùng `/admin/settings/notifications`) |
| `/admin/settings/notifications` | AdminNotification | PrivateRoute | ADMIN | NOT_MIGRATED, ADMIN | Admin |
| `/instructor/welcome` | InstructorWelcome | **không PrivateRoute** | — | **UNKNOWN → 404** | Teacher |
| `/instructor/manage-storage` (kho lưu trữ) | ManageStorage | PrivateRoute | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | NOT_MIGRATED, ADMIN+TEACHER+MENTOR | Admin + Teacher |
| `/instructor/instructor-tickets` (phân công công việc) | InstructorTickets | PrivateRoute | TEACHER, MENTOR, COLLABORATOR | NOT_MIGRATED, TEACHER+MENTOR (Admin **không**: dùng `/admin/tickets`) | Teacher |
| `/instructor/list-class*` (7 route) | ClassListPage… | PrivateRoute | TEACHER, MENTOR | NOT_MIGRATED, TEACHER+MENTOR (Admin **không**) | Teacher |
| `/admin/tickets`, `/admin/*` (44 route) | … | PrivateRoute | ADMIN | NOT_MIGRATED/OUT_OF_SCOPE | Admin |
| `/learning-path/online-course/{manage,leads}`, `/learning-path/lesson-materials/manage` | … | PrivateRoute | ADMIN, TEACHER_MANAGER | NOT_MIGRATED, ADMIN | Admin |

19 route `/instructor/*` không bọc PrivateRoute (ngoài `UnderConstruction`) đều ở UNKNOWN (danh sách trong `docs/ROUTE-STATUS.md`). **4 mục menu rơi vào 404 vì UNKNOWN** (trỏ tới 3 route): Admin "Yêu cầu hỗ trợ"; Teacher "Tổng quan", "Thông báo của tôi", "Yêu cầu hỗ trợ".
Menu vẫn hiện đủ như HSK cũ — chỉ là đích chưa được phục vụ cho tới khi có quyết định.

## 4. Việc cần chủ dự án quyết định

1. **3 route UNKNOWN trong menu** (`welcome`, `instructor-notifications`, `instructor-support-tickets`): HSK cũ không có guard. Để phục vụ placeholder cần anh xác nhận role được vào (đề xuất dựa trên nhánh trong component: support-tickets cho ADMIN+TEACHER+MENTOR;
   notifications cho TEACHER+MENTOR (Admin có trang riêng); welcome cho TEACHER+MENTOR). Khi anh xác nhận, thêm vào cấu hình override có chú thích bằng chứng (hiện chưa có cơ chế override vì chưa có quyết định).
2. **Teacher-manager / Collaborator**: vẫn UNKNOWN (39 route `/teacher-manager/*` + phần role trong route dùng chung).
3. Liên kết "về màn hình đã chuyển" cho Teacher/Mentor cần có ít nhất một màn Teacher thật (đề xuất M3B.2).

## 5. Kiểm thử

Xem `docs/TESTING.md`. Vitest 394 (registry, guard theo route × 9 role, placeholder, trang động); Playwright 178 + 1 dev-proxy (auth, khung, thông báo/toast, điều hướng, lớp học, chưa cấu hình, visual).
