# M3B.2 — Màn Teacher đầu tiên (`/instructor/welcome`), quyền, E2E cách ly, độ trung thực CSS

Phạm vi: xử lý các tồn tại của M3B.1 và chuyển **một** màn Teacher thật. Không có module nào khác, không API thật, không đổi Authentication/token. M2 vẫn ở **REAL AUTH VERIFICATION PENDING**.
Phân biệt: `UI COMPLETE` ≠ `API INTEGRATED` ≠ `WAITING FOR BACKEND`.

## 1. Đối chiếu số lượng route (M3B.1 báo 278 vs 148 + 129 = 277)

Nguyên nhân: **278 là số khai báo, không phải số đường dẫn.** Router cũ khai báo `/instructor/instructor-profile` **hai lần** (dòng 1171 và 1285, cùng component `InstructorProfile`, cùng không guard).
Báo cáo M3B.1 gộp trùng ở nhóm quản lý (148) nhưng không nêu rõ. Đối chiếu đầy đủ (do script sinh, có test): **278 khai báo = 277 đường dẫn duy nhất + 1 khai báo trùng; 277 = 148 route khu quản lý + 129 route học viên/công khai (ngoài phạm vi).**
Không có route nào bị bỏ sót hay trùng ngoài chủ đích: `tests/route-registry.test.ts` kiểm tra đẳng thức trên, mỗi đường dẫn đúng một lần trong registry, tập "ngoài phạm vi" tách rời registry (`OLD_OUT_OF_SCOPE_PATHS`, 129 đường dẫn, gồm `"/"` — chuyển hướng về trang học viên — và `"*"` — trang 404 của app cũ),
và không route ngoài phạm vi nào được phục vụ. Đối chiếu thêm: 35 route có tham số (`:id`…) khớp bằng mẫu; không có alias riêng (các URL "legacy" là đường dẫn khác, đã được tính riêng); menu Admin/Teacher đều trỏ tới đường dẫn đã đăng ký hoặc liên kết ngoài (test); các trang Next thật (`page.tsx`) = `MIGRATED_ROUTES` (test).
**Trạng thái UNKNOWN không bị đổi để làm số khớp**: phân bố sau M3B.2 là 2 MIGRATED · 72 NOT_MIGRATED… (xem `docs/ROUTE-STATUS.md`, tự sinh).

## 2. Quyết định về quyền (đã áp dụng)

Cơ chế: `UI_ROLE_DECISIONS` trong `lib/management/route-registry.ts` — chỉ áp dụng cho route **không có PrivateRoute** ở HSK cũ, chỉ role đã hỗ trợ, ghi rõ nguồn là **quyết định giao diện của chủ dự án, không phải xác nhận từ backend**.

| Route | Quyết định | Kiểm tra lại source cũ trước khi áp dụng | Xung đột/rủi ro? |
|---|---|---|---|
| `/instructor/welcome` | TEACHER, MENTOR (giao diện) | Component không có guard; chỉ đổi nhãn theo role (`Cộng tác viên` / `Giảng viên` / `Người dùng`). Dữ liệu = `GET /tickets` (+ đếm thông báo). Backend `TicketService.list`: principal **không** privileged chỉ nhận ticket có `assignedId` = chính mình; privileged (Admin/Teacher-manager) nhận tất cả | Không. Dữ liệu được backend tự giới hạn theo người dùng; frontend cũng lọc lại. Admin/Collaborator/Teacher-manager **không** được cấp (Admin vào → "Không có quyền truy cập") |
| `/instructor/instructor-notifications` | TEACHER, MENTOR (giao diện) → NOT_MIGRATED (placeholder) | Component có nhánh riêng cho Admin/Teacher-manager (`canSendNotification`) và dùng `AdminSidebar`/`TeacherManagerSidebar`; nhánh Teacher chỉ đọc | Không. Admin dùng `/admin/settings/notifications` (PrivateRoute ADMIN, đã NOT_MIGRATED). Màn đầy đủ chưa chuyển |
| `/instructor/instructor-support-tickets` | **vẫn UNKNOWN** (404) | Xem mục 3 | — |

## 3. Khảo sát `/instructor/instructor-support-tickets` (giữ UNKNOWN)

