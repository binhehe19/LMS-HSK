# Yêu cầu API — Ticket "Phân công công việc" (`/admin/tickets`, `/instructor/instructor-tickets`)

Trạng thái: **UI COMPLETE · API WAITING FOR BACKEND**. Frontend (M5 W1-C) đã hoàn thiện hai màn và lớp gọi API; backend chung `LMS_IELTS/backend` **chưa có** dịch vụ ticket. Hợp đồng dưới đây là **GIẢ ĐỊNH rút từ code HSK cũ** (`core/services/ticket.service.ts`, `core/types/ticket.type.ts`, gốc `/id/tickets` ở dịch vụ định danh) — chưa backend nào xác nhận. Frontend không dùng dữ liệu giả thay thế: khi API chưa có/lỗi, giao diện hiện trạng thái "WAITING FOR BACKEND"/lỗi; **thao tác ghi mặc định bị khoá** bằng công tắc `NEXT_PUBLIC_WRITE_WORK_TICKETS` (chỉ `enabled` sau khi backend xác nhận mục 3).

Bổ sung cho mục 2 của `docs/api-requirements/notifications.md` (toast chào mừng dùng cùng endpoint danh sách).

## 1. Cấu hình phía frontend

| Biến | Ý nghĩa | Trống thì |
|---|---|---|
| `NEXT_PUBLIC_TICKET_API_BASE_PATH` | GỐC của tài nguyên ticket (HSK cũ: `<LMS_API>/api/id/tickets`). Đã có từ M3A | Hai màn hiện "WAITING FOR BACKEND", toast không hiện, không gọi mạng |
| `NEXT_PUBLIC_WRITE_WORK_TICKETS` | Công tắc an toàn cho thao tác GHI (tạo/sửa/xoá/đóng/báo cáo hoàn thành). Chỉ giá trị `enabled` mới mở | Nút ghi khoá + khối "WAITING FOR BACKEND"; hàm client tự chặn (`WriteDisabledError`), **không có request ghi nào được tạo** |
| `TICKET_API_PROXY_TARGET` | Chỉ cho `next dev` (proxy cùng origin) | — |

Mọi lời gọi: cookie phiên (`credentials: include`) + `Authorization: Bearer` nếu tab giữ token; 401 → refresh một lần. Phản hồi nhận cả dạng bọc `{ success, data }` lẫn dữ liệu trần. Client: `src/lib/api/ticket-client.ts`; DTO: `src/types/ticket.ts`.

## 2. Endpoint frontend cần (đường dẫn tương đối GỐC)

| # | Method + đường dẫn | Dùng cho | Quyền mong đợi | Phản hồi |
|---|---|---|---|---|
| 1 | `GET ?page=0&size=100` (Admin) / `GET ?page=0&size=50` (giảng viên) | Danh sách ticket của hai màn (+ toast chào mừng, màn Tổng quan) | Mọi vai trò quản lý đã đăng nhập. **Admin thấy mọi ticket; Teacher/Mentor chỉ thấy ticket được giao cho mình** (backend lọc theo principal) | mảng `TicketResponse` hoặc trang Spring (`content`/`items`, `totalElements`…) |
| 2 | `GET /assignees[?q=<từ khoá>]` | Cột "Người được cấp quyền" trong modal tạo/sửa (frontend tải một lần khi mở modal lần đầu, lọc tên/email/vai trò phía client như bản cũ; `q` có trong client nhưng chưa dùng) | `ROLE_ADMIN` | mảng `TicketAssigneeOptionResponse` |
| 3 | `POST` (gốc, **không** có `/` cuối) body `TicketCreateRequest` | "Xác nhận & Cấp quyền": frontend gọi **một lần cho MỖI tổ hợp người × module** (hành vi bản cũ) | `ROLE_ADMIN` | `TicketResponse` vừa tạo (`status = OPEN`), 200/201 |
| 4 | `PUT /{id}` body `TicketUpdateRequest` (frontend gửi đủ 3 trường) | "Lưu thay đổi" — chỉ có nút khi ticket `OPEN` | `ROLE_ADMIN` | `TicketResponse` đã cập nhật; 404 không có; 409 nếu không còn `OPEN` |
| 5 | `DELETE /{id}` | "Xóa Ticket" — chỉ có nút khi ticket `CLOSE` | `ROLE_ADMIN` | 200/204; 404; 409 nếu chưa `CLOSE` |
| 6 | `POST /{id}/close` | "Đóng" (thu hồi quyền sửa nội dung của module đó) — có nút khi ticket khác `CLOSE` | `ROLE_ADMIN` | `TicketResponse` (`status = CLOSE`); 404; 409 nếu đã `CLOSE` |
| 7 | `POST /{id}/done` | "Báo cáo hoàn thành" của giảng viên — chỉ có nút khi ticket `OPEN` | `ROLE_TEACHER`, `ROLE_MENTOR` (+ `ROLE_COLLABORATOR` theo PrivateRoute cũ, app mới chưa cấp quyền) và **chỉ ticket có `assignedId` = chính người gọi** (403 nếu không) | `TicketResponse` (`status = DONE`); 404; 409 nếu không `OPEN` |

