# M3B.3 — Màn "Thông báo của tôi" của giảng viên (`/instructor/instructor-notifications`)

Trạng thái: **UI COMPLETE · API WAITING FOR BACKEND · TESTED trên MOCK**. Không có chức năng nào ở mức `API INTEGRATED`.
Nguồn so sánh: `LMS_Frontend` @ `72292b7` (chỉ đọc). Phạm vi: chỉ `LMS_HSK/frontend`.

## 1. Khảo sát các màn thông báo của HSK cũ

Trả lời 10 câu hỏi cho từng màn. "Template" = trang mẫu DreamsLMS không thuộc sản phẩm thật.

| Màn / thành phần (HSK cũ) | Route | Thật hay template | Có trong menu/luồng | Role | Component + CSS | Đọc / ghi | Loading / rỗng / lỗi | Phụ thuộc backend | Khi chuyển sang Next |
|---|---|---|---|---|---|---|---|---|---|
| **Thông báo của tôi** `InstructorNotification` + `NotificationListContent` + hook `useNotificationList` | `/instructor/instructor-notifications` (không PrivateRoute) | **Thật** (dùng chung với Admin/Teacher-manager) | Menu Giảng viên "Thông báo của tôi"; chuông → "Xem tất cả thông báo"; nút ở màn Tổng quan | Không có guard ở route; quyết định giao diện của chủ dự án: TEACHER, MENTOR | Class Bootstrap/SCSS template, không có CSS riêng; antd `RangePicker`; sonner toast | Đọc: `GET /notification?readStatus&fromDate&toDate&page&size`. Ghi: `POST /notification/{id}/read`, `POST /notification/read/all` | Spinner + "Đang tải..."; rỗng "Không tìm thấy thông báo nào"; **lỗi chỉ hiện toast rồi hiện trạng thái rỗng** | `repo-lms-notification` (đường dẫn thật chưa xác nhận) | **ĐÃ CHUYỂN** (M3B.3) |
| Cùng component, nhánh Admin/Teacher-manager (`canSendNotification`) | `/admin/settings/notifications` (ADMIN), `/teacher-manager/settings/notifications` (TEACHER_MANAGER) — hai wrapper 9 dòng bọc `InstructorNotification` | **Thật**, có thao tác ghi | Menu Admin "Quản lý thông báo" | ADMIN; TEACHER_MANAGER (chưa xác minh) | + `ManualNotificationComposer` (189 dòng), `CampaignHistoryModal` (171), `RecipientSelectorModal` (265, gọi `adminUserService.getUsers` để tìm/chọn người nhận), `CampaignPreviewModal` (66) | Ghi: `POST /notification/admin/campaigns/send-now` `{title, message, userIds[]}`; đọc: `GET /notification/admin/campaigns?page&size`; `GET` danh sách người dùng của dịch vụ identity | Như trên cộng toast; chưa khảo sát từng trạng thái | Notification service + API quản trị người dùng | **CHƯA chuyển** (vượt phạm vi M3B.3: là màn Admin có gửi thông báo hàng loạt). Hợp đồng cần xác nhận ở mục 6 |
| Chuông + dropdown ở sidebar | (thành phần, không có route) | Thật | Mọi sidebar quản lý | Mọi role quản lý | Đã chuyển ở M3A | `GET /unread-count`, `GET ?page=0&size=10`, `POST /{id}/read`, `POST /read/all` | Đã có | Như trên | Đã chuyển (M3A) — M3B.3 **dùng lại**, không viết lại |
| `Notification` (trang mẫu) | `/pages/notification` | **Template** DreamsLMS (nội dung tiếng Anh "Improve the way your work…", nút "Mark All as Read" là `Link to="#"`) | Chỉ ở dữ liệu header công khai của template (`header.tsx`), không có trong sidebar quản lý | — | Class template | Không có lời gọi API | — | Không | **Không chuyển** (không chuyển trang template thành chức năng thật khi chưa có bằng chứng) |
| `CampaignCreatePage` | (có import nhưng **không khai báo route**) | Mồ côi | Không | — | — | — | — | — | Không chuyển |
| `StudentNotification` / `StudentNotificationList` | `/student/…notifications`, `…notification-list` | Thật nhưng thuộc **khu học viên** | Menu học viên | Học viên | Dùng cùng `NotificationListContent` | — | — | — | Ngoài phạm vi frontend quản lý |

