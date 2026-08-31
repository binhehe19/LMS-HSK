# Yêu cầu API cho backend — màn `/instructor/list-class/learning-analysis` và `/instructor/list-class/learning-analysis/detail` (Phân tích học tập)

Trạng thái: **WAITING FOR BACKEND**. Frontend (M5 / W1-B) đã hoàn thiện giao diện, hook và lớp gọi API; **chưa có endpoint tương thích trong backend chung** (`LMS_IELTS/backend`). Mọi endpoint dưới đây đi qua base `NEXT_PUBLIC_QUIZ_API_BASE_PATH` (`src/lib/api/quiz-grading-client.ts`, `src/lib/api/learning-analysis-client.ts`); biến trống ⇒ từng khối của màn hiện "WAITING FOR BACKEND", không có dữ liệu giả thay thế. Máy chủ giả lập mô phỏng hợp đồng này: `scripts/mock/handlers/quiz-grading.mjs` (phần đã có) + `scripts/mock/handlers/learning-analysis.mjs` (phần mới).

Màn **danh sách** chỉ ĐỌC. Màn **chi tiết** gồm 5 nguồn đọc và **3 thao tác GHI** (gửi nhận xét, tạo snapshot AI, duyệt báo cáo AI) — ghi bị khoá bởi công tắc `NEXT_PUBLIC_WRITE_TEACHER_NOTE=enabled` (`src/lib/api/write-gate.ts`, feature `teacher-note`) cho tới khi backend xác nhận hợp đồng; khi khoá, giao diện hiện "chưa tích hợp" và **không tạo request ghi**.

## 1. Đối chiếu HSK cũ (đọc code, chưa chạy)

| Chức năng | HSK cũ (frontend → backend) | Vấn đề đã ghi nhận | Kết luận |
|---|---|---|---|
| Học viên của buổi | `GET {quiz}/grading/schedules/{scheduleId}/students[?classId]` | `classId` tuỳ chọn; enrich điểm N+1 ở client | Dùng lại `listScheduleStudents` (đã có, `classId` bắt buộc — `docs/api-requirements/instructor-list-lesson.md`, B0 mục 6.2) |
| Bài tập của buổi | `getLessonDetail` (onl-learning modules + quiz theo study set) ⨝ `GET {quiz}/grading/schedules/{s}/students/{u}/attempts` | 3 lời gọi + N+1; attempts lỗi bị coi là "chưa nộp" | Frontend ghép từ `GET …/schedules/{s}/lesson-detail?classId=&title=` (đề xuất gộp, đã có) + attempts; **lỗi bất kỳ ⇒ trạng thái lỗi** |
| Điểm theo kỹ năng | Tính ở client từ `GET …/students` | — | Giữ cách tính ở client (`skillScores`), không cần endpoint mới |
| Chuyên cần | `GET {onl}/grading-classes/{classId}/schedules/{scheduleId}/students/{studentEmail}/attendance-analysis` | **U2/G3**: email học viên trên đường dẫn, không kiểm tra sở hữu (IDOR) — `docs/B0-P0-SECURITY-REVIEW.md` | Đổi khoá sang **`userId`** (B0 M12); frontend **không gửi `studentEmail`** |
| Nhận xét gần nhất | `GET {onl}/…/students/{studentUserId}/notes/latest` | **U3/G5**: không kiểm tra quyền | Giữ đường dẫn, thêm kiểm tra M3–M6 |
| Gửi nhận xét | `POST {onl}/…/students/{studentUserId}/notes` body `{content, studentEmail}` | **U1/G4**: không kiểm tra giảng viên∈lớp/học viên∈lớp; phát thông báo cho userId bất kỳ | Body chỉ còn `{content}`; backend tự tra email học viên nếu cần thông báo |
| Gợi ý AI | `GET {quiz}/grading/schedules/{s}/students/{u}/personalization?classId=`; `POST …/personalization/snapshot?classId=&forceNewVersion=`; `POST …/personalization/reports/{reportId}/approve?classId=` | G8: quyền chưa rõ; AI chỉ tư vấn, giáo viên duyệt cuối | Giữ đường dẫn; `classId` bắt buộc (M5); kiểm tra M3–M8 |

Backend chung IELTS **không có** endpoint tương đương nào cho sáu chức năng trên (ADMIN-only `ClassController`, không có điểm danh theo học viên cho giảng viên, không có personalization).

## 2. Danh tính và quyền (bắt buộc, theo `docs/B0-IDENTITY-AUTHORIZATION-CONTRACT.md`)

