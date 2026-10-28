# Yêu cầu API cho backend — màn hình `/admin/class-management` (+ `/admin/class-management/students`)

## 0. Cập nhật 2026-10-27 — nguồn production là backend chung (M5, gói W1-E)

Trạng thái mới: **AVAILABLE / PARTIAL** (client viết theo DTO trong source `repo-lms`; **chưa xác minh trên môi trường dev/staging nào**). Hai màn Admin đọc từ
backend chung qua `lmsClient` (`NEXT_PUBLIC_LMS_API_BASE_PATH`, đề nghị `/api/lms`), chọn nguồn ở `src/lib/api/admin-class-source.ts`; hợp đồng đề xuất HSK cũ
(`/api/quiz/grading/admin/classes`, phần dưới) chỉ còn dùng để xem trước với máy chủ giả lập và cho bộ kiểm thử trình duyệt hiện có. Không trộn hai nguồn trong một lần tải;
không nguồn nào cấu hình ⇒ WAITING FOR BACKEND.

| Màn | Backend chung (`ClassController`, `ROLE_ADMIN`, proxy chỉ đọc ERP) | Ánh xạ (`lib/class-management/lms-class-adapter.ts`) | Thiếu so với HSK cũ ⇒ giao diện hiện "—" |
|---|---|---|---|
| Danh sách lớp | `GET /classes?page&size[&keyword&lifecycleStatus&teacherId]` → `PageResponse<ClassSummaryResponse>` (snake_case `items,total_elements,total_pages,page,size`; frontend lấy mọi trang) | `classSummaryToGradingClass`: code/name/course/teacher/startDate/lifecycleStatus; `scheduleDays` từ `schedulePatterns[].dayOfWeek`; `startTime`/`duration` từ pattern đầu | `endDate`, `actualEndDate`, `studentCount` (không dùng `expectedSize` — là sĩ số dự kiến), `ungradedCount`, `totalSessions` |
| Dải thông tin lớp (students) | `GET /classes/{id}` + `GET /classes/{id}/sessions` (đếm buổi) + `GET /classes/{id}/enrollments` (đếm học viên) | `classDetailToAdminClassInfo`: + syllabusName, mentor, studentManager, meetingLink, note; sessions/enrollments lỗi ⇒ số đếm "—" (không chặn dải) | `ungradedCount` |
| Bảng học viên | `GET /classes/{id}/enrollments?page&size` → `EnrollmentResponse` (mọi trang) | `enrollmentToAdminStudent`: email/tên/SĐT/mã, chuyên cần từ `attendanceSummary`, CC BTVN = graded/total item, chất lượng = `scoreSummary.percentage` | — (HSK cũ chưa từng có chuyên cần ở màn này) |

Phản hồi không đúng hình dạng `PageResponse` (mảng trần, HTML của proxy) ⇒ **lỗi hợp đồng** hiển thị rõ, không coi là rỗng (`assertPageResponse`). Yêu cầu còn lại với backend chung:
bổ sung các trường thiếu ở cột cuối (hoặc một endpoint thống kê lớp), và phân trang/lọc phía server cho danh sách lớn (frontend hiện duyệt trang `size=100`, tối đa 20 trang = 2.000 lớp/học viên, quá thì đánh dấu `truncated`).

---

Phần dưới đây là hợp đồng ĐỀ XUẤT gốc (trước M5), giữ để đối chiếu với máy chủ giả lập; chỗ nào khác mục 0 thì mục 0 thắng.

Trạng thái (cũ): **WAITING FOR BACKEND**. Frontend đã hoàn thiện giao diện và lớp gọi API; chưa có endpoint tương thích
trong backend chung (`LMS_IELTS/backend`). Tài liệu này dành cho người phụ trách backend. Frontend **không** tự
sửa backend và **không** dùng dữ liệu giả thay thế (khi API lỗi/chưa có, giao diện hiện trạng thái lỗi/chưa tích hợp).

## 1. Đối chiếu với backend chung (đọc code, chưa chạy)

| Nguồn | Endpoint | Kết luận |
|---|---|---|
| HSK cũ | `GET /api/quiz/grading/admin/classes` (`repo-lms-quiz`, `GradingController` `@GetMapping("/admin/classes")`) | Hợp đồng gốc màn hình này đang dùng |
| IELTS | `GET /classes` (`repo-lms`, `ClassController.listClasses`) | **INCOMPATIBLE**: phân trang (`page`,`size`), trả `ClassSummaryResponse` gồm `id, code, name, courseId, courseName, classType, track, startDate, lifecycleStatus, expectedSize, teacherId, teacher, schedulePatterns, educationLevel*`. **Không có** `studentCount`, `endDate`, `actualEndDate`, `duration`, `startTime`, `scheduleDays`, `ungradedCount`, `totalSessions`, `assistantName`. Tên giống nhau nhưng dữ liệu và nghiệp vụ khác. |

