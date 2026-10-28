# Yêu cầu API — Khoá học trực tuyến (`/learning-path/online-course/manage`) và Đăng ký khoá học (`/learning-path/online-course/leads`)

Trạng thái: **UI_COMPLETE · API MISSING (WAITING FOR BACKEND)**. Hợp đồng dưới đây là **ĐỀ XUẤT**, kế thừa đường dẫn `/online-learning/*` của
`LMS_Frontend/src/core/services/online-course.service.ts` (HSK cũ) để người phụ trách backend đối chiếu; đường dẫn/hình dạng cuối do backend chốt.
Frontend gọi qua `hskClient` (`src/lib/api/online-course-client.ts`, base `NEXT_PUBLIC_HSK_API_BASE_PATH`, đề nghị `/api/hsk`); production để trống
biến => màn hình hiện WAITING FOR BACKEND; mock: `scripts/mock/handlers/online-course.mjs`.

## 1. Đối chiếu backend chung (LMS_IELTS/backend, đọc code 2026-10-27)

Không có service khoá học trực tuyến/đăng ký tư vấn (repo-lms chỉ có lớp/giáo trình proxy ERP). Không có endpoint tương đương => MISSING.

## 2. Quyền

| Màn | HSK cũ | App mới (đề xuất backend ENFORCE) |
|---|---|---|
| `/online-course/manage` | PrivateRoute ADMIN, TEACHER_MANAGER; nút ghi theo ticket ONLINE_COURSE | **chỉ `ROLE_ADMIN`** (Teacher-manager chưa được app mới phục vụ) |
| `/online-course/leads` | PrivateRoute ADMIN, TEACHER_MANAGER nhưng **endpoint `/leads` mở công khai (lỗ hổng U5)** | **chỉ `ROLE_ADMIN`**; 401 khi chưa đăng nhập, 403 sai role — mock đã trả đúng |

Backend phải kiểm tra quyền ở mọi endpoint; guard frontend chỉ là rào giao diện.

## 3. Endpoint khoá học (gốc `NEXT_PUBLIC_HSK_API_BASE_PATH`)

| # | Method + đường dẫn | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `GET /online-learning/courses` | Lưới card + 4 thẻ thống kê; bộ lọc/sắp xếp làm **phía client** | `data` phải là **mảng** `OnlineCourseSummary[]` (khác mảng = lỗi hợp đồng). Bản cũ còn gọi `GET /syllabuses/{id}` cho từng khoá để "hydrate" — app mới **bỏ** vì màn quản lý không dùng |
| 2 | `GET /online-learning/courses/{id}` | Modal "Thông Tin Chi Tiết" (bước 1) | `OnlineCourseDetail`; chấp nhận bí danh `syllabus_id` |
| 3 | `GET /online-learning/courses/{id}/full-detail` | Modal chi tiết (bước 2, ghi đè bước 1) | đề nghị **đối tượng phẳng** `{ ...course, syllabusInfo?, syllabus_description? }` (bản cũ chuẩn hoá `{course, syllabus: {data}}` lồng nhau — không giữ) |
| 4 | `GET /online-learning/syllabuses/{id}` | Bước 3, chỉ khi hai bước trên không có mô tả giáo trình | `{ id, name, syllabus_description \| description \| content }` |
| 5 | `PUT /online-learning/courses/{id}` | Modal "Cập Nhật Khóa Học" | body `OnlineCourseUpsertRequest` (trường rỗng **không gửi**); 400 khi `name` rỗng |
| 6 | `DELETE /online-learning/courses/{id}` | Xoá (confirmAction) | 404 nếu không có |
| 7 | `POST /online-learning/courses` | **Chưa dùng**: nút "Tạo mới khóa học" bản cũ ẩn bằng `{false && …}` — giữ ẩn | giữ trong hợp đồng để backend biết; client không có hàm tạo |
| 8 | `POST /online-learning/sync/all` | Nút "Đồng bộ dữ liệu" | trả `OnlineSystemSyncJob {jobId, status: RUNNING}`; đề nghị **409** khi đang có tiến trình (frontend hiện thông điệp máy chủ) |
| 9 | `GET /online-learning/sync/all/{jobId}` | Hỏi lại mỗi 3 giây, tối đa 120 lần (như bản cũ) | `{jobId, status: RUNNING\|SUCCESS\|FAILED, currentStep?, progressPercent?, message?}`; SUCCESS => frontend tải lại danh sách |