- HSK cũ: **không bọc PrivateRoute**. Component chọn chế độ theo role: Admin/Teacher-manager → `GET/POST /id/management/support-tickets…` (xem mọi yêu cầu, trả lời); còn lại (Teacher…) → `/id/support-tickets` (tạo/xem yêu cầu của chính mình, huỷ, bình luận), kèm upload đính kèm (`MediaUploadService`).
- Backend (`repo-lms-identity`, chỉ đọc): `SupportTicketController` (`/support-tickets`) **không có `@PreAuthorize` ở cấp phương thức**; quyền sở hữu do `SupportTicketService` thực thi (`listMine` lọc `createdBy = principal.userId()`, các thao tác khác so `createdBy`). `SupportTicketManagementController` (`/management/support-tickets`) chỉ `ROLE_ADMIN`, `ROLE_TEACHER_MANAGER`.
- Kết luận: dữ liệu **được bảo vệ theo chủ sở hữu ở backend**, nên việc cho Teacher/Mentor thấy giao diện không làm lộ dữ liệu người khác; nhưng (a) route cũ thật sự không giới hạn role, (b) màn này có ghi dữ liệu (tạo/huỷ/trả lời) và upload, (c) Admin dùng cùng route cho chế độ quản lý với endpoint riêng.
  Chưa đủ cơ sở để tự quyết định role → **giữ UNKNOWN (404)**. Cần chủ dự án quyết: role nào thấy giao diện (đề xuất sau khảo sát: TEACHER, MENTOR cho chế độ cá nhân; ADMIN cho chế độ quản lý — hai chế độ nên là hai route/quyền riêng khi chuyển).
- Không phát hiện nguy cơ truy cập trái phép phát sinh từ hai quyết định ở mục 2.

## 4. Màn đã chuyển: `/instructor/welcome` ("Tổng quan")

**Đánh giá phù hợp làm milestone nhỏ: CÓ.** Một component (307 dòng), không có thao tác ghi, một khối CSS nội tuyến tự chứa, sidebar dùng khung đã làm ở M3A, chỉ phụ thuộc hai API **đã có client**:
danh sách ticket (`getTickets(0, 50)`) và số thông báo chưa đọc (`getUnreadCount`). Không tải lên/xuống, không điều hướng phức tạp. Hai nút điều hướng tới `/instructor/instructor-tickets` (placeholder) và `/instructor/instructor-settings`.

Giữ nguyên (đã đối chiếu từng pixel với HSK cũ, mục 8): URL, DOM, class, style nội tuyến, chữ, bố cục + responsive, màu/font, hover thẻ thống kê.

Khác bản cũ **có chủ đích**:
1. Số liệu không có (dịch vụ chưa cấu hình / lỗi) hiện **"—"** + dòng thông báo (`WAITING FOR BACKEND` hoặc thông điệp lỗi + nút "Thử lại"), thay vì số 0 như đang có dữ liệu thật (cùng quy ước với màn lớp học ở M1). Đang tải vẫn hiện 0 như cũ. Trạng thái có dữ liệu giống hệt.
2. Tên hiển thị: `fullName || email || "Giảng viên"` (cũ: `name || username || "Giảng viên"`; Auth chung không trả `username`).
3. Nhãn vai trò: chỉ "Giảng viên" (TEACHER/MENTOR) / "Người dùng"; Collaborator chưa được hỗ trợ.
4. Không dùng Redux cho ticket (cũ: `ticket-slice` cache cả phiên); mỗi lần vào màn gọi lại một lần. Redux của app mới chỉ dành cho Auth.
5. Đếm thông báo chưa đọc gọi riêng như bản cũ (poll 30 giây, thêm một lời gọi song song với chuông ở sidebar — bản cũ cũng vậy).

Nút **"Cài đặt hồ sơ"** → `/instructor/instructor-settings` là route UNKNOWN (HSK cũ không có PrivateRoute) nên hiện tại dẫn tới 404; giữ nguyên hành vi điều hướng của bản cũ, không tự đổi đích. Cần quyết định cùng nhóm route cài đặt.

## 5. Kiến trúc theo conventions IELTS