Kết luận: chỉ một màn thật nằm trong phạm vi Teacher; không chuyển template thành chức năng. Nhánh Admin có chức năng ghi (gửi chiến dịch) nên được ghi nhận nhưng để cho milestone riêng.

## 2. Màn đã chuyển

`/instructor/instructor-notifications` — giữ URL, DOM, class, icon, chữ tiếng Việt (lấy từ `locales/vi/student.ts`) của bản cũ. Tiêu đề **"Thông báo của tôi"**
(bản cũ đổi thành "Quản lý thông báo" + nút "Gửi Thông Báo Mới"/"Thông báo đã gửi" chỉ khi `isAdmin || isTeacherManager`, nên Giảng viên không bao giờ thấy các nút đó — không port).

### Cấu trúc

```
app/(management)/instructor/instructor-notifications/page.tsx        page mỏng
components/management/notifications/
  instructor-notifications-page-content.tsx   container: router + ManagementPageFrame
  notification-list-view.tsx                  view thuần (DOM/CSS như notification-list-content.tsx cũ), không gọi API
  use-notification-page.ts                    logic: tải theo bộ lọc, phân trang, đánh dấu đọc, điều hướng
lib/notifications/notification-target.ts      + pickNotificationTarget (đích nội bộ hợp lệ hoặc null)
lib/api/notification-client.ts                + fromDate/toDate cho fetchNotifications (CÙNG client với chuông — không có client thứ hai)
types/notification.ts                         + NotificationFilters
components/management/management-shell.tsx    + <Toaster richColors position="top-center" /> (như src/index.tsx của HSK cũ)
```

Không thêm Redux slice, không tạo lại `features|core|routes|store`. Trạng thái màn là state cục bộ trong hook. `sonner@2.0.7` (đúng bản cũ) được thêm cho toast.

## 3. Khác biệt có chủ đích so với bản cũ

| # | Bản cũ | Bản mới | Lý do |
|---|---|---|---|
| 1 | Lỗi tải danh sách: toast + trạng thái rỗng "Không tìm thấy thông báo nào" (nói sai là không có thông báo) | Toast như cũ **và** khối cảnh báo + nút "Thử lại"; chưa cấu hình dịch vụ: khối "WAITING FOR BACKEND", không toast, không danh sách giả | Không dùng dữ liệu/ trạng thái giả; phân biệt chờ backend / lỗi / rỗng thật |
| 2 | **Phân trang không hoạt động**: `handleFilterChange('page', n)` luôn đặt lại `page: 0` (hàm gộp `{[key]: value, page: 0}`), nên bấm Trước/số trang/Sau chỉ tải lại trang đầu. **Bằng chứng**: bản cũ ở Vite, 25 thông báo, bấm "3" → request `?page=0&size=10`, vẫn hiện thông báo 1–10 (`out/notif/page3-desktop`, log so sánh) | Phân trang hoạt động: bấm "3" → `?page=2&size=10`, hiện thông báo 21–25; đổi bộ lọc vẫn về trang đầu | Bộ phân trang không phân trang được là lỗi hiển nhiên. **Chủ dự án đã xác nhận giữ bản sửa (M3B.4)** — INTENTIONAL BUG FIX; regression test: `tests/instructor-notifications.test.tsx` nhóm "regression: phân trang…" |
| 3 | Phản hồi cũ có thể ghi đè kết quả mới khi đổi bộ lọc nhanh | Bỏ qua phản hồi đã bị thay thế | Tránh hiển thị sai |
| 4 | Sau "đọc tất cả" tải danh sách hai lần (gọi trực tiếp + nghe sự kiện `notifications-updated` do chính nó phát) | Một lần (qua sự kiện) | Giảm lời gọi thừa; kết quả hiển thị như nhau |
| 5 | Phát `exercise-graded` khi bấm thông báo `EXERCISE_GRADED` | Không phát | Chỉ phục vụ màn học viên/chấm bài (chưa chuyển), không có người nghe ở khu quản lý |
| 6 | `navigate(targetUrl)` nhận cả URL tuyệt đối | Chỉ đường dẫn nội bộ bắt đầu bằng `/` (không nhận `//host`, `http…`) | An toàn điều hướng (cùng quy tắc với chuông ở M3A) |
| 7 | `dayjs.locale('vi')` đặt toàn cục như hiệu ứng phụ khi nạp module chuông | Đặt tường minh trong `lib/notifications/relative-time.ts` | Cùng kết quả, không phụ thuộc thứ tự nạp |
| 8 | Bấm thông báo mà lệnh "đã đọc" lỗi: không làm gì (chỉ `console.error`) | Giữ nguyên | Giữ hành vi cũ; ghi nhận là điểm UX yếu của bản cũ |