```ts
TicketStatus = "OPEN" | "DONE" | "CLOSE"          // OPEN: Đang mở/Đang thực hiện · DONE: Chờ duyệt/Đã báo cáo · CLOSE: Đã đóng
TicketModule = "FLASHCARD" | "QUIZ" | "AI" | "LISTENING_PRACTICE" | "STORAGE" | "DICTIONARY" | "KANJI_ORIGIN" | "LEARNING_PATH"
             | "VIDEO_COURSE" | "WRITING" | "PRONUNCIATION" | "ONLINE_COURSE" | "GRAMMAR" | "OTHER"   // enum HSK cũ; UI chỉ cho chọn 12 (không ONLINE_COURSE, GRAMMAR)

TicketResponse {
  id: string; status: TicketStatus; assignedId: string;      // 3 trường toast/Tổng quan đã dùng từ M3A
  description: string; module: TicketModule;
  assignedName?: string; assignedEmail?: string;              // bảng Admin hiển thị; HSK cũ khai báo `assignedName` nhưng bảng đọc `assignedFullName`
  createdBy?: string; createdAt?: ISO-8601; updatedAt?: ISO-8601   // createdAt: cột "Ngày tạo" + bộ lọc khoảng ngày (phía client)
}
TicketAssigneeOptionResponse { id: string; email: string; fullName: string; roles: string[] /* "ROLE_TEACHER", "ROLE_COLLABORATOR", "ROLE_MENTOR"… */ }
TicketCreateRequest { description: string; module: TicketModule; assignedId: string }
TicketUpdateRequest { description?: string; module?: TicketModule; assignedId?: string }
```

## 3. Điểm cần backend xác nhận / bàn giao

