# Yêu cầu API — Dịch vụ thanh toán: Sao kê (`/admin/statements`) và Gói thành viên (`/admin/membership-management`)

Trạng thái: **UI COMPLETE · API WAITING FOR BACKEND**. Frontend (M5 W1-C) đã hoàn thiện hai màn Admin và lớp gọi API (`src/lib/api/payment-client.ts` qua `hskClient`, DTO `src/types/payment.ts`); backend chung `LMS_IELTS/backend` **chưa có** dịch vụ thanh toán. Hợp đồng dưới đây là **GIẢ ĐỊNH rút từ code HSK cũ** (`core/services/payment.service.ts`, `membership.service.ts`, `core/types/payment.type.ts`, `membership.type.ts`; tiền tố `/payment` sau axios baseURL `<LMS_API>/api`). Frontend không dùng dữ liệu giả thay thế — **bản cũ rơi về 2 gói MOCK "VIP Monthly/Yearly" khi API lỗi, bản mới không**.

## 1. Cấu hình phía frontend

| Biến | Ý nghĩa | Trống thì |
|---|---|---|
| `NEXT_PUBLIC_HSK_API_BASE_PATH` | Gốc các dịch vụ nghiệp vụ HSK theo hợp đồng đề xuất (xem `lib/api/hsk-client.ts`); đường dẫn dưới đây nối thêm `/payment/...` | Hai màn hiện "WAITING FOR BACKEND", không gọi mạng |
| `NEXT_PUBLIC_WRITE_MEMBERSHIP` | Công tắc an toàn cho CRUD gói thành viên. Chỉ `enabled` mới mở | Nút Tạo/Sửa/Xoá khoá + khối "WAITING FOR BACKEND"; hàm client tự chặn, **không request ghi** |
| `HSK_API_PROXY_TARGET` | Chỉ cho `next dev` | — |

Mọi lời gọi: cookie phiên + Bearer nếu có; 401 → refresh một lần. Phản hồi nhận cả dạng bọc `{ success, data }` lẫn dữ liệu trần.

## 2. Sao kê (`/admin/statements`, chỉ ĐỌC, `ROLE_ADMIN` — PrivateRoute HSK cũ)

| # | Method + đường dẫn | Dùng cho | Phản hồi |
|---|---|---|---|
| 1 | `GET /payment/reports/summary` | 4 thẻ: Tổng thu nhập, Số giao dịch, Lượt bán Khóa học, Lượt bán Trả phí | `PaymentSummary` |
| 2 | `GET /payment/reports/transactions?page=<từ 0>&size=10&sort=<field,dir>` | Bảng giao dịch **phân trang + sắp xếp phía máy chủ**; `sort` ∈ `createdAt,desc` (mặc định) · `createdAt,asc` · `totalPrice,desc` · `totalPrice,asc` | `TransactionReportPage` |

```ts
PaymentSummary { totalRevenue?: number; totalTransactions?: number; totalStudents?: number; totalCoursesSold?: number; totalMembershipsSold?: number }
  // trường thiếu => ô hiện "—" (bản cũ tự duyệt tới 50 trang giao dịch để tính bù — KHÔNG port)
TransactionReportPage { content: TransactionReportItem[]; totalElements: number; totalPages: number }   // kiểu Spring Page; totalElements cần cho thanh phân trang
TransactionReportItem {
  orderId: string; orderCode: number;                 // "#<orderCode>"
  status: string;                                      // PENDING | PAYING | COMPLETED (hoặc PAID) | CANCELLED — khác => coi là PENDING
  createdAt: ISO-8601; paidAt?: ISO-8601;              // cột "Ngày thanh toán" = paidAt (DD/MM/YYYY HH:mm), thiếu => "-"
  totalPrice: number;                                  // VND
  buyer: { userId: string; username: string; fullName?: string; email?: string };
  courses: TransactionItem[];                          // tên trường cũ dù gồm cả gói thành viên
}
TransactionItem { packageId: string; packageName: string; price: number; thumbnail?: string; itemType?: "COURSE" | "MEMBERSHIP"; durationInDays?: number }
  // itemType khác "MEMBERSHIP" (hoặc thiếu) => Khóa học; cột "Loại" gộp các loại có trong đơn
```

Nghiệp vụ giao diện phụ thuộc: tìm kiếm (mã đơn, người mua, email, trạng thái, tên mục) và lọc loại (Tất cả/Khóa học/Trả phí) chạy **phía client trên trang hiện tại** như bản cũ (hợp đồng không có tham số lọc). Nếu cần lọc toàn bộ, backend bổ sung tham số và báo lại.

Cần xác nhận: (a) `page` từ 0 và `sort` theo cú pháp Spring; (b) ý nghĩa `totalRevenue`/`totalCoursesSold`/`totalMembershipsSold` chỉ đếm đơn `COMPLETED`? `totalTransactions`/`totalStudents` đếm mọi đơn? (mock tính như vậy); (c) múi giờ của `paidAt`/`createdAt` (ISO UTC).

