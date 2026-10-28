# Yêu cầu API cho backend — màn hình `/admin/teacher-management` (Quản lý giảng viên)

Trạng thái: **UI COMPLETE · API WAITING FOR BACKEND**. Frontend (M5 / W1-D) đã hoàn thiện giao diện, hook và lớp gọi API;
backend chung `LMS_IELTS/backend` **không có** endpoint giảng viên (không có user/teacher CRUD, không có đồng bộ CMS cho giảng viên —
xem `docs/M5-FULL-DEMO-PLAN.md` mục 0 và 2). Hợp đồng dưới đây là **ĐỀ XUẤT rút từ code HSK cũ** (`core/services/teacher-management.service.ts`,
`core/types/teacher-management.type.ts`, dịch vụ định danh `/id/teachers/*`) cộng với các điểm frontend mới cần; chưa backend nào xác nhận.
Frontend **không** sửa backend, **không** dùng dữ liệu giả thay thế: khi chưa cấu hình/lỗi, màn hình hiện trạng thái tương ứng.
Thao tác GHI chỉ chạy được trong chế độ xem trước cục bộ (máy chủ giả lập `scripts/mock/handlers/teachers.mjs`) hoặc sau khi người triển khai
chủ động mở công tắc `NEXT_PUBLIC_WRITE_TEACHER_MANAGEMENT=enabled` **sau khi backend xác nhận tài liệu này**.

## 1. Cấu hình phía frontend

| Biến | Ý nghĩa | Trống thì |
|---|---|---|
| `NEXT_PUBLIC_HSK_API_BASE_PATH` | Gốc các dịch vụ HSK theo hợp đồng đề xuất (`lib/api/hsk-client.ts`); đề nghị `/api/hsk` để URL đầy đủ là `/api/hsk/id/teachers` | Toàn màn hiện "WAITING FOR BACKEND", không gọi mạng |
| `NEXT_PUBLIC_WRITE_TEACHER_MANAGEMENT` | Công tắc an toàn cho THAO TÁC GHI (tạo, sửa, khoá/mở khoá, gửi lại email, import, đồng bộ CMS). Chỉ giá trị `enabled` mới mở | Nút ghi bị khoá + khối "chưa tích hợp"; hàm client tự chặn (`WriteDisabledError`): **không có request ghi nào được tạo** |
| `HSK_API_PROXY_TARGET` | Chỉ cho `next dev` (proxy cùng origin) | — |

Xác thực: cookie phiên Auth chung (`credentials: "include"`) hoặc `Authorization: Bearer`; 401 → refresh một lần rồi thử lại một lần (như mọi API khác).
Phản hồi nhận cả dạng bọc `{ success, data, errorCode, errorMessage }` lẫn dữ liệu trần. **Phân quyền: chỉ `ROLE_ADMIN`** cho mọi endpoint
(HSK cũ còn nhánh Teacher-manager — frontend mới KHÔNG phục vụ role chưa xác minh). Backend **phải** kiểm tra quyền; chặn ở frontend không thay thế.

## 2. Endpoint frontend cần (gốc = `NEXT_PUBLIC_HSK_API_BASE_PATH`)