Không được coi `GET /classes` là tương đương chỉ vì cùng tên.

## 2. Endpoint đề nghị

- **Method/Path (đề nghị, do backend quyết định đường dẫn cuối):** `GET {NEXT_PUBLIC_QUIZ_API_BASE_PATH}/grading/admin/classes`
  (hàm `listAdminGradingClasses` trong `src/lib/api/quiz-grading-client.ts`; base path của service là biến `NEXT_PUBLIC_QUIZ_API_BASE_PATH`, đề nghị `/api/quiz` để URL đầy đủ là `/api/quiz/grading/admin/classes` như gateway HSK cũ).
- **Xác thực:** cookie phiên Auth chung (`credentials: "include"`) hoặc `Authorization: Bearer` — backend chấp nhận
  cả hai (`BearerTokenAuthenticationFilter`). Frontend M1 chưa gắn Bearer (xem `docs/AUTH-INTEGRATION.md`).
- **Phân quyền:** chỉ `ROLE_ADMIN`. Backend **phải** kiểm tra; chặn ở frontend không thay thế. Trả `403` nếu thiếu quyền,
  `401` nếu chưa đăng nhập.
- **Request:** không có tham số. (Frontend lọc và phân trang phía client, 10 dòng/trang. Nếu số lớp lớn, đề nghị bổ sung
  phân trang/lọc phía server — cần thống nhất để frontend đổi.)
- **Response 200:** envelope chuẩn `{ "success": true, "data": [ GradingClassResponse, ... ] }` (frontend cũng chấp nhận
  mảng trần). `data` **phải là mảng**; phản hồi khác mảng bị coi là lỗi hợp đồng (bản cũ im lặng coi là rỗng).

```ts
interface GradingClassResponse {
  classId: string;            // bắt buộc, duy nhất
  classCode?: string;         // mã lớp (hiển thị, tìm kiếm)
  className?: string;
  courseId?: string;
  courseName?: string;        // hiển thị, tìm kiếm
  teacherName?: string;       // hiển thị, tìm kiếm
  teacherEmail?: string;
  assistantName?: string;
  scheduleDays?: string;      // vd "T2, T4, T6"
  startTime?: string;         // "HH:mm"
  duration?: number | string; // phút; tính "ca học" = startTime + duration
  startDate?: string;         // ISO date; tính trạng thái
  endDate?: string;           // ngày kết thúc dự kiến
  actualEndDate?: string;     // có giá trị => "Đã kết thúc"
  studentCount?: number;
  totalSessions?: number;
  ungradedCount?: number;
  hasPendingGrading?: boolean;
  classStatus?: string;
}
```

## 3. Nghiệp vụ giao diện phụ thuộc

- Trạng thái lớp được **frontend tính** từ `startDate/endDate/actualEndDate` và ngày hiện tại
  (`computeStatus`): có `actualEndDate` → "Đã kết thúc"; `startDate` trong tương lai → "Sắp khai giảng";
  `endDate` đã qua → "Đã kết thúc"; còn lại "Đang học". `classStatus` hiện **chưa** được màn hình dùng.
- Số ngày trễ = `actualEndDate - endDate` (ngày).
- Các cột "Trợ giảng", "Lương GV/h", "Số giờ học", "Số buổi khoá", "Buổi GV điểm danh", "Buổi còn lại", "Chuyên cần",
  "CC BTVN", "Điểm QC", "Link QC" hiện luôn hiển thị "—" trong giao diện cũ (chưa có dữ liệu). Giữ nguyên. **UNKNOWN**:
  chưa rõ có định bổ sung dữ liệu cho các cột này hay không (cần chủ dự án quyết định). Nút "Xuất Excel" trong bản cũ **không có hành vi** (không onClick).

## 4. Mã lỗi/trường hợp lỗi frontend xử lý

| Tình huống | Hiển thị |
|---|---|
| Chưa cấu hình `NEXT_PUBLIC_QUIZ_API_BASE_PATH` | "Chưa kết nối dữ liệu" + `WAITING FOR BACKEND` |
| 401 | Lỗi "Phiên đăng nhập đã hết hạn…" (chưa tự refresh — M2) |
| 403 | "Bạn không có quyền thực hiện thao tác này." |
| 4xx/5xx khác | Thông báo ngắn từ `errorMessage`/`message`/`error` nếu là văn bản ≤300 ký tự và không phải HTML, nếu không dùng thông báo chuẩn theo mã HTTP |
| Mất kết nối | "Không thể kết nối đến máy chủ…" + nút Thử lại |
| `data` không phải mảng | "Dữ liệu trả về không đúng định dạng danh sách lớp." |

## 5. Liên quan (chưa chuyển ở M1, cùng nhóm)

`GET /quiz/grading/admin/classes/{classId}/students` (trang `/admin/class-management/students`) — sẽ có tài liệu riêng
khi chuyển màn hình đó.
