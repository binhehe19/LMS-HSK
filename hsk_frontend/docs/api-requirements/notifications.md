# Yêu cầu API — Thông báo và Ticket (chuông + toast ở sidebar quản lý)

## 0. Cập nhật 2026-10-27 — đối chiếu với backend chung LMS_IELTS (M5)

Phần thông báo cá nhân (chuông, danh sách, đánh dấu đã đọc) **đã chuyển sang hợp đồng THẬT của `repo-notification`** (Go/Echo, `/api/notification/*` sau Traefik; đọc source
`LMS_IELTS/backend/repo-notification/internal/notification/handler.go`). Trạng thái: **AVAILABLE** (client đã viết theo contract; chưa xác minh trên môi trường dev/staging).

| Frontend gọi | Backend chung | Ghi chú |
|---|---|---|
| `GET {NOTIFICATION}/notifications?page&size` | có (size ≤ 100) | JSON trần `{items, totalElements, totalPages, page, size, unreadCount}`; item `{id, action, title, message, resourceId, payload, read, seen, createdAt, readAt, seenAt, dedupeKey}` |
| `GET {NOTIFICATION}/notifications/unread-count` | có | `{unreadCount}` |
| `POST {NOTIFICATION}/notifications/{id}/read` | có | 204 |
| `POST {NOTIFICATION}/notifications/seen/all` | có | 204 (frontend chưa dùng) |
| Lọc `readStatus`/`fromDate`/`toDate` | **không có** | frontend lấy mọi trang (≤ 10 × 100) rồi lọc ở client (`lib/notifications/notification-filter.ts`); backend bổ sung lọc server sẽ giảm tải — **đề nghị** |
| "Đánh dấu tất cả đã đọc" | **không có** `read/all` | frontend đọc từng thông báo chưa đọc; **đề nghị** backend thêm `POST /notifications/read/all` |
| Điều hướng khi bấm thông báo | payload chấm bài `{attemptId, sessionId, sessionNo, contentPackageVersionId}` | frontend chỉ điều hướng khi có `payload.targetUrl`/`deepLink` nội bộ; **đề nghị** backend thêm `targetUrl` hoặc frontend ánh xạ theo `action` khi có màn tương ứng |
| Chiến dịch Admin (`/notification/admin/campaigns`, `send-now`) | **không có REST** (thông báo chỉ tạo qua Kafka `notification.in-app`) | giữ là hợp đồng ĐỀ XUẤT, đi qua `NEXT_PUBLIC_HSK_API_BASE_PATH` (hsk-client); gửi vẫn bị khoá bởi `NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND` |
| Ticket (`/api/tickets`) | **không có** | hợp đồng đề xuất, xem `work-tickets.md` |

Lưu ý triển khai: backend chung yêu cầu JWT có `email_verified=true`; cookie `access_token` chỉ dùng được khi frontend cùng `DOMAIN`/`ROOT_DOMAIN` (CORS ở Traefik).

---

Phần dưới đây là hợp đồng GIẢ ĐỊNH gốc (M3A, rút từ code HSK cũ `notificationService.ts`, `ticket.service.ts`), giữ để đối chiếu; chỗ nào khác mục 0 thì mục 0 thắng.

## Cấu hình phía frontend

| Biến | Ý nghĩa |
|---|---|
| `NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH` | Gốc dịch vụ thông báo, **đã gồm tiền tố** (HSK cũ: `<LMS_API>/api/notification`). Trống = chưa tích hợp |
| `NEXT_PUBLIC_TICKET_API_BASE_PATH` | Gốc danh sách ticket (HSK cũ: `/id/tickets`). Trống = không hiện toast |
| `NOTIFICATION_API_PROXY_TARGET`, `TICKET_API_PROXY_TARGET` | Chỉ cho `next dev` (proxy cùng origin) |

Mọi lời gọi dùng cookie phiên (`credentials: include`) + Bearer nếu có, 401 → refresh một lần (như các API khác, xem `AUTH-INTEGRATION.md`).
Phản hồi nhận cả dạng bọc `{ success, data }` lẫn dữ liệu trần.

## 1. Thông báo — endpoint frontend cần