| # | Method + đường dẫn | Dùng cho | Request | Response 200 (`data`) |
|---|---|---|---|---|
| 1 | `GET /id/teachers` | Bảng + 3 thẻ thống kê; frontend lọc/phân trang phía client (10 dòng/trang) | — | `TeacherUser[]` — **phải là mảng** (khác mảng = lỗi hợp đồng, hiện lỗi; bản cũ im lặng coi là rỗng) |
| 2 | `GET /id/teachers/import/status` | Nút "Import Excel" (khoá khi `inProgress`), hỏi lại mỗi 5 giây; modal Đồng bộ CMS hỏi mỗi 1 giây tới DONE/FAILED | — | `TeacherJobStatus` |
| 3 | `GET /id/teachers/recently-created` | Modal "Tài khoản mới" (tải mỗi lần mở và sau gửi lại/đổi email) | — | `TeacherUser[]` tạo trong **24 giờ**, mới nhất trước, **kèm `emailStatus`/`emailStatusReason`** |
| 4 | `POST /id/teachers/sync` | Nút "Đồng bộ CMS" → "Bắt đầu đồng bộ" | không body | `TeacherSyncResponse { jobId, status: "PROCESSING" \| "DONE", message? }` — xem mục 3.3 |
| 5 | `POST /id/teachers` | Modal "Tạo giảng viên mới" | `TeacherCreateRequest` | `TeacherCreateResult { teacher, emailStatus, emailStatusReason? }` |
| 6 | `PUT /id/teachers/{id}` | Modal "Cập nhật giảng viên" (hồ sơ) và "Đổi email & gửi lại" (chỉ `{ email }`) | `TeacherUpdateRequest` (trường gửi lên = trường muốn đổi) | `TeacherUser` sau cập nhật |
| 7 | `POST /id/teachers/{id}/resend-account-email` | "Cấp lại mật khẩu" (bảng), "Gửi lại email" (modal Tài khoản mới), bước 2 của "Đổi email & gửi lại" | không body | `TeacherCreateResult` |
| 8 | `POST /id/teachers/{id}/block` | Khóa quyền truy cập (sau xác nhận) | không body | `TeacherUser` với `status: "BLOCKED"` |
| 9 | `POST /id/teachers/{id}/activate` | Mở khóa (sau xác nhận) | không body | `TeacherUser` với `status: "ACTIVE"` |
| 10 | `POST /id/teachers/import` | "Import Excel": `multipart/form-data`, trường **`file`** | file `.xlsx/.xls/.xlsm/.csv` theo cột của file mẫu (mục 3.4) | `TeacherImportResult` |

```ts
type TeacherStatus = "ACTIVE" | "BLOCKED";           // màn hình chỉ phân biệt hai giá trị này (CMS "INACTIVE" → backend quy về BLOCKED?)
type EmailDeliveryStatus = "SUCCESS" | "FAILED";

interface TeacherUser {
  id: string; email: string; fullName?: string; avatarUrl?: string | null; status: TeacherStatus; roles: string[];
  shortDescription?: string | null; fullDescription?: string | null; teachingStyle?: string | null; qualification?: string | null; videoIntroLink?: string | null;
  emailStatus?: EmailDeliveryStatus; emailStatusReason?: string | null;   // chỉ tài khoản mới tạo (endpoint 3, 5, 7, 10)
  createdAt?: string;                                                      // ISO-8601, để lọc "24 giờ"
}
interface TeacherCreateRequest { email: string; fullName: string; avatarUrl?; shortDescription?; fullDescription?; teachingStyle?; qualification?; videoIntroLink? }
interface TeacherUpdateRequest { email?; fullName?; avatarUrl?; shortDescription?; fullDescription?; teachingStyle?; qualification?; videoIntroLink? }   // KHÔNG có status
interface TeacherCreateResult { teacher: TeacherUser; emailStatus: EmailDeliveryStatus; emailStatusReason?: string | null }
interface TeacherImportResult { createdCount: number; skippedCount?: number; skippedReasons?: string[]; items: TeacherCreateResult[] }
interface TeacherJobStatus { inProgress: boolean; status: "IDLE" | "PROCESSING" | "DONE" | "FAILED"; jobId?: string | null; type?: "SYNC" | "IMPORT" | null; message?: string | null; updatedAt?: string | null }
interface TeacherSyncResponse { jobId: string; status: "PROCESSING" | "DONE"; message?: string | null }
```

Giới hạn ký tự frontend áp (khớp `maxLength` form cũ, backend nên kiểm tra lại): `shortDescription` 500, `fullDescription` 5000, `teachingStyle` 300,
`qualification` 500; `email` theo `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`; `fullName` bắt buộc. Trường tuỳ chọn rỗng **không được gửi** (bị cắt khỏi JSON).