1. Giảng viên = principal đã xác thực (M1); không nhận email/`teacherId` từ client.
2. Mọi endpoint kiểm tra ở server: giảng viên được phân công `classId` (M3), `scheduleId ∈ classId` (M4, `syllabusScheduleId` dùng chung giữa các lớp nên **không đủ**), `userId ∈ roster(classId)` (M6). Vi phạm ⇒ `403` (hoặc `404`, D6); lớp/buổi/học viên không tồn tại ⇒ `404`. **Không `200` rỗng** để che từ chối (M9).
3. Học viên định danh bằng **`userId`** (Auth) ở mọi đường dẫn (M12). `studentEmail` trong URL của frontend chỉ còn để tương thích liên kết cũ và **không được gửi lên API**.
4. Thao tác ghi kiểm tra quyền **tại thời điểm ghi**, ghi audit (M7); gửi nhận xét có phát thông báo ⇒ cần chống gửi trùng (M8; xem câu hỏi mục 6).
5. MENTOR có được **ghi** (gửi nhận xét, tạo/duyệt AI) hay chỉ đọc — quyết định D4. Frontend hiện cho cả TEACHER và MENTOR vào màn (PrivateRoute HSK cũ) nhưng nút ghi chỉ mở khi công tắc `teacher-note` bật.

## 3. Endpoint đề nghị

Xác thực chung: cookie phiên Auth hoặc `Authorization: Bearer` (`credentials: include`; 401 ⇒ refresh một lần). Mọi đoạn đường dẫn được frontend `encodeURIComponent`. Phản hồi bọc `{ success, data }` (frontend cũng nhận thân trần). Mã lỗi: 401/403/404 như mục 2; 400 body sai; 409 xung đột trạng thái.

### 3.1 Đọc

| # | Endpoint | Hàm client | Response `data` |
|---|---|---|---|
| R1 | `GET /grading/schedules/{scheduleId}/students?classId=` | `listScheduleStudents` (đã có) | `GradingStudentResponse[]` (cần `userId, fullName/name, email, studentCode, avatarUrl?, modules[]{quizId, skillType, submitted, score, maxScore}`) |
| R2 | `GET /grading/schedules/{scheduleId}/lesson-detail?classId=&title=` | `getLessonDetail` (đã có) | `LessonDetailResponse` — mỗi `exercises[]` cần `quizId` để đối chiếu |
| R3 | `GET /grading/schedules/{scheduleId}/students/{userId}/attempts?classId=` | `listStudentAttempts` (đã có) | `GradingAttemptSummaryResponse[]` (`quizId, finalScore, autoScore, totalPoints, gradingStatus`) |
| R4 | `GET /grading/classes/{classId}/schedules/{scheduleId}/students/{userId}/attendance-analysis` | `getAttendanceAnalysis` | `AttendanceAnalysisResponse` (dưới) |
| R5 | `GET /grading/classes/{classId}/schedules/{scheduleId}/students/{userId}/notes/latest` | `getLatestTeacherNote` | `TeacherNoteResponse` hoặc `data: null` khi chưa có |
| R6 | `GET /grading/schedules/{scheduleId}/students/{userId}/personalization?classId=` | `getPersonalization` | `PersonalizationView` (dưới) |

```ts
AttendanceAnalysisResponse {
  trend: { sessionNo: number; sessionLabel: string; studentRate: number | null; classAverageRate: number | null }[]; // luỹ kế 0..100 từ buổi 1 tới buổi đang xem; null = chưa có dữ liệu (khác 0%)
  log:   { sessionLabel: string; date?: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; note?: string }[]; // một dòng mỗi buổi đã diễn ra
}
TeacherNoteResponse { content: string; sentAt?: string; author?: string }
PersonalizationView {
  available: boolean;                       // false => "Tạm thời không tải được nhận xét AI"
  dataSufficiency: "SUFFICIENT" | "INSUFFICIENT" | "INSUFFICIENT_DATA" | "UNKNOWN";
  dataSufficiencyMessage?: string | null;
  report: { id; state: "DRAFT" | "APPROVED" | string; generatedAt?; approvedAt?; summary?: string | null; snapshotWeakAreas?: { label; mastery? }[] } | null;
  historicalSnapshot: { id; version; generatedAt?; dataSufficiency?: { insufficient_data?; useful_answers?; distinct_supported_kcs? }; weakAreas: { label; mastery? }[] } | null;
  recommendations: { label?; reason?; status? }[];
  tasks: PersonalizationTask[];             // bài củng cố đã giao, gắn snapshot của buổi (sourceSnapshotId / sourceLmsScheduleId, materialUrl?sessionCode=…)
  currentTasks?: PersonalizationTask[];     // dự phòng khi `tasks` rỗng: frontend lọc theo scheduleId/snapshotId
}
```

DTO đầy đủ: `src/types/learning-analysis.ts`. Các trường khác của phản hồi HSK cũ (`weakAreas` gốc, `currentLearningState`, `historicalSnapshotMessage`, `lmsClassId`…) frontend bỏ qua.

### 3.2 Ghi (công tắc `teacher-note`)