| # | Method + đường dẫn (tương đối gốc) | Dùng cho | Phản hồi mong đợi |
|---|---|---|---|
| 1 | `GET /unread-count` | Huy hiệu ở chuông và mục "Quản lý thông báo"/"Thông báo của tôi"; hỏi lại mỗi 30 giây và khi có sự kiện `notifications-updated` | số nguyên ≥ 0 |
| 2 | `GET ?page=0&size=10` (không có `/` trước `?`) | Dropdown của chuông (10 thông báo mới nhất) | `NotificationPageResponse` bên dưới |
| 3 | `POST /{id}/read` | Bấm vào một thông báo chưa đọc | thông báo đã cập nhật (nội dung không dùng) |
| 4 | `POST /read/all` | "Đọc tất cả" | rỗng |

```ts
NotificationPageResponse { items: NotificationResponse[]; totalElements; totalPages; page; size; unreadCount }
NotificationResponse { id; topic; title; message; resourceType; resourceId; payload; read: boolean; seen: boolean;
                       createdAt: ISO-8601; readAt; seenAt }
payload.targetUrl | payload.deepLink  // đường dẫn NỘI BỘ của ứng dụng để điều hướng khi bấm
```

Điểm cần backend xác nhận:

1. Quyền: mọi vai trò quản lý (Admin, Teacher, Mentor) gọi được 1–4 và chỉ thấy thông báo của chính mình?
2. `payload.targetUrl` sẽ là đường dẫn của **app mới** hay của app cũ? Frontend chỉ chấp nhận đường dẫn bắt đầu bằng `/` (không nhận URL tuyệt đối).
3. Có cần realtime (SSE/WebSocket) không? Frontend hiện chỉ hỏi định kỳ 30 giây như bản cũ — không có realtime giả.
4. Bản cũ còn phát sự kiện `exercise-graded` khi gặp thông báo `EXERCISE_GRADED` để cập nhật điểm ở màn học viên/chấm bài. **Chưa port** (màn đó chưa chuyển); nếu cần ở M3B+ thì cần hợp đồng riêng.
5. Trang "Thông báo của tôi" (`/instructor/instructor-notifications`, M3B.3) dùng endpoint 2 với thêm bộ lọc và phân trang — xem mục 3. Trang Admin `/admin/settings/notifications` đã chuyển ở M3B.4 — xem mục 5.

Ngoài phạm vi M3A (bản cũ có, chưa dùng ở sidebar): `POST /{id}/seen`, `POST /seen/all`. `POST /admin/campaigns/send-now` và `GET /admin/campaigns` đã có UI ở M3B.4 — xem mục 5.

## 2. Ticket — endpoint frontend cần (toast chào mừng)

| # | Method + đường dẫn | Dùng cho | Phản hồi mong đợi |
|---|---|---|---|
| 1 | `GET ?page=0&size=100` | Đếm ticket `OPEN` và `DONE` khi vừa đăng nhập vào khu quản lý (một lần mỗi phiên tab, khóa `tm_notified_<id>` / `instructor_notified_<id>`) | mảng `TicketResponse` (chấp nhận mảng trần, `content`, `items`, `data`) |

```ts
TicketResponse { id; status: "OPEN" | "DONE" | "CLOSE"; assignedId: string }  // phần frontend dùng; thêm trường khác không ảnh hưởng
```

- Admin: đếm **mọi** ticket (toast "Đang mở / Đang chờ duyệt"). Giảng viên: chỉ ticket có `assignedId` = id người dùng hiện tại ("Đang thực hiện / Đã báo cáo").
- Cần backend xác nhận: Admin có thấy toàn bộ ticket ở endpoint này không; `assignedId` có cùng không gian id với `GET /users/me` `id` không (frontend so sánh dạng chuỗi).
- Giới hạn 100 ticket đầu là hành vi cũ; số đếm sẽ thấp hơn thực tế nếu có > 100 ticket. Nếu cần chính xác, backend nên cung cấp endpoint đếm.

## 3. Trang danh sách "Thông báo của tôi" (M3B.3) — endpoint 2 mở rộng

`GET ?readStatus=READ|UNREAD&fromDate=<ISO>&toDate=<ISO>&page=<từ 0>&size=10` (cùng gốc `NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH`, cùng client với chuông; `readStatus=ALL` thì **không gửi** tham số; `fromDate`/`toDate` chỉ gửi khi chọn đủ cả hai).
Phản hồi: `NotificationPageResponse` ở mục 1. Frontend dùng `items`, `totalElements` (hiện phân trang khi `totalElements > size`), `unreadCount` (huy hiệu "N chưa đọc" và khoá nút "Đánh dấu tất cả"); `totalPages` không dùng (tự tính).
`POST /{id}/read` và `POST /read/all` như mục 1; sau khi thành công frontend phát `notifications-updated` để chuông và danh sách tải lại.