```ts
OnlineCourseSummary { id; code?|slug?; name?|title?; thumbnail?|thumbnailUrl?; description?|shortDescription?; syllabusId?; price?: number;
                      rating?: number; courseType?: "Group"|"1-1"|string; level?; totalLessons?: number; cmsSynced?: boolean }
OnlineCourseDetail  extends Summary { syllabus_id?; syllabusInfo?: { syllabus_description?|description?|content? }; syllabus_description? }
OnlineCourseUpsertRequest { name?; thumbnail?; description?; price?; rating?; syllabusId?; courseType?; level?; totalLessons? }
```

Điểm cần backend xác nhận: (a) có cặp bí danh nào trong Summary không — frontend đọc `name||title`, `code||slug`, `thumbnail||thumbnailUrl` như bản cũ,
đề nghị chốt một tên; (b) `courseType` giá trị chuẩn (frontend so khớp chuỗi chứa "group" / "one" / "1-1" như bản cũ); (c) `description` là HTML
rich-text từ CMS? frontend bỏ thẻ khi hiển thị/sửa; (d) mô tả giáo trình có 4 tiêu đề con "Đối tượng:/Mục tiêu:/Nội dung cốt lõi:/Kỹ năng thực
chiến:" được frontend in đậm — có chuẩn hoá được không.

## 4. Endpoint đăng ký khoá học (lead) — chỉ đọc

| # | Method + đường dẫn | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `GET /online-learning/leads?courseCode&from&to&page=0&size=20&sort=registeredAt,desc` | Bảng phân trang máy chủ (Trước/Sau) | tham số rỗng **không gửi**; `from/to` = `YYYY-MM-DD`, lọc theo ngày `registeredAt` bao gồm hai đầu; `courseCode` khớp chứa (không phân biệt hoa thường) — cần xác nhận |
| 2 | `GET /online-learning/courses` | Từ điển `courseCode/id/name → courseType` để điền cột "Loại khóa học" khi bản ghi thiếu | như bản cũ; lỗi thì bỏ qua lặng lẽ |

```ts
OnlineCourseLeadPage { content: OnlineCourseLead[]; totalElements; totalPages; size; number /* trang hiện tại từ 0 */ }   // Spring Page
OnlineCourseLead { id; courseId?; courseCode; courseName?; courseType?; fullName; email; phone; note?; registeredAt?: ISO-8601;
                   status?: "PENDING"|"IN_PROGRESS"|"COMPLETED"|"CANCELED" }
```

- Trạng thái lọc **phía client** trên trang hiện tại (như bản cũ). Trạng thái thiếu/lạ hiển thị "Chờ tư vấn".
- **Xuất Excel bản cũ (`GET /leads/export`, .xlsx) KHÔNG chuyển**: app mới có nút "Xuất CSV" tạo phía trình duyệt từ các dòng đang hiển thị
  (UTF-8 BOM). Nếu cần xuất toàn bộ theo bộ lọc, backend cung cấp endpoint xuất (đề nghị CSV/XLSX) — frontend sẽ nối thêm.
- Bản cũ chấp nhận nhiều bí danh (`code`, `course_code`, `syllabusCode`, `name`, `course_name`...): hợp đồng đề xuất **chốt** tên trường ở trên.

## 5. Hành vi giao diện khi API chưa sẵn sàng (đã kiểm thử với mock)

| Tình huống | Frontend |
|---|---|
| `NEXT_PUBLIC_HSK_API_BASE_PATH` trống | Khối WAITING FOR BACKEND thay lưới/bảng; thống kê "—"; không gọi mạng, không toast |
| Công tắc ghi `NEXT_PUBLIC_WRITE_ONLINE_COURSE` ≠ `enabled` (và không demo) | Đồng bộ/Sửa/Xóa bị khoá + WriteLockedNotice; `assertWriteEnabled` chặn ở client (không có request ghi) |
| Lỗi tải | Khối lỗi với thông điệp máy chủ + "Thử lại" (bản cũ: toast rồi lưới rỗng) |
| Ghi lỗi | Toast thông điệp máy chủ; không "thành công giả"; sau ghi thành công TẢI LẠI từ máy chủ |
