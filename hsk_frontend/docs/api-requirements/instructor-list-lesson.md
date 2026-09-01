# Yêu cầu API cho backend — màn hình `/instructor/list-class/list-lesson` (Danh sách bài học của một lớp)

Trạng thái: **WAITING FOR BACKEND**. Frontend (M4B) đã hoàn thiện giao diện và lớp gọi API; **chưa có endpoint tương thích trong backend chung** (`LMS_IELTS/backend`). Tài liệu dành cho người phụ trách backend.
Frontend **không** sửa backend và **không** dùng dữ liệu giả thay thế (API chưa có/lỗi => giao diện hiện trạng thái "WAITING FOR BACKEND"/lỗi, không bao giờ hiện danh sách giả). Màn này **chỉ đọc**: không có thao tác ghi; ba nút ở mỗi dòng chỉ điều hướng.

## 1. Đối chiếu (đọc code, chưa chạy)

| Nguồn | Endpoint | Kết luận |
|---|---|---|
| HSK cũ — frontend | `quizService.getGradingClassSchedules(classId)` → `GET {quiz}/grading/classes/{classId}/schedules` | Hợp đồng gốc của màn này |
| HSK cũ — `repo-lms-quiz` | `GradingController` `@GetMapping("/classes/{classId}/schedules")` → `GradingServiceImpl.getClassSchedules(classId)` | Lấy danh sách buổi từ `onl-learning` (`GET /grading-classes/{classId}/sessions`, **chuyển tiếp danh tính người dùng** `forwardUserAuth = true`), rồi **tính `hasPendingGrading` gộp một lần** cho cả lớp (roster theo email → tra hồ sơ identity → các lượt làm chính thức `SUBMITTED` theo `syllabusScheduleId`) và **sắp buổi còn bài chờ chấm lên trước**. Bản thân controller của quiz **không** kiểm tra quyền sở hữu lớp |
| HSK cũ — `repo-lms-onl-learning` | `GradingClassServiceImpl.getClassSessions(teacherEmail, classId)` | **Quyền truy cập lớp được kiểm tra Ở ĐÂY, theo EMAIL** của người gọi: `hasSnapshotClassAccess` (timetable, vai trò TUTOR) hoặc `assertCmsClassAccess` (CMS); không có quyền ⇒ lỗi. Dữ liệu buổi bù thêm từ CMS/`SyllabusScheduleEnrichView` |
| Backend chung IELTS | `GET /classes/{classId}/sessions` (`repo-lms`, `ClassController`) | **INCOMPATIBLE**: cả controller là `@PreAuthorize ROLE_ADMIN` (giảng viên không gọi được); DTO `ClassSessionResponse` = `id, sessionNo, startAt, endAt, teacherId, teacher, room, meetingLink, status, percentCompleted, note, evaluationStars, evaluationNote` — **không có** `title`, `topic`, `syllabusScheduleId`, `hasAssignment`, `hasPendingGrading`, và không có kiểm tra quyền sở hữu theo giảng viên. Tên giống nhau nhưng khác nghiệp vụ |

Không được coi `GET /classes/{classId}/sessions` là tương đương.

## 2. Danh tính giảng viên và quyền truy cập lớp (QUAN TRỌNG)

HSK cũ xác định giảng viên **bằng email** và kiểm tra quyền sở hữu lớp ở dịch vụ downstream. **Không sao chép nguyên cách đó sang backend chung.** Đề nghị:

1. Xác định giảng viên từ **principal đã xác thực** (id người dùng trong token/`GET /users/me`), không nhận email, `teacherId` hay bất kỳ định danh nào từ client/query.
2. **Kiểm tra quyền sở hữu/truy cập lớp ở phía server** cho từng `classId`: chỉ trả buổi học nếu giảng viên (Teacher/Mentor) thuộc lớp đó; nếu không, `403` (hoặc `404` để không lộ sự tồn tại của lớp) — không trả `200` rỗng.
3. Ánh xạ giữa định danh của Auth chung và dữ liệu lớp học (timetable/CMS dùng email ở HSK cũ) phải do backend xác minh và ghi rõ; frontend không suy ra.
4. Frontend **không** coi guard route là quyền: nó chặn Admin/Teacher-manager/Collaborator ở giao diện nhưng mọi quyết định thật nằm ở backend.

## 3. Endpoint đề nghị