## 3. Gói thành viên (`/admin/membership-management`, `ROLE_ADMIN`)

| # | Method + đường dẫn | Dùng cho | Phản hồi |
|---|---|---|---|
| 1 | `GET /payment/membership-plans/admin/all` | Bảng (mọi gói, kể cả `active = false` "Đã ẩn"); tìm kiếm/sắp giá phía client | `MembershipPlan[]` |
| 2 | `POST /payment/membership-plans/admin` body `MembershipPlanRequest` | "Tạo ngay" | `MembershipPlan`, 200/201; 400 nếu sai |
| 3 | `PUT /payment/membership-plans/admin/{id}` body `MembershipPlanRequest` (frontend gửi đủ 5 trường) | "Cập nhật" | `MembershipPlan`; 404 |
| 4 | `DELETE /payment/membership-plans/admin/{id}` | "Xóa" (sau hộp xác nhận) | 200/204; 404; **409** nếu gói đã có giao dịch (đề xuất — frontend hiện thông điệp máy chủ trong toast) |

```ts
MembershipPlan { id: string; name: string; description: string; price: number /* VND */; durationInDays: number; active: boolean; createdAt?: ISO-8601; updatedAt?: ISO-8601 }
MembershipPlanRequest { name: string; description: string; price: number; durationInDays: number; active: boolean }   // name/description đã cắt khoảng trắng hai đầu
```

Kiểm tra phía frontend trước khi gọi (như bản cũ + 1 bổ sung): `name` không trống và `price > 0` → "Vui lòng điền đầy đủ tên và giá hợp lệ"; `durationInDays` nguyên ≥ 1 (bản cũ chỉ chặn ở InputNumber min=1). Backend vẫn phải validate và trả 400 kèm thông điệp.

Cần xác nhận: (a) `GET …/admin/all` trả mảng trần hay bọc; (b) xoá gói đã bán: 409 (đề xuất) hay xoá mềm; (c) `active = false` có ẩn khỏi API công khai `GET /payment/membership-plans` không (màn học viên, ngoài phạm vi); (d) ràng buộc trùng `name`?

## 4. Hành vi giao diện (đã kiểm thử với mock cách ly, `tests/statements.test.tsx`, `tests/membership-management.test.tsx`)

| Tình huống | Frontend |
|---|---|
| Chưa cấu hình `NEXT_PUBLIC_HSK_API_BASE_PATH` | Dòng "WAITING FOR BACKEND" (không Thử lại); sao kê: thẻ "—", không bảng; gói: không bảng, nút Tạo khoá; không gọi mạng |
| API lỗi | Dòng lỗi + "Thử lại"; sao kê: tổng quan và giao dịch là hai trạng thái độc lập; thẻ "—"; **không** số 0 giả, **không** gói MOCK |
| Phản hồi sai hình dạng (`content` không phải mảng, danh sách gói không phải mảng) | Lỗi hợp đồng "không đúng định dạng" thay vì bảng rỗng |
| Đang tải | Sao kê: thẻ "0 ₫"/"0" như bản cũ, bảng spinner; đổi trang/sắp xếp giữ dòng + thanh phân trang của trang trước |
| Công tắc ghi đóng | `WriteLockedNotice`; Tạo/Sửa/Xoá gói khoá; không request ghi |
| Ghi lỗi | Toast thông điệp máy chủ (ApiError) hoặc "Thao tác thất bại"/"Xóa gói thất bại"; form giữ nguyên để sửa; không báo thành công giả |
| Ghi thành công | Toast "Tạo/Cập nhật gói thành công", "Xóa gói thành công" + tải lại danh sách |

Khác bản cũ có chủ đích: phân trang thật phía máy chủ ở sao kê (bản cũ chỉ tải trang 1, để chỗ "Pagination logic would go here"); đổi sắp xếp về trang đầu; `moment` → `dayjs`; `Modal.confirm` → `confirmAction`; `confirmLoading` thay `loading` (skeleton) khi lưu gói; `.membership-management` là class của `.content`; chữ rỗng tiếng Việt.

## 5. Máy chủ giả lập (`scripts/mock/handlers/payment.mjs`, `/api/hsk/payment/*`)

Chỉ `ROLE_ADMIN` (401/403), đọc tôn trọng `controls.api` (ok|error|slow). Hồ sơ `demo`: 4 gói (1 đã ẩn, chưa bán => xoá được; 3 gói đã bán => `DELETE` trả 409) + 37 giao dịch sinh từ học viên/khoá học demo, tổng quan **tính từ cùng kho** nên luôn khớp bảng; hồ sơ `e2e`: 3 gói + 12 giao dịch cố định. `sort` ngoài `createdAt|paidAt|totalPrice|orderCode,asc|desc` => 400. Thao tác ghi đổi dữ liệu trong bộ nhớ; `/mock-reset` về seed.