## 4. Vai trò và guard

- `/instructor/instructor-notifications`: **ROLE_TEACHER và ROLE_MENTOR** (`UI_ROLE_DECISIONS`, quyết định giao diện của chủ dự án; HSK cũ không có PrivateRoute). Admin, Teacher-manager, Collaborator, Manager, User và người không có role → trang "không có quyền", không thấy sidebar/nội dung (test `notifications-page.spec.ts`).
- **Đây không phải xác nhận quyền từ backend.** Cần Auth/backend xác nhận: Teacher/Mentor gọi được `GET /notification`, `POST /{id}/read`, `POST /read/all` và chỉ thấy thông báo của chính mình.
- Chưa đăng nhập → chuyển sang Auth đúng một lần, **không có lời gọi API thông báo nào** (test).
- `/instructor/instructor-settings`: **UNKNOWN, chưa chuyển, không cấp quyền** chỉ vì nút "Cài đặt hồ sơ" ở màn Tổng quan điều hướng tới đó (vẫn 404).
- `/instructor/instructor-support-tickets`: **UNKNOWN**, không đổi.

### Đề xuất tách route/component/guard cho milestone vé hỗ trợ (chưa làm)

Khảo sát ở `docs/M3B2-WELCOME.md` mục 3: một component phục vụ hai chế độ. Đề xuất khi chuyển:
1. Hai màn riêng, cùng thư mục `components/management/support-tickets/`: **"Yêu cầu của tôi"** (tạo/xem/huỷ/bình luận yêu cầu của chính mình; endpoint owner-scoped `/support-tickets`) và **"Quản trị yêu cầu"** (xem mọi yêu cầu, trả lời; `/management/support-tickets`, chỉ ADMIN/TEACHER_MANAGER).
2. Route hiện tại `/instructor/instructor-support-tickets` chỉ phục vụ "Yêu cầu của tôi" cho role chủ dự án quyết định (rất có thể TEACHER, MENTOR); phần quản trị đặt ở route Admin riêng và guard `allowedRoles` thật sự; không chọn chế độ theo role bên trong cùng một route.
3. Mỗi chế độ có hook + client riêng, upload đính kèm tách thành thành phần dùng chung, thêm vào `UI_ROLE_DECISIONS` chỉ sau khi có quyết định.

## 5. 49 route UNKNOWN được đếm thế nào

Mỗi route thuộc đúng **một** nhóm (`groupUnknownRoutes()` trong `route-registry.ts`, kiểm tra bằng test; tổng nhóm = số route UNKNOWN; không đổi trạng thái để cho số khớp):

| Nhóm | Số route |
|---|---|
| HSK cũ không bọc PrivateRoute và chưa có quyết định của chủ dự án | 17 |
| PrivateRoute chỉ cho role chưa xác minh (Teacher-manager, Collaborator) | 32 |
| PrivateRoute chỉ yêu cầu đăng nhập, không xác lập role | 0 |
| **Tổng** | **49** |