- `GET {NEXT_PUBLIC_QUIZ_API_BASE_PATH}/grading/classes/{classId}/schedules` (hàm `listClassSchedules` trong `src/lib/api/quiz-grading-client.ts`; `classId` được **mã hoá** `encodeURIComponent` — bản cũ nối thẳng, dễ chèn `/`, `..`). Đường dẫn cuối do backend quyết định.
- Xác thực: cookie phiên Auth chung hoặc `Authorization: Bearer` (`credentials: include`, 401 ⇒ refresh một lần).
- Quyền: `ROLE_TEACHER`, `ROLE_MENTOR` **và** sở hữu lớp (mục 2). `401`/`403` đúng.
- Request: không có tham số truy vấn. Frontend tìm kiếm, sắp xếp, phân trang **phía client** (10 dòng/trang).
- Response 200: `{ "success": true, "data": [ GradingScheduleResponse, ... ] }` (cũng nhận mảng trần). `data` **phải là mảng**; khác mảng bị coi là lỗi hợp đồng (bản cũ im lặng coi là rỗng).

```ts
GradingScheduleResponse {
  sessionId: string;            // bắt buộc, duy nhất trong lớp; khoá dòng
  sessionNo?: number;           // số buổi: sắp xếp tăng dần (thiếu => cuối) + tiền tố "Buổi N:"
  title?: string;               // tên bài học; đã bắt đầu bằng "buổi" (không phân biệt hoa/thường) thì không thêm tiền tố
  topic?: string;               // chủ đề, hiển thị sau ": "; cũng được tìm kiếm
  syllabusScheduleId?: string;  // khoá buổi theo giáo trình => scheduleId trong query của lesson-detail/submissions/learning-analysis (thiếu thì dùng sessionId)
  hasAssignment?: boolean;      // true => tiêu đề đỏ sẫm (#800020), ngược lại xanh nhạt (#71A6D2)
  hasPendingGrading?: boolean;  // true => chấm đỏ ở nút "Danh sách nộp bài"
  // date, sessionDate, startTime, endTime, ungradedCount: có trong DTO cũ nhưng màn này KHÔNG dùng
}
```

## 4. Quan hệ `classId`, `courseId`, buổi học

- `classId` (từ URL) quyết định lớp và **là tham số duy nhất gọi API**. Không dùng `courseId` để gọi API ở màn này.
- `courseId` (từ URL) chỉ được **chuyển tiếp** vào liên kết sang các màn kế tiếp. Thiếu `courseId` vẫn gọi API bình thường; liên kết mang `courseId=` rỗng như bản cũ.
- Không có `lessonId` trong màn này: dòng được định danh bằng `sessionId`; màn kế tiếp nhận `scheduleId = syllabusScheduleId || sessionId` và `title`.
- Query sang màn kế tiếp (contract cũ, giữ nguyên): `?classId=&courseId=&scheduleId=&title=` tới `/instructor/list-class/{lesson-detail | submissions | learning-analysis}` — các màn này **chưa chuyển** (hiện trang "đang chuyển đổi").

## 5. Hành vi frontend khi tham số/phản hồi bất thường (đã kiểm thử với mock)

| Tình huống | Hiển thị |
|---|---|
| `classId` thiếu / chỉ khoảng trắng | Thông báo "Thiếu mã lớp…" trong bảng; **không gọi API**, không toast |
| `classId` không hợp lệ (có `/ \ ? # %`, ký tự điều khiển, `.`/`..`, > 128 ký tự) | Thông báo "Mã lớp không hợp lệ…"; **không gọi API** |
| `?page` không phải số nguyên ≥ 1 | Hiện trang 1; `?page` quá lớn ⇒ hiện trang cuối |
| Chưa cấu hình `NEXT_PUBLIC_QUIZ_API_BASE_PATH` | "WAITING FOR BACKEND"; không toast; không gọi mạng |
| 401/403/4xx/5xx/mạng | Toast (như bản cũ) + khối lỗi có "Thử lại"; **không** hiện "Chưa có bài học" |
| `data` không phải mảng | "Dữ liệu trả về không đúng định dạng danh sách bài học." |
| `data` rỗng | "Chưa có bài học" (trạng thái rỗng thật) |

## 6. Điểm backend cần xác nhận trước khi tích hợp

1. Endpoint thật, base path, và việc dùng chung `repo-lms-quiz` hay dịch vụ khác.
2. Cách ánh xạ danh tính giảng viên ↔ lớp (mục 2); mã/trạng thái khi lớp không thuộc giảng viên (403 hay 404).
3. Nguồn dữ liệu `title`, `topic`, `hasAssignment`, `syllabusScheduleId` (HSK cũ lấy từ timetable/CMS/giáo trình) — backend chung chưa có.
4. Cách tính `hasPendingGrading` (HSK cũ: lượt làm chính thức `SUBMITTED` của học viên thuộc roster lớp; đã từng có lỗi đếm lẫn học viên của lớp khác dùng chung `syllabusScheduleId`).
5. Có cần phân trang phía server cho lớp có rất nhiều buổi? (hiện tải toàn bộ.)