## 3. Nghiệp vụ giao diện phụ thuộc

### 3.1 Tạo / gửi email tài khoản
- Backend **tự sinh mật khẩu** và gửi email (form chỉ có email + họ tên + hồ sơ tuỳ chọn, như bản cũ). `emailStatus` quyết định toast:
  `SUCCESS` → "Tạo giảng viên thành công. Mật khẩu đã được gửi qua email."; `FAILED` → cảnh báo kèm `emailStatusReason`.
- Sau tạo/import, frontend mở modal "Tài khoản mới" và **tải lại endpoint 3** (không tự ghép bản ghi vừa tạo) → endpoint 3 phải chứa bản ghi mới ngay.
- "Đổi email & gửi lại" = `PUT {id}` với `{ email }` rồi `POST {id}/resend-account-email` (hai bước, như bản cũ). Nếu backend muốn một endpoint gộp, báo lại.

### 3.2 Khoá / mở khoá — **một endpoint một việc**
- Service cũ có chuỗi dự phòng: `/block` lỗi → `DELETE /id/teachers/{id}` → `PUT {status:"BLOCKED"}`; `/activate` lỗi → `/unblock` → `PUT {status:"ACTIVE"}`.
  Frontend mới **không** sao chép: chỉ gọi `/block` và `/activate`; lỗi là lỗi (toast thông điệp của backend). `PUT` **không** nhận `status`
  (máy chủ giả lập trả 400 nếu có). Đề nghị `409` khi trạng thái đã đúng (đã khoá / đang hoạt động).

### 3.3 Đồng bộ CMS — job có theo dõi
- Bản cũ: `POST /sync` đồng bộ (chờ tới khi xong), thanh tiến trình chỉ chạy bằng timer. Đề xuất mới: `POST /sync` trả ngay `jobId` + `status`;
  frontend hỏi endpoint 2 mỗi giây tới `DONE` (→ thành công, tải lại danh sách, hiện `message`) hoặc `FAILED` (→ lỗi, hiện `message`); quá ~2 phút
  coi là lỗi. Nếu backend đồng bộ nhanh và trả thẳng `status: "DONE"`, frontend không hỏi lại. Nếu backend **chỉ** làm được kiểu đồng bộ cũ
  (trả về khi xong), vẫn tương thích: trả `{ jobId, status: "DONE", message }`.
- Khi có job đang chạy, `POST /sync` và `POST /import` nên trả `409` (`JOB_IN_PROGRESS`); endpoint 2 dùng chung cho cả hai loại (`type`).
- `inProgress` giữ tên trường của `TeacherImportStatus` cũ; các trường còn lại là đề xuất.

### 3.4 Import và file mẫu
- Cột (đúng thứ tự tiêu đề của template cũ): `Email (*)`, `Họ và tên (*)`, `Mô tả ngắn`, `Mô tả chi tiết`, `Phong cách giảng dạy`,
  `Bằng cấp / Chứng chỉ`, `URL Video giới thiệu`, `URL Ảnh đại diện`; dòng 1 là tiêu đề.
- **Khác bản cũ:** nút "Tải file mẫu" tạo **CSV UTF-8 có BOM** phía client (`Template_Import_Giang_Vien.csv`) thay cho `.xlsx` (bản cũ dùng thư viện
  `xlsx`, không được thêm vào app mới). Backend nên nhận cả `.csv` lẫn `.xlsx` ở endpoint 10 (ô `accept` của frontend: `.xlsx, .xls, .xlsm, .csv`).
  Máy chủ giả lập chỉ đọc CSV; file Excel nhị phân bị trả về trong `skippedReasons`.