Điểm cần backend xác nhận thêm:

1. `fromDate`/`toDate` là ISO-8601 UTC (`2026-10-19T17:00:00.000Z` = 00:00 ngày 20/10 giờ Việt Nam; `toDate` là 23:59:59.999) — có lọc theo `createdAt`, bao gồm cả hai đầu?
2. Sắp xếp: mới nhất trước? `page` bắt đầu từ 0 như bản cũ?
3. `unreadCount` là tổng chưa đọc của người dùng (không phụ thuộc bộ lọc) như bản cũ?
4. Teacher và Mentor có quyền gọi các endpoint trên (quyết định phạm vi giao diện chưa phải xác nhận quyền)?
5. Nhánh Admin (chưa chuyển): `POST /admin/campaigns/send-now` `{title, message, userIds[]}`, `GET /admin/campaigns?page&size`, và API tìm người nhận (`adminUserService.getUsers` của bản cũ).

Hành vi lỗi riêng của trang này: chưa cấu hình → khối "WAITING FOR BACKEND" (không gọi mạng, không toast); lỗi → toast "Không thể tải danh sách thông báo" + khối lỗi có "Thử lại"; "đọc tất cả" lỗi → toast "Thao tác thất bại".

## 4. Hành vi lỗi ở frontend (chuông) (đã kiểm thử với mock)

| Tình huống | Frontend |
|---|---|
| Chưa cấu hình | Chuông hiện, dropdown: "Thông báo chưa được tích hợp (đang chờ backend)"; không gọi mạng, không số, không toast |
| API lỗi/401 không phục hồi | Không huy hiệu mới; giữ số thật gần nhất nếu đã có; dropdown báo "Không tải được thông báo" |
| Rỗng | "Không có thông báo nào" |
| Đánh dấu đã đọc lỗi | Không chặn điều hướng (như bản cũ) |

## 5. Admin: chiến dịch thông báo và chọn người nhận (M3B.4, `/admin/settings/notifications`)

Trạng thái: **UI COMPLETE · API WAITING FOR BACKEND**. Mọi hợp đồng dưới đây là **GIẢ ĐỊNH rút từ code HSK cũ** (`notificationService.ts`, `admin-user.service.ts`) — chưa backend nào xác nhận.
Frontend chỉ kiểm thử với **mock cách ly** (`scripts/mock-server.mjs`); không có request ghi tới hệ thống thật.

### 5.1 Cấu hình phía frontend (3 lớp, mặc định ĐÓNG đối với thao tác ghi)

| Biến | Ý nghĩa | Trống thì |
|---|---|---|
| `NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH` | Gốc dịch vụ thông báo (đã có từ M3A). Dùng cho lịch sử chiến dịch (đọc) | Lịch sử hiện "WAITING FOR BACKEND" |
| `NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH` | Gốc danh sách người dùng quản trị (HSK cũ: `/id/admin/users`, **dịch vụ định danh**, không phải dịch vụ thông báo). **Chỉ đọc** | Bộ chọn người nhận hiện "WAITING FOR BACKEND" |
| `NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND` | **Công tắc an toàn** cho thao tác GỬI. Chỉ giá trị `enabled` (kèm có `NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH`) mới mở gửi | Nút "Xem trước & Gửi" bị khoá + khối "WAITING FOR BACKEND"; `sendCampaign` còn tự chặn ở lớp client: **không có request nào được tạo** |

Công tắc gửi tồn tại vì thao tác gửi **ghi dữ liệu, không thể hoàn tác, tới nhiều người** còn hợp đồng chưa xác nhận: dù đã có địa chỉ dịch vụ (đọc được), việc gửi chỉ mở khi người triển khai chủ động đặt `enabled` **sau khi backend xác nhận mục 5.2**.
`ADMIN_USER_API_PROXY_TARGET` (chỉ `next dev`) tương tự các proxy khác; cả hai biến NEXT_PUBLIC mới nằm trong guard production (từ chối URL mock/localhost).

### 5.2 Endpoint frontend cần

| # | Method + đường dẫn | Dùng cho | Quyền mong đợi |
|---|---|---|---|
| 1 | `GET /notification/admin/campaigns?page=0&size=10` (gốc = thông báo) | Lịch sử chiến dịch (modal "Thông báo đã gửi"), phân trang | `ROLE_ADMIN` |
| 2 | `POST /notification/admin/campaigns/send-now` body `{ title, message, userIds: string[] }` | Gửi chiến dịch ngay (nút "Xác nhận & Gửi") | `ROLE_ADMIN` |
| 3 | `GET <ADMIN_USER_BASE>?page=0&size=10[&search=…][&role=ROLE_…]` | Bộ chọn người nhận: tìm theo tên/email, lọc vai trò, phân trang; "Chọn tất cả …" gọi `size=1` rồi `size=<tổng>` | `ROLE_ADMIN` |

