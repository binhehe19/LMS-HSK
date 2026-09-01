# Yêu cầu API cho backend — màn hình `/instructor/list-class` (Quản lý lớp học của Giảng viên)

Trạng thái: **WAITING FOR BACKEND**. Frontend (M4A) đã hoàn thiện giao diện và lớp gọi API; **chưa có endpoint tương thích trong backend chung** (`LMS_IELTS/backend`). Tài liệu dành cho người phụ trách backend.
Frontend **không** sửa backend và **không** dùng dữ liệu giả thay thế (khi API chưa có/lỗi, giao diện hiện trạng thái "WAITING FOR BACKEND"/lỗi, không bao giờ hiện danh sách giả). Màn này **chỉ đọc**: không có thao tác ghi.

## 1. Đối chiếu (đọc code, chưa chạy)

| Nguồn | Endpoint | Kết luận |
|---|---|---|
| HSK cũ — frontend | `quizService.getGradingClasses` → `GET {quiz}/grading/classes` | Hợp đồng gốc của màn này |
| HSK cũ — `repo-lms-quiz` | `GradingController` `@GetMapping("/classes")` → `GradingServiceImpl.getClasses()` | Lấy lớp của **người đang đăng nhập** từ `onl-learning`, đặt `hasPendingGrading` cho từng lớp (gọi `hasClassPendingGrading(classId)` riêng cho từng lớp; lỗi một lớp ⇒ coi là `false`), **sắp lớp còn bài chờ chấm lên trước** |
| HSK cũ — `repo-lms-onl-learning` | `GET /grading-classes/me` → `GradingClassServiceImpl.getMyClasses(email)` | Xác định giảng viên **theo email của principal** (`authentication.getName()`): bảng timetable lớp với `participantRole = TUTOR`; nếu rỗng thì rơi về CMS (`getTeacherClasses`) và bù `courseName/teacherName` từ CMS |
| Backend chung IELTS | `GET /classes` (`repo-lms`, `ClassController`) | **INCOMPATIBLE**: `@PreAuthorize ROLE_ADMIN` cho cả controller (giảng viên không gọi được), phân trang, `ClassSummaryResponse` thiếu `studentCount/endDate/actualEndDate/hasPendingGrading/...`. **Không có** endpoint "lớp của tôi" cho giảng viên. Tên giống nhau nhưng khác nghiệp vụ |

Không được coi `GET /classes` là tương đương.

## 2. Endpoint đề nghị

- `GET {NEXT_PUBLIC_QUIZ_API_BASE_PATH}/grading/classes` (hàm `listTeacherGradingClasses` trong `src/lib/api/quiz-grading-client.ts`; đề nghị base `/api/quiz` như gateway cũ). Đường dẫn cuối do backend quyết định.
- Xác thực: cookie phiên Auth chung hoặc `Authorization: Bearer` (`credentials: include`, 401 ⇒ refresh một lần).
- **Phân quyền**: `ROLE_TEACHER`, `ROLE_MENTOR` (khớp PrivateRoute HSK cũ). Backend phải kiểm tra; trả `401`/`403` đúng. Frontend chặn ở route nhưng **không thay thế** quyền ở backend. Lưu ý: HSK cũ xác định giảng viên theo **email** của principal. **Không mặc định sao chép cách đó**: backend chung phải xác định giảng viên từ principal đã xác thực, tự ánh xạ sang dữ liệu lớp và kiểm tra quyền ở server; frontend không gửi email/định danh nào để xác định lớp (xem `docs/BACKEND-AUTH-HANDOVER.md` mục 2, B0).
- Request: không có tham số (frontend lọc/sắp xếp/phân trang phía client, 10 dòng/trang). Nếu số lớp rất lớn, cần thống nhất phân trang/lọc phía server.
- Response 200: `{ "success": true, "data": [ GradingClassResponse, ... ] }` (frontend cũng nhận mảng trần). `data` **phải là mảng**; khác mảng bị coi là lỗi hợp đồng (bản cũ im lặng coi là rỗng).