- Kết quả: toast "Đã nhập thành công N giảng viên từ Excel", cảnh báo "Bỏ qua M dòng…: <skippedReasons[0]>", lỗi khi `createdCount = skippedCount = 0`;
  có `items` → mở modal Tài khoản mới. Bản cũ đặt timeout 5 phút cho import — frontend mới dùng timeout mặc định của trình duyệt; nếu import lâu,
  backend nên xử lý nền và báo qua endpoint 2 (`type: "IMPORT"`), frontend sẽ bổ sung theo dõi khi có hợp đồng.

### 3.5 Ảnh đại diện / video
- Form nhập **URL** (`avatarUrl`, `videoIntroLink`) có xem trước. Bản cũ có nút chọn file nhưng chỉ tạo `blob:` URL của tab hiện tại rồi gửi lên
  như địa chỉ ảnh (không dùng được) — không sao chép. Nếu cần tải file lên thật, dùng dịch vụ storage (presign/upload) rồi điền URL; cần hợp đồng riêng.

## 4. Mã lỗi / tình huống frontend xử lý

| Tình huống | Hiển thị |
|---|---|
| Chưa cấu hình `NEXT_PUBLIC_HSK_API_BASE_PATH` | Khối "WAITING FOR BACKEND" thay bảng (không Thử lại), thẻ thống kê "—"; modal Tài khoản mới cũng vậy; không gọi mạng |
| Công tắc ghi đóng | Nút Đồng bộ CMS / Import / Tạo / Cấp lại mật khẩu / Sửa / Khóa bị khoá + khối "chưa tích hợp"; vẫn tải file mẫu và xem Tài khoản mới |
| 401 | Refresh một lần; thất bại → "Phiên đăng nhập đã hết hạn…" |
| 403 | "Bạn không có quyền thực hiện thao tác này." |
| 400 / 409 / 4xx khác | Toast `errorMessage` của backend nếu là văn bản ≤ 300 ký tự không phải HTML (vd "Email đã được dùng cho giảng viên khác"); form giữ nguyên để sửa |
| 5xx / mất kết nối | Danh sách: khối lỗi có "Thử lại". Thao tác ghi: toast lỗi, KHÔNG báo thành công, danh sách không đổi |
| `data` của endpoint 1/3 không phải mảng | "Dữ liệu trả về không đúng định dạng danh sách giảng viên." |
| Bấm đúp thao tác ghi | Chỉ một request (khoá đồng bộ + nút khoá khi đang xử lý) |

Sau mỗi thao tác ghi thành công frontend **tải lại danh sách** (endpoint 1) thay vì vá dữ liệu cục bộ như bản cũ → endpoint 1 cần phản ánh thay đổi ngay.

## 5. Điểm cần backend xác nhận / quyết định

1. Đường dẫn thật và gốc dịch vụ (`/id/teachers` thuộc dịch vụ định danh ở HSK cũ — backend chung đặt ở đâu?). Quyền chỉ `ROLE_ADMIN`?
2. Ánh xạ trạng thái CMS (`INACTIVE`, khác) về `ACTIVE`/`BLOCKED`; `roles` luôn chứa `ROLE_TEACHER`?
3. `sync`: đồng bộ hay nền (mục 3.3); nguồn CMS là ERP của backend chung? Hành vi với giảng viên bị khoá ở LMS nhưng còn ở CMS?
4. Chống trùng khi gửi lại email liên tiếp (rate limit?) và nội dung `emailStatusReason` có hiển thị được cho Admin không.
5. Giới hạn kích thước/định dạng file import, xử lý trùng email trong file, mã lỗi từng dòng (`skippedReasons` dạng chuỗi hay có cấu trúc).
6. Endpoint 3 "24 giờ" tính theo `createdAt` của tài khoản hay của lần gửi email gần nhất?
7. Có cần phân trang/tìm kiếm phía server cho endpoint 1 khi số giảng viên lớn (frontend hiện lọc/phân trang phía client như bản cũ)?
