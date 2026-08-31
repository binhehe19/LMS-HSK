# Yêu cầu API cho backend — Tổng quan quản trị: `/admin/dashboard` và `/admin/analytics`

Trạng thái: **WAITING FOR BACKEND**. Frontend (M5, gói W1-E) đã hoàn thiện giao diện, lớp gọi API và máy chủ giả lập; **chưa có endpoint tương thích trong backend chung** (`LMS_IELTS/backend`). Tài liệu dành cho người phụ trách backend. Frontend **không** sửa backend và **không** dùng dữ liệu giả thay thế: dịch vụ chưa cấu hình ⇒ màn hiện "WAITING FOR BACKEND", API lỗi ⇒ hiện lỗi + "Thử lại"; không bao giờ hiện số 0 như thật.

Cả hai màn **chỉ đọc**, chỉ `ROLE_ADMIN` (PrivateRoute của HSK cũ). Client: `src/lib/api/admin-overview-client.ts` qua `hskClient` (`NEXT_PUBLIC_HSK_API_BASE_PATH`, đề nghị `/api/hsk`). DTO: `src/types/admin-overview.ts`. Mock: `scripts/mock/handlers/admin-overview.mjs`.

## 1. Đối chiếu (đọc code, chưa chạy)

| Màn | HSK cũ gọi | Backend chung IELTS | Kết luận |
|---|---|---|---|
| `/admin/dashboard` (`admin-dashboard.tsx`) | **4 lời gọi** gộp ở frontend: `paymentService.getLmsOverview()` (`/payment/...` → `LmsOverviewReport`), `adminUserService.getStatistics()` (`/id/admin/users/statistics`), `teacherAnalyticsService.getOverview()`, `videoCourseService.countPublishedPackages()` (đã comment, luôn 0). Lời gọi phụ lỗi thì **im lặng giữ số 0**; chỉ báo lỗi khi cả 3 nguồn lỗi | Không có payment, không có thống kê người dùng/giảng viên, không có dashboard admin (xem `docs/M5-FULL-DEMO-PLAN.md` mục 0) | **MISSING** → đề xuất **MỘT** endpoint gộp (mục 2.1) |
| `/admin/analytics` (`admin-analytics-dashboard.tsx` + `analytics.service.ts`) | `GET /id/analytics/admin/overview?days=` → `AnalyticsOverview` (dịch vụ identity của HSK cũ); mọi lỗi → `null` → "Không thể tải dữ liệu" | Không có phân tích hành vi | **MISSING** → giữ nguyên hợp đồng cũ (mục 2.2) |

Không có endpoint IELTS nào "gần giống" để tái sử dụng cho hai màn này.

## 2. Endpoint đề nghị

Chung cho cả hai: xác thực cookie phiên Auth chung hoặc `Authorization: Bearer` (`credentials: include`; 401 ⇒ frontend refresh một lần); phân quyền `ROLE_ADMIN` **do backend kiểm tra** (`401` chưa đăng nhập, `403` sai role); response bọc envelope `{ "success": true, "data": {...} }` (frontend cũng nhận thân trần); `days` không hợp lệ ⇒ `400`.

### 2.1 `GET {HSK}/management/dashboard/overview?days=30`

Hàm `getDashboardOverview(days)`. Frontend luôn gửi `days=30` (`DASHBOARD_WINDOW_DAYS`).

```ts
interface DashboardOverview {
  users:    { total: number; teachers: number; teacherManagers: number; students: number };  // số liệu HIỆN THỜI (không phụ thuộc days)
  classes:  { total: number; ongoing: number; upcoming: number; finished: number };          // BỔ SUNG so với HSK cũ; hiện thời
  grading:  { pendingAttempts: number; submittedThisWeek: number; returnedThisWeek: number }; // BỔ SUNG; "ThisWeek" = 7 ngày gần nhất cố định
  revenue:  { total: number; videoCourse: number; membership: number;                        // VNĐ, số nguyên, TRONG CỬA SỔ `days`
              byChannel: { label: string; amount: number }[];                                // cột biểu đồ "Doanh thu theo kênh"; total = Σ amount
              note?: string };                                                               // ghi chú nguồn số liệu (mock: "giả lập"); hiện nguyên văn nếu có
  courseDistribution: { label: string; count: number }[];                                    // lát donut "Phân bổ khóa học"; nhãn do backend quyết định
  generatedAt: string;                                                                       // ISO datetime lúc tính
}
```

Nghiệp vụ frontend phụ thuộc:

- `users.*` → 4 thẻ "Thống kê người dùng" (giữ nguyên HSK cũ: Tổng người dùng / Giảng viên / Quản lý giảng viên / Học viên). Đề nghị: `teachers` = tài khoản có `ROLE_TEACHER`, `teacherManagers` = `ROLE_TEACHER_MANAGER`, `students` = `ROLE_USER`; backend xác nhận định nghĩa.
- `classes.ongoing`, `grading.*` → hàng thẻ **mới** "Lớp học & chấm bài" (Lớp đang học / Bài chờ chấm / Bài nộp tuần này / Đã trả bài tuần này). Trạng thái lớp theo `lifecycleStatus` của ERP (ONGOING/UPCOMING/FINISHED). `pendingAttempts` = bài nộp đang `SUBMITTED` chờ giáo viên chấm (xem hợp đồng chấm bài, `docs/api-requirements/*` của M5 W1).
- `revenue.*` → 3 thẻ doanh thu + biểu đồ cột. Tiêu đề mục ghi "30 ngày gần nhất". `total === 0` ⇒ "Chưa phát sinh doanh thu". Backend chung **không có payment**: nếu không có nguồn, trả `0` kèm `note` giải thích thay vì bỏ trường (frontend coi thiếu trường là lỗi hợp đồng).
- `courseDistribution` → donut; tổng 0 ⇒ "Chưa có khóa học".
- Mọi trường trên là **bắt buộc** (trừ `note`): `isDashboardOverview` (`src/lib/admin-overview/dashboard-model.ts`) từ chối phản hồi thiếu khối/sai kiểu ⇒ màn hiện lỗi "Dữ liệu tổng quan trả về không đúng định dạng."