```ts
GradingClassResponse {
  classId: string;            // bắt buộc, duy nhất (khoá dòng; dùng trong liên kết sang list-lesson)
  classCode?: string;         // hiển thị mã lớp (liên kết), tên nhãn trong bộ lọc "Mã lớp"
  className?: string;         // tên hiển thị trong bộ lọc; thiếu thì dùng classCode, rồi classId
  courseId?: string;          // khoá lọc dự phòng khi thiếu courseName; đi kèm query khi bấm mã lớp
  courseName?: string;        // cột "Khóa học" + bộ lọc "Khóa học" (gộp theo tên, không phân biệt hoa/thường)
  teacherName?: string;       // cột "Giáo viên" (huy hiệu chữ cái đầu)
  teacherEmail?: string;
  startDate?: string;         // chuỗi hiển thị NGUYÊN VĂN; bộ lọc thời gian đọc "yyyy-MM-dd[Thh:mm]" hoặc "dd/MM/yyyy" (cũng "dd-MM-yyyy", "dd.MM.yyyy")
  endDate?: string;           // "Ngày kết thúc dự kiến"
  actualEndDate?: string;     // nếu có thì bộ lọc thời gian dùng ngày này làm ngày kết thúc
  studentCount?: number;
  hasPendingGrading?: boolean; // chấm đỏ "Bài chưa chấm"; lớp true được đưa lên đầu (backend cũ đã sắp sẵn, frontend sắp lại ổn định)
  // còn các trường khác của DTO cũ (scheduleDays, startTime, duration, classStatus, totalSessions, assistantName, ungradedCount): màn này KHÔNG dùng
}
```

## 3. Nghiệp vụ giao diện phụ thuộc

- Bộ lọc **Khóa học** / **Mã lớp** / **Thời gian** (Mọi thời gian, Ngày chính xác, Hôm nay, Ngày mai, Hôm qua, Trong 7 ngày qua, Trong 7 ngày tới) chạy **trên toàn bộ danh sách ở client**, theo giờ địa phương của trình duyệt. Một lớp khớp thời gian khi khoảng [bắt đầu, kết thúc (thực tế nếu có, nếu không dự kiến)] giao với cửa sổ chọn; lớp không có ngày nào dùng được ⇒ không khớp.
- `startDate`/`endDate` được **hiển thị nguyên văn** (không định dạng lại), nên định dạng backend trả ra chính là định dạng người dùng thấy (HSK cũ: `dd/MM/yyyy`).
- Bấm mã lớp ⇒ `/instructor/list-class/list-lesson?classId=<id>&courseId=<id>` (màn đó **chưa chuyển**: hiện trang "Chức năng đang được chuyển đổi").
- Chấm đỏ "Bài chưa chấm" dựa vào `hasPendingGrading`; backend cũ tính bằng một lời gọi riêng cho từng lớp (N+1) — nếu backend mới tính gộp cho nhanh hơn, hợp đồng không đổi.

## 4. Hành vi lỗi ở frontend (đã kiểm thử với mock)

| Tình huống | Hiển thị |
|---|---|
| Chưa cấu hình `NEXT_PUBLIC_QUIZ_API_BASE_PATH` | Dòng cảnh báo trong bảng: "Danh sách lớp chưa được kết nối API (WAITING FOR BACKEND)…"; không toast; không gọi mạng |
| Lỗi 4xx/5xx/mạng | Toast (như bản cũ) + dòng cảnh báo có "Thử lại"; **không** hiện "Chưa có lớp được phân công" |
| `data` không phải mảng | "Dữ liệu trả về không đúng định dạng danh sách lớp." |
| `data` rỗng | "Chưa có lớp được phân công" (trạng thái rỗng thật của bản cũ) |
| Có lớp nhưng bộ lọc không khớp | "Không có lớp phù hợp bộ lọc" |

## 5. Liên quan (chưa chuyển, cùng nhóm — cần tài liệu riêng khi chuyển)

`GET /grading/classes/{classId}/schedules` (list-lesson), `/grading/schedules/{id}/students`, `/grading/schedules/{id}/students/{userId}/attempts`, các thao tác **ghi** của chấm bài (`gradeAnswer`, `gradeQuestion`, `finalize`, `send`, `sendScheduleStudentResults`) — thuộc lesson-detail, submissions, grading-workspace: **không nằm trong M4A**.