| # | Endpoint | Hàm client | Body | Response `data` | Lỗi |
|---|---|---|---|---|---|
| W1 | `POST /grading/classes/{classId}/schedules/{scheduleId}/students/{userId}/notes` | `sendTeacherNote` | `{ content: string }` (1–2000 ký tự, đã trim) | `TeacherNoteResponse` | 400 body sai |
| W2 | `POST /grading/schedules/{scheduleId}/students/{userId}/personalization/snapshot?classId=&forceNewVersion=true\|false` | `generatePersonalizationSnapshot` | — | `{ result: "CREATED" \| "EXISTING"; snapshot: { id; version } }` — frontend **từ chối** phản hồi không có `result` hợp lệ + `snapshot.id` (không báo "đã tạo" khi không chắc) | 409 nếu đang có job chạy (gợi ý) |
| W3 | `POST /grading/schedules/{scheduleId}/students/{userId}/personalization/reports/{reportId}/approve?classId=` | `approvePersonalizationReport` | — | `{ reportId; state: "APPROVED"; approvedAt? }` | 404 báo cáo lạ; 409 đã duyệt / chưa đủ dữ liệu |

Sau mỗi thao tác ghi thành công frontend **tải lại** nguồn tương ứng (R5 hoặc R6) — backend phải trả dữ liệu mới ngay sau khi ghi (không eventual consistency dài).

## 4. Tham số URL và hành vi frontend

- Danh sách: `?classId=&courseId=&scheduleId=&title=`; chi tiết: thêm `&userId=&studentEmail=&studentName=` (giữ nguyên hợp đồng HSK cũ). `classId`, `scheduleId`, `userId` được kiểm tra an toàn (≤ 128 ký tự, không `/ \ ? # %`/ký tự điều khiển) **trước** khi gọi API; thiếu/không hợp lệ ⇒ thông báo, **không gọi API**. `courseId`, `title`, `studentName` chỉ chuyển tiếp/hiển thị; `studentEmail` không dùng.
- Mỗi nguồn của màn chi tiết có trạng thái riêng: loading / ok / rỗng / error (Thử lại) / waiting. Bản cũ gom `Promise.all` và **bỏ qua im lặng** lỗi chuyên cần, kỹ năng, AI — ở đây từng khối báo rõ.
- Thẻ biểu đồ chuyên cần và điểm kỹ năng **ẩn khi dữ liệu rỗng thật** (giữ quyết định "không dựng card rỗng" của bản cũ), chỉ hiện khi đang tải hoặc lỗi. Biểu đồ kỹ năng được **render** (bản cũ tính nhưng không hiển thị).
- `data` của R1/R3 phải là mảng, R2 phải có `modules[]`, R4 phải là object: khác ⇒ lỗi hợp đồng "Dữ liệu trả về không đúng định dạng …".

## 5. Mock (scripts/mock/handlers/learning-analysis.mjs)

- Chuyên cần sinh xác định từ `(userId, sessionNo)`: ~75% có mặt, 10% đi muộn, 10% vắng, 5% nghỉ có phép; chỉ tính buổi đã diễn ra tới buổi đang xem; trung bình lớp tính từ cùng roster.
- Nhận xét dùng kho chấm bài (`sendNote/latestNote`, khoá theo `sessionId` nên `scheduleId` dạng `syllabusScheduleId` hay `sessionId` đều cùng một bản ghi).
- Gợi ý AI suy từ bài làm đã nộp của học viên trong buổi (kỹ năng < 70% ⇒ "điểm cần chú ý"; < 4 câu trả lời ⇒ INSUFFICIENT, không duyệt được — 409). Học viên ở vị trí chẵn trong roster lớp và đủ dữ liệu có snapshot DRAFT sẵn (demo thấy nút Duyệt), các học viên còn lại chưa có (nút Tạo). Duyệt ⇒ sinh bài củng cố ASSIGNED có `materialUrl?sessionCode=`; `forceNewVersion=true` tạo phiên bản mới (DRAFT, bài tập cũ bị thay).
- 401 chưa đăng nhập; 403 sai role / lớp không thuộc giảng viên / buổi không thuộc lớp; 404 buổi hoặc học viên lạ; 400 thiếu `classId` hoặc body sai; 409 duyệt lại / chưa đủ dữ liệu. Tôn trọng `state.controls.api` (`ok|error|slow`). `/mock-reset` xoá kho gợi ý AI.

## 6. Điểm backend cần xác nhận trước khi tích hợp

1. Nguồn điểm danh theo `userId` (CMS HSK cũ khoá theo email — B0 "KHÔNG XÁC MINH ĐƯỢC"); định dạng `date`; cách tính `classAverageRate` (roster tại thời điểm buổi hay hiện tại).
2. Gửi nhận xét: có phát thông báo cho học viên không, kênh nào, có cần `idempotencyKey` (M8); giới hạn độ dài; có cho sửa/xoá nhận xét đã gửi (frontend hiện chỉ "nhận xét gần nhất").
3. Personalization: ai được tạo/duyệt (D4 cho MENTOR), giới hạn tần suất/chi phí gọi AI, hành vi `forceNewVersion`, trạng thái báo cáo ngoài DRAFT/APPROVED, cách gắn `tasks` với buổi (`sourceLmsScheduleId` là `scheduleId` nào khi lớp dùng chung giáo trình).
4. Có gộp R2 + R3 thành một endpoint "bài tập của học viên trong buổi" để bỏ việc ghép ở client không (B0 G10: backend là nơi tính).
5. Mã trả về khi lớp không thuộc giảng viên: 403 hay 404 (D6).