```
app/(management)/instructor/welcome/page.tsx                  page mỏng (render component container)
components/management/instructor-welcome/
  instructor-welcome-page-content.tsx   container: user từ Redux (Auth), router, ghép hook + view
  use-instructor-welcome.ts             hook cạnh component: ticket (lib/api/ticket-client) + useUnreadCount (dùng lại)
  instructor-welcome-view.tsx           view thuần (props), dùng ManagementPageFrame (rowClassName="g-4")
  instructor-welcome.styles.ts          CSS nội tuyến lấy nguyên văn
lib/instructor-welcome/welcome-summary.ts   hàm thuần: summarizeAssignedTickets, welcomeRoleLabel
lib/api/ticket-client.ts, notification-client.ts  (đã có từ M3A) · types/ticket.ts
```
`ManagementPageFrame` thêm prop `rowClassName` (cũ dùng `.row g-4`); các màn khác không đổi. Sidebar không render trùng (test). Không `features/core/routes/store`, không client/store/Auth thứ hai.

## 6. API dependencies và trạng thái tích hợp

| Chức năng | UI | Tích hợp API |
|---|---|---|
| Hero (tên, email, vai trò), nút điều hướng, bố cục/responsive | UI COMPLETE | không cần API (thông tin từ Auth đã tích hợp mức mock) |
| Số công việc đang phụ trách/đang mở/đã hoàn tất/tỷ lệ | UI COMPLETE | **WAITING FOR BACKEND** (`NEXT_PUBLIC_TICKET_API_BASE_PATH`) |
| Số thông báo chưa đọc | UI COMPLETE | **WAITING FOR BACKEND** (`NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH`) |

Yêu cầu backend: `docs/api-requirements/instructor-welcome.md` (phạm vi dữ liệu ticket đã xác minh từ source backend, giới hạn 50 ticket, đề xuất endpoint đếm). **Không đánh dấu hoàn thành toàn bộ**: màn chỉ hoàn thành phần giao diện, kiểm thử trên mock.

## 7. E2E trong CI — đánh giá và giải pháp (guard production giữ nguyên)

Xem chi tiết ở `docs/TESTING.md` mục "Kiểm thử E2E cách ly". Tóm tắt:
- **Không** bỏ điều kiện `CI`, **không** sửa `next.config.ts` guard, **không** dùng cờ `HSK_ALLOW_MOCK_ENDPOINTS`.
- Bản build e2e là build production bình thường với **đường dẫn cùng origin** (`/api/*`, `/__auth`); gateway cách ly (`scripts/e2e-gateway.mjs`) và mock server nằm ngoài artifact, chỉ bind 127.0.0.1.
- `buildAuthFrontendUrl` hỗ trợ đường dẫn cùng origin (có test); sidebar dùng `useAuthFrontendUrl` để không lệch hydration.
- Chứng minh bằng test: `tests/production-guard.test.ts` chạy `next build` thật và xác nhận **7 cấu hình mock bị từ chối** (kể cả `HSK_ALLOW_MOCK_ENDPOINTS=1` + `CI=true`); `e2e-build.mjs` quét artifact không chứa địa chỉ mock; mỗi test e2e chặn và làm thất bại mọi request ra ngoài loopback (trừ Google Fonts).
- Chưa dựng pipeline CI (ngoài phạm vi). `test:e2e:dev` (next dev, URL mock tuyệt đối) chỉ chạy cục bộ.

## 8. Phát hiện CSS: Turbopack làm rơi rule của SCSS cũ → chuyển sang webpack

Khi so ảnh màn Tổng quan với HSK cũ, ảnh lệch ≤ 4/255 màu ở viền hai thẻ Bootstrap (`card border-0 shadow-sm`). Chẩn đoán:
1. Lặp lại 2 lần trên cùng một app cho 0 pixel khác (old↔old, new↔new) ⇒ **không phải nhiễu vẽ**; old↔new ổn định lệch ⇒ có khác biệt thật.
2. Style tính toán: `.shadow-sm` cũ `rgba(0,0,0,.1) 0 2px 5px`, mới `rgba(0,0,0,.075) 0 2px 4px` (giá trị mặc định của Bootstrap).
3. Nguyên nhân: SCSS cũ có `.shadow-sm { box-shadow: $box-shadow-sm !important }` (có trong đầu ra của sass) nhưng **không còn trong CSS do Turbopack (lightningcss) tạo**, kể cả khi tắt minify; build bằng webpack giữ nguyên rule.
4. Bản mới đã lệch từ M1 mà không bị phát hiện vì màn lớp học/sidebar không dùng `.shadow-sm`.