Toàn bộ registry sau M3B.3: 148 route khu quản lý = **3 MIGRATED** (`/admin/class-management`, `/instructor/welcome`, `/instructor/instructor-notifications`) + **72 NOT_MIGRATED** + **49 UNKNOWN** + **24 OUT_OF_SCOPE**. Chỉ route thông báo của Teacher chuyển từ NOT_MIGRATED sang MIGRATED; không route nào khác đổi. 278 khai báo = 277 đường dẫn duy nhất + 1 khai báo trùng (`/instructor/instructor-profile`). `docs/ROUTE-STATUS.md` sinh tự động và có thêm bảng nhóm này.

## 6. Hợp đồng API còn thiếu (frontend đã có client; backend cần xác nhận)

Xem `docs/api-requirements/notifications.md` mục 3. Tóm tắt: đường dẫn gốc thật; `GET ?readStatus=ALL|READ|UNREAD&fromDate&toDate&page&size` (ISO-8601, đầu/cuối ngày theo múi giờ trình duyệt); quyền của Teacher/Mentor; `payload.targetUrl` thuộc app mới hay cũ; thứ tự sắp xếp (mới nhất trước); tính `unreadCount` (toàn bộ hay theo bộ lọc — bản cũ hiển thị số trả về cho mọi bộ lọc). Nhánh Admin còn thiếu hợp đồng: `POST /admin/campaigns/send-now`, `GET /admin/campaigns`, tìm người nhận.

## 7. Webpack (nhắc lại, không đổi ở milestone này)

Build/dev vẫn dùng `--webpack` vì Turbopack (lightningcss) làm rơi rule `.shadow-sm !important` của SCSS cũ (chi tiết `docs/M3B2-WELCOME.md` mục 8). **Không phải quyết định vĩnh viễn**: khác mặc định của IELTS; xem xét quay lại Turbopack khi có cách đảm bảo CSS không bị làm rơi. Phép thử `e2e/specs/css-fidelity.spec.ts` được giữ để chặn tái phát; không sửa hàng loạt SCSS cho Turbopack.

## 8. Phát hiện: phụ thuộc bắc cầu của antd lệch bản cũ → popup lịch lệch 1px (đã sửa)

So sánh ô chọn khoảng ngày với HSK cũ cho thấy popup lịch lệch **1px** theo chiều ngang (cùng hình học `RangePicker`; chỉ `left` của dropdown 794 ↔ 793). Nguyên nhân: cùng `antd@5.23.0` nhưng các gói con được `npm install` giải khác lockfile cũ (`@rc-component/trigger` 2.2.6 ↔ 2.3.1, `rc-picker` 4.9.0 ↔ 4.9.2, `@ant-design/cssinjs` 1.22.1 ↔ 2.1.2/1.24.0, và ~20 gói `rc-*` khác).
**Xử lý:** thêm `overrides` trong `package.json` ghim các gói đó về đúng phiên bản của `package-lock.json` của HSK cũ (22 gói; `npm ls @ant-design/cssinjs` chỉ còn 1.22.1). Sau khi ghim: popup trùng pixel với bản cũ. Đã chạy lại toàn bộ kiểm thử (mục 9). Phân loại: **lỗi migration** (lệch phiên bản phụ thuộc, cùng loại với lệch bootstrap/tabler ở M3A). Còn lệch ở các gói không liên quan UI (`@babel/runtime`, `stylis`, `compute-scroll-into-view` 3.1.0→3.1.1) — chưa thấy tác động hiển thị.

## 9. Kết quả kiểm thử

Bản sao sạch (sao chép cây làm việc sang thư mục mới, `npm ci`, không dùng node_modules/.next của cây chính), cổng rảnh:

| Bước | Kết quả |
|---|---|
| `npm ci` | OK |
| `npm run typecheck` (tsc) | 0 lỗi |
| `npm run lint` (ESLint) | 0 lỗi/cảnh báo |
| `npm test` (Vitest) | **473/473** (M3B.2: 450; +21 màn thông báo, +1 pickNotificationTarget, +1 nhóm UNKNOWN). Lần chạy đầu ở bản sao sạch có 1 ca `production-guard` hết 5 giây mặc định (ca chạy `next build` thật khi máy lạnh): đã nâng timeout của nhóm đó lên 120 giây, chạy lại 473/473 ở cả cây chính và bản sao sạch |
| `npm run e2e:build` (build production + quét địa chỉ mock) | OK, không có địa chỉ mock trong artifact |
| `npm run test:e2e` (Playwright, MOCK) | **232/232**, 14,7 phút (gồm: 24 test màn thông báo, 1 test chưa cấu hình, 6 ảnh visual mới, `css-fidelity`, `navigation` với marker mới) |
| `npm run test:e2e:dev` (`next dev --webpack` + proxy) | 1/1 |
| Build production | OK (`/instructor/instructor-notifications` tĩnh, webpack) |

Lưu ý trung thực: một lần chạy đầy đủ trên cây chính có 1 ca (`class-management.spec.ts:101`) hết 90 giây; chạy lại riêng spec đó 11/11 và bản sao sạch 232/232. Lần chạy đó kéo dài 2,6 giờ đồng hồ (nghi máy bị treo/ngủ giữa chừng); không có bằng chứng nguyên nhân khác nên **ghi nhận là flake môi trường, chưa chứng minh**.

### So sánh với HSK cũ (Vite :3101 ↔ Next :3100, Edge headless, mạng chặn, cùng dữ liệu giả, 25 thông báo)

17 ca (ảnh `.col-lg-9`; ca `mixed` còn so cả `.content` có sidebar; ca toast so riêng phần tử toast):

- **15/17: 0 pixel khác, maxDelta 0** — danh sách có dữ liệu (desktop/tablet/mobile, có sidebar), rỗng (3 khung), 4 thông báo, lọc Chưa đọc, lọc Đã đọc, popup lịch mở (desktop + mobile), đã chọn khoảng ngày, rê chuột lên dòng, toast "Đã đánh dấu tất cả là đã đọc", trạng thái đang tải. Cũng trùng: tiêu đề, badge, số dòng, class từng dòng, chữ, nhãn ô ngày, toast, không cuộn ngang, 0 lỗi trang.
- **2/17 khác (page3 desktop/mobile)**: do lỗi phân trang của bản cũ (mục 3, dòng 2) — khác biệt có chủ đích, chờ xác nhận.
- Trạng thái lỗi/chờ backend là khác biệt có chủ đích (mục 3, dòng 1) nên không đặt vào phép so ảnh.
- Trước khi ghim phụ thuộc (mục 8) ca "đã chọn khoảng ngày" lệch 10.924 pixel (popup lệch 1px); sau khi ghim: 0.
- Không dùng so sánh này để nói "pixel-perfect" cho dữ liệu thật; chỉ áp dụng cho các ca trên.

Regression ngoài màn mới (nằm trong 232 test): sidebar Admin/Giảng viên × 6 tình huống × 3 khung, màn lớp học, màn Tổng quan, placeholder, `css-fidelity` (93 thành phần × 56 thuộc tính + 13 hover) đều đạt với ảnh chuẩn/giá trị chuẩn cũ — **sau khi ghim phụ thuộc antd, không ảnh chuẩn nào phải cập nhật**.

## 10. Giới hạn chưa xác minh

- Mọi dữ liệu là **MOCK**; không gọi API/Auth thật; **M2 REAL AUTH VERIFICATION vẫn PENDING**.
- Quyền Teacher/Mentor và hợp đồng `GET /notification` chưa được backend xác nhận.
- Ảnh chuẩn visual chỉ có trên Windows + Chromium + Internet (Google Fonts).
- So sánh với HSK cũ dùng dữ liệu giả giống nhau, không phải dữ liệu thật; trạng thái lỗi/chờ backend là khác biệt có chủ đích nên không so được.
- Chưa thử trên trình duyệt/thiết bị thật ngoài Chromium (Playwright) và Edge headless (so sánh cũ/mới).