### 2.2 `GET {HSK}/id/analytics/admin/overview?days=7|14|30`

Hàm `getAnalyticsOverview(days)`. Hình dạng **giữ nguyên** `AnalyticsOverview` của `analytics.service.ts` cũ:

```ts
interface AnalyticsOverview {
  period: { from: string; to: string; days: number };          // ISO ngày
  totalEvents: number;
  activeUsers: number;                                         // học viên có ≥ 1 sự kiện trong kỳ
  eventBreakdown:  { eventType: string; count: number }[];     // ĐÃ sắp giảm theo count (frontend không sắp lại, như bản cũ)
  moduleBreakdown: { module: string; count: number }[];
  dailyTrend:      { date: string; count: number }[];          // mỗi ngày trong kỳ, "YYYY-MM-DD", tăng dần
}
```

- `eventType`/`module` ánh xạ sang tiếng Việt bằng `EVENT_TYPE_LABELS`/`MODULE_LABELS` (`src/lib/admin-overview/analytics-model.ts`, nguyên văn HSK cũ); mã chưa có trong bảng hiện **nguyên văn** (không ẩn). Backend bổ sung loại sự kiện mới ⇒ báo để frontend thêm nhãn.
- "TB sự kiện/ngày" = `round(totalEvents / days)` tính ở frontend theo cửa sổ đang chọn (như bản cũ).
- Nhãn trục X = `d/m` đọc trực tiếp từ `date` ISO (không qua múi giờ).
- Nguồn dữ liệu: FEAT-BEHAVIOR-TRACKING (thu hành vi học viên) — chưa có trong backend chung; nếu chưa có kho sự kiện, backend có thể trả `totalEvents: 0` và các mảng rỗng (frontend hiện "Chưa có dữ liệu", **không** phải lỗi).

## 3. Hành vi frontend theo tình huống (đã kiểm thử với mock/vitest)

| Tình huống | `/admin/dashboard` | `/admin/analytics` |
|---|---|---|
| Chưa cấu hình `NEXT_PUBLIC_HSK_API_BASE_PATH` | Dòng WAITING FOR BACKEND (không "Thử lại"), mọi ô "—", biểu đồ "Chưa có dữ liệu để hiển thị" | Dòng WAITING FOR BACKEND (không "Thử lại") |
| 401 / 403 / 5xx / mất mạng | Thông điệp lỗi + "Thử lại"; ô "—" | Thông điệp lỗi + "Thử lại" |
| Phản hồi sai hợp đồng | "Dữ liệu tổng quan trả về không đúng định dạng." | "Dữ liệu phân tích trả về không đúng định dạng." |
| Dữ liệu rỗng thật | "Chưa phát sinh doanh thu" / "Chưa có khóa học" | Thẻ 0, ba khối "Chưa có dữ liệu" |
| Đổi cửa sổ ngày | (không có) | Gọi lại với `days` mới; phản hồi trễ của cửa sổ cũ bị bỏ |

## 4. Máy chủ giả lập (tham chiếu hành vi mong đợi)

`scripts/mock/handlers/admin-overview.mjs`: `401`/`403` đúng hợp đồng; `days` ngoài 1..365 hoặc không nguyên ⇒ `400 VALIDATION_ERROR`; tôn trọng `controls.api` (`error` ⇒ 500, `slow` ⇒ trễ 2,5 s). Hồ sơ `demo` **tính** `users/classes/grading/courseDistribution` từ cùng bộ dữ liệu với các màn lớp học/chấm bài (`state.data.raw`); doanh thu không có nguồn ⇒ sinh xác định theo seed và ghi `revenue.note: "giả lập"`. Hồ sơ `e2e`: số cố định. Chuỗi ngày của analytics xác định theo ngày (cửa sổ 7 ngày là đuôi của cửa sổ 30 ngày).

## 5. Điểm backend cần xác nhận trước khi tích hợp

1. Đường dẫn/base path thật của hai endpoint và dịch vụ chịu trách nhiệm (repo-lms hay dịch vụ mới).
2. Định nghĩa `users.*` theo role của Auth chung (ROLE_TEACHER / ROLE_TEACHER_MANAGER / ROLE_USER; `ROLE_MANAGER` là role riêng — có gộp vào "Quản lý giảng viên" không?).
3. Nguồn doanh thu khi backend chung không có payment: trả 0 + `note`, hay bỏ hẳn mục doanh thu khỏi màn (quyết định chủ dự án; frontend hiện giữ vì HSK cũ có).
4. Nguồn sự kiện hành vi (FEAT-BEHAVIOR-TRACKING) và danh mục `eventType`/`module` chính thức.
5. Chu kỳ cache phía backend (HSK cũ không cache; màn gọi mỗi lần vào trang và khi bấm "Thử lại"/đổi cửa sổ ngày).