**Xử lý:** build/dev dùng webpack (`next build --webpack`, `next dev --webpack`) thay vì sửa tay từng rule (Turbopack có thể làm rơi các rule khác chưa kiểm tra). Kiểm chứng: so style tính toán từng phần tử trên 2 màn (850 phần tử, toàn bộ thuộc tính) chỉ còn khác `linear-gradient(a 0%, b 100%)` ≡ `(a, b)` (cùng nghĩa);
phép thử 93 thành phần × 56 thuộc tính + 13 nút hover: **0 khác biệt với HSK cũ** trên bản webpack, **2 khác biệt (`.shadow-sm`)** trên bản Turbopack ⇒ phép thử đủ nhạy. Phép thử được đưa vào repo (`e2e/specs/css-fidelity.spec.ts`, giá trị chuẩn ghi từ HSK cũ bằng `scripts/record-css-golden.mjs`) để chặn tái phát.
Đánh đổi: dev/build webpack chậm hơn Turbopack và khác mặc định của IELTS; đảo lại bằng cách bỏ cờ `--webpack` nếu sau này có cách bảo đảm CSS không bị làm rơi. Phân loại: **lỗi migration (tồn tại từ M1)**, đã sửa.

## 9. Kết quả kiểm thử và visual regression

**Tự động (từ repo, trong bản sao sạch không có `.env.local`/`node_modules`/build, sau `npm ci`):** `tsc` và ESLint sạch · Vitest **450/450** · `e2e:build` (webpack, quét artifact không có địa chỉ mock) · Playwright **201/201**
(configured + unconfigured + visual, gồm `css-fidelity` và chặn mạng ngoài loopback ở mọi test) · `test:e2e:dev` 1/1 (webpack dev) · `npm run build` thành công. Trình duyệt Playwright và mạng vẫn dùng cache/kết nối của máy này.

**So ảnh với HSK cũ (React/Vite) — công cụ ngoài repo, bản build production webpack, Chromium của Playwright:**

| Phạm vi | Kết quả |
|---|---|
| Màn Tổng quan: 3 trạng thái dữ liệu (có dữ liệu, rỗng, thông báo > 99) × desktop/tablet/mobile + hover thẻ thống kê | **10/10 ca: 0 pixel khác, 0 khác biệt DOM/style** |
| Sidebar Admin + Giảng viên, chuông (có/không huy hiệu, `99+`, dropdown mở), toast ticket, thu gọn: 29 ca (3 khung × 2 vai trò) | 28/29 đạt 0 pixel ở lần chạy toàn bộ; ca còn lại (và 3 ca đã lệch ≤ 2/255 ở các lần chạy trước) chạy lại 2–3 lần đều 0 pixel ⇒ **nhiễu vẽ không lặp lại**, không phải lỗi migration |
| `/admin/class-management` toàn trang + vùng nhìn thấy × 3 khung | 0 pixel khác (vẫn còn chênh 0,016 px ở một ô chọn trên tablet như đã ghi từ M1) |
| Style tính toán từng phần tử, 2 màn (≈ 850 phần tử, mọi thuộc tính) | chỉ khác `linear-gradient(a 0%, b 100%)` ≡ `(a, b)` (cùng nghĩa) và tên class antd dev/prod |
| 93 thành phần/tiện ích template × 56 thuộc tính + 13 nút hover | **0 khác biệt** (bản Turbopack: 2 khác biệt `.shadow-sm`) |

Khác biệt đã gặp và phân loại: (a) `.shadow-sm` — **lỗi migration tồn tại từ M1** (Turbopack), đã sửa (mục 8); (b) lệch ≤ 2/255 một vài lần ở vùng chuyển sắc/bóng — **khác biệt môi trường vẽ** (không lặp lại, old↔old và new↔new đều 0 pixel trong cùng điều kiện);
(c) đường dẫn liên kết "Quản lý người dùng" ở sidebar Admin là `/__auth/admin/users` trong bản build e2e (cấu hình Auth cùng origin) so với host Auth thật — **thay đổi có chủ đích của môi trường kiểm thử**, đã chuẩn hoá khi so; (d) "—" thay cho 0 và dòng thông báo khi không có dữ liệu — **thay đổi có chủ đích** (mục 4).
Trang placeholder và hai trạng thái "—"/lỗi của màn Tổng quan là UI mới nên không có bản cũ để so. **Không tuyên bố pixel-perfect ngoài những ca đã đo ở bảng trên** (chỉ trên Chromium/Windows, dữ liệu giả).