1. **Đường dẫn thật** của gốc ticket và vị trí dịch vụ (định danh hay LMS). Phân trang: `page` từ 0? Frontend chỉ lấy **trang đầu** (100 cho Admin, 50 cho giảng viên — hành vi cũ); nếu > 100 ticket cần thống nhất phân trang/lọc phía server (bộ lọc tìm kiếm/module/trạng thái/ngày hiện chạy phía client trên trang đã tải).
2. **Phạm vi danh sách theo vai trò** (mục 2 #1): Admin có thấy toàn bộ không; giảng viên có bị lọc theo principal không. Frontend màn giảng viên **vẫn lọc lại** `assignedId == id người dùng` (cùng cách với màn Tổng quan) — `assignedId` phải cùng không gian id với `GET /users/me` của Auth chung.
3. **Tên trường người được giao**: `assignedName` hay `assignedFullName` (frontend nhận cả hai, xem `lib/work-tickets/ticket-model.ts`); có `assignedEmail` không.
4. **Quy tắc trạng thái** mà UI dựa vào: sửa chỉ khi `OPEN`; xoá chỉ khi `CLOSE`; đóng khi khác `CLOSE`; báo cáo hoàn thành chỉ khi `OPEN` và là ticket của mình. Backend nên trả **409** khi vi phạm (frontend hiện thông điệp máy chủ trong toast).
5. **Tạo nhiều**: frontend tạo tuần tự N request cho N tổ hợp người × module và báo "Đã phân công thành công X ticket" / "Có Y yêu cầu thất bại" (như bản cũ). Nếu backend có endpoint tạo hàng loạt/idempotency, nêu để frontend đổi (ngoài hợp đồng cũ, chỉ là câu hỏi).
6. **Trùng lặp**: một người có thể có 2 ticket `OPEN` cùng module không? Bản cũ không chặn; nếu backend trả 409 thì thông điệp cần rõ để hiện toast.
7. Validation + mã lỗi: độ dài `description`, `module` ngoài enum, `assignedId` không tồn tại (400/404), định dạng lỗi `{ success:false, errorCode, errorMessage }` như các dịch vụ khác?
8. Liên quan (ngoài phạm vi màn này): các màn nội dung của giảng viên bật/tắt quyền sửa theo ticket `OPEN`/`DONE` của module tương ứng (sidebar HSK cũ `TITLE_TO_MODULE_MAP`); cần cùng nguồn dữ liệu #1.

## 4. Hành vi giao diện (đã kiểm thử với mock cách ly, `tests/admin-tickets.test.tsx`, `tests/instructor-tickets.test.tsx`)

| Tình huống | Frontend |
|---|---|
| Chưa cấu hình gốc ticket | Dòng "WAITING FOR BACKEND" trong card, 4 thẻ thống kê "—", không bảng, không toast, không gọi mạng; nút Tạo khoá |
| Danh sách lỗi (4xx/5xx/mạng) | Toast "Không thể tải danh sách ticket" (như bản cũ) + dòng lỗi có "Thử lại"; thẻ "—" |
| Rỗng thật / không khớp bộ lọc | "Chưa có ticket nào" / "Không có ticket phù hợp bộ lọc" (giảng viên: "Bạn chưa được phân công công việc nào" / "Không có công việc phù hợp bộ lọc") |
| Công tắc ghi đóng | `WriteLockedNotice`; Tạo/Sửa/Đóng/Xoá (Admin) và "Báo cáo hoàn thành" (giảng viên) bị khoá; không request ghi |
| Ghi lỗi | Toast thông điệp của máy chủ (ApiError) hoặc câu dự phòng của bản cũ ("Thao tác thất bại", "Cập nhật thất bại", "Xóa thất bại"); **không bao giờ** báo thành công giả |
| Ghi thành công | Toast như bản cũ + tải lại danh sách (giữ dòng cũ trong lúc tải) |
| Danh sách người được giao lỗi/chưa cấu hình | Hiện ngay trong cột 1 của modal (kèm Thử lại) thay vì danh sách rỗng câm như bản cũ |

Khác bản cũ có chủ đích (ghi trong header các file view): modal Bootstrap → antd `Modal`; xác nhận xoá → `confirmAction`; màn giảng viên chỉ hiện ticket của chính mình; chữ rỗng tiếng Việt thay "No data"; `aria-label` cho nút biểu tượng; nhãn "Trợ giảng" cho `ROLE_MENTOR`.

## 5. Máy chủ giả lập (`scripts/mock/handlers/work-tickets.mjs`)

Phục vụ toàn bộ mục 2 với quyền 401/403/404/409/400 như trên; hồ sơ `demo` seed ticket cho giảng viên demo (`demo-teacher`: WRITING + QUIZ đang mở, FLASHCARD đã báo cáo; thêm ticket của giảng viên khác, CTV, trợ giảng); hồ sơ `e2e` giữ 4 ticket `t1..t4` khớp số liệu toast đã đóng băng. Ở hồ sơ `demo` module này cũng trả `GET` danh sách (cùng kho với thao tác ghi) nên trong `HANDLERS` phải đứng **trước** `tickets`; ở hồ sơ `e2e` `GET` danh sách vẫn do `tickets.mjs` trả.