```ts
CampaignPageResponse { items: CampaignResponse[]; totalElements; totalPages; page; size }
CampaignResponse { id; title; message; audienceType: string; status: string; createdAt: ISO-8601 }   // status: frontend chỉ tô màu SUCCESS / PROCESSING, giá trị khác = màu cảnh báo
SendCampaignRequest { title: string; message: string; userIds: string[] }   // title/message đã cắt khoảng trắng hai đầu
AdminUserListResponse { items: AdminUser[]; totalElements; totalPages; page; size }
AdminUser { id; email; fullName?; avatarUrl?; roles: string[] /* "ROLE_USER"… */; status? }
```

### 5.3 Điểm cần backend xác nhận / bàn giao

1. **Đường dẫn thật** của 3 endpoint và gốc dịch vụ người dùng; Admin dùng cookie phiên + Bearer như các API khác (401 → refresh một lần).
2. **Quyền**: chỉ `ROLE_ADMIN`? (Teacher-manager có được gọi `send-now` không — bản cũ có nhánh `isTeacherManager` nhưng frontend mới KHÔNG cấp quyền cho Teacher-manager/Collaborator khi chưa xác minh.)
3. **Chống gửi trùng**: frontend chỉ chống ở giao diện (khoá đồng bộ + nút vô hiệu khi đang gửi). Backend có hỗ trợ khoá idempotency (header/trường) để chống gửi trùng khi mạng chập chờn/ thử lại không? Nếu có, nêu tên để frontend gửi kèm (hiện KHÔNG gửi thêm trường nào ngoài hợp đồng cũ).
4. **Validation + mã lỗi**: giới hạn độ dài `title`/`message`, số `userIds` tối đa, định dạng lỗi (frontend hiện chỉ hiện "Gửi thất bại, vui lòng thử lại." cho mọi lỗi; nếu có mã lỗi cần hiển thị riêng thì cần danh sách mã).
5. **`send-now` đồng bộ hay bất đồng bộ?** Phản hồi là `CampaignResponse` (như bản cũ) hay chỉ xác nhận đã nhận? Giá trị `status`/`audienceType` có thể có (frontend in nguyên chuỗi).
6. **Kích thước trang tối đa** của API người dùng: "Chọn tất cả …" gọi `size=<tổng số>` (hành vi bản cũ). Nếu backend giới hạn trang (vd. 100), frontend báo lỗi "chỉ lấy được X/Y" thay vì báo "đã chọn tất cả" sai. Có endpoint chọn-theo-bộ-lọc phía máy chủ (gửi theo bộ lọc thay vì danh sách id) không? (Nằm ngoài hợp đồng cũ — chỉ là câu hỏi, không tự bổ sung.)
7. Tìm kiếm `search` khớp trường nào (tên, email)? Có phân biệt hoa/thường? Phản hồi lỗi/rỗng có dạng nào?

### 5.4 Hành vi giao diện khi API chưa sẵn sàng (đã kiểm thử với mock)

| Tình huống | Frontend |
|---|---|
| Dịch vụ thông báo chưa cấu hình | Danh sách và lịch sử hiện "WAITING FOR BACKEND"; không toast lỗi; **không gọi mạng** |
| Dịch vụ người dùng chưa cấu hình | Bộ chọn người nhận hiện "WAITING FOR BACKEND" trong bảng; không dữ liệu giả |
| Công tắc gửi đóng (kể cả khi dịch vụ đã có địa chỉ) | Form xem được và nhập được; "Xem trước & Gửi" khoá; không đường nào tới request gửi; **không bao giờ** hiện "Đã gửi thành công" giả |
| Gửi lỗi (mạng/5xx/4xx) | Toast "Gửi thất bại, vui lòng thử lại."; giữ nguyên nội dung + người nhận; mở lại được hộp xác nhận |
| Bấm xác nhận nhiều lần khi đang gửi | Chỉ một request (khoá đồng bộ + nút khoá) |
| Lịch sử/người dùng lỗi | Toast (như bản cũ) + khối lỗi có "Thử lại" |
| Trang hiện tại không còn hợp lệ (dữ liệu giảm) | Tự nhảy về trang cuối còn dữ liệu |
