# Yêu cầu API cho backend — luồng chấm bài của Giảng viên (3 màn)

| Màn | Route (giữ nguyên HSK cũ) | Query | Hàm client (`src/lib/api/quiz-grading-client.ts`) |
|---|---|---|---|
| Danh sách nộp bài | `/instructor/list-class/submissions` | `classId, courseId, scheduleId, title` | `listScheduleStudents` |
| Chấm bài | `/instructor/list-class/grading` | `scheduleId, userId, classId, courseId, title, view=detail, studentName` | `listStudentAttempts`, `getGradingAttempt`; ghi: `gradeAnswer`, `gradeQuestion`, `sendAttempt` |
| Chi tiết bài học | `/instructor/list-class/lesson-detail` | `classId, courseId, scheduleId, title` | `getLessonDetail`; ghi: `saveLessonDetail` |

Trạng thái: **WAITING FOR BACKEND**. Frontend (M5 / W1-A) đã hoàn thiện giao diện, lớp gọi API, máy chủ giả lập (`scripts/mock/handlers/quiz-grading.mjs`) và kiểm thử; **backend chung `LMS_IELTS/backend` chưa có endpoint tương đương** (B0 OPEN — `docs/B0-P0-SECURITY-REVIEW.md` mục 9, `docs/B0-IDENTITY-AUTHORIZATION-CONTRACT.md` mục 6.2). Ở production `NEXT_PUBLIC_QUIZ_API_BASE_PATH` để trống ⇒ ba màn hiện "WAITING FOR BACKEND"; không có dữ liệu giả thay thế. Mọi thao tác GHI còn đi qua công tắc an toàn (`lib/api/write-gate.ts`): `quiz-grading` (chấm/gửi) và `lesson-detail` (lưu chi tiết bài học) — mặc định ĐÓNG, chỉ mở trong chế độ demo hoặc khi người triển khai đặt `NEXT_PUBLIC_WRITE_QUIZ_GRADING=enabled` / `NEXT_PUBLIC_WRITE_LESSON_DETAIL=enabled` **sau khi backend xác nhận hợp đồng này**.

## 1. Đối chiếu (đọc code, chưa chạy)

| Nguồn | Endpoint | Kết luận |
|---|---|---|
| HSK cũ — frontend `quiz.service.ts` | `GET {quiz}/grading/schedules/{scheduleId}/students?classId=` (classId **tuỳ chọn**), `GET .../students/{userId}/attempts`, `GET /grading/attempts/{id}`, `PUT /grading/answers/{answerId}`, `PUT /grading/attempts/{id}/questions/{questionId}`, `PUT /grading/attempts/{id}/finalize`, `POST /grading/attempts/{id}/send`, `POST .../students/{userId}/send` | Hợp đồng gốc của các màn; đường dẫn được kế thừa ở đây (đã mã hoá tham số) |
| HSK cũ — `classGradingApi.getStudents` | Sau khi tải danh sách, gọi thêm **N+1** `GET /grading/attempts/{id}` cho từng bài đã nộp để tính lại `modules[].score`/`totalScore` phía client | **Không chuyển**: backend phải trả điểm đúng sẵn (mục 4.1) |
| HSK cũ — `lesson-detail-page` | Ghép từ 3 lời gọi: `onl-learning GET /schedule-modules?scheduleId` → `quiz GET /quizzes?studySetId` → `quiz GET /quizzes/{id}` cho từng bài; lưu = **"thành công giả"** (không gọi API) | Đề xuất **một endpoint gộp** GET/PUT `lesson-detail` (mục 3) |
| HSK cũ — `repo-lms-quiz` `GradingController` | Không kiểm tra quyền sở hữu lớp ở controller; `classId` tuỳ chọn; trả `200 []` khi bị từ chối ở downstream | Không sao chép (B0 D6, D7b) |
| Backend chung IELTS | `/management/assessment-attempts*` (`repo-lms`) | **INCOMPATIBLE**: `@PreAuthorize ROLE_ADMIN`, mô hình attempt/assessment khác (không có module/quiz theo buổi, không có chấm từng câu, không có `returnedAt`), không có quyền giảng viên theo lớp |

## 2. Danh tính và quyền (áp dụng cho MỌI endpoint dưới đây)

1. Giảng viên/Mentor được xác định từ **principal đã xác thực** (cookie phiên Auth chung hoặc `Authorization: Bearer`; `credentials: include`; 401 ⇒ frontend refresh một lần). Không nhận email/teacherId từ client.
2. Role: `ROLE_TEACHER`, `ROLE_MENTOR` **và** giảng viên thuộc lớp `classId`; buổi `scheduleId` phải thuộc lớp; học viên `userId` phải thuộc roster lớp; bài làm `attemptId` / câu trả lời `answerId` phải thuộc một bài nộp của lớp đó (D7b: bài nộp gắn `class_id`). Vi phạm ⇒ `403` (hoặc `404` thống nhất theo D6), **không bao giờ `200 []`**.
3. `classId` **bắt buộc** ở mọi endpoint theo buổi (query `?classId=`); thiếu ⇒ `400`. Frontend không gọi API khi `classId`/`scheduleId`/`userId` thiếu hoặc không hợp lệ (có `/ \ ? # %`, ký tự điều khiển, `.`/`..`, > 128 ký tự).
4. Ghi: cần khoá lạc quan + audit (B0 C12) và idempotency cho `send` (mục 5); frontend chỉ gửi lại khi người dùng bấm lại.

## 3. Endpoint đề nghị (base `NEXT_PUBLIC_QUIZ_API_BASE_PATH`, envelope `{ success, data, errorCode, errorMessage }` — cũng nhận JSON trần)

| # | Method + path | Dùng ở | Ghi? | Response `data` |
|---|---|---|---|---|
| E1 | `GET /grading/schedules/{scheduleId}/students?classId=` | submissions (và learning-analysis) | — | `GradingStudentResponse[]` — **phải là mảng** |
| E2 | `GET /grading/schedules/{scheduleId}/students/{userId}/attempts?classId=` | grading | — | `GradingAttemptSummaryResponse[]` |
| E3 | `GET /grading/attempts/{attemptId}` | grading (mỗi bài đã nộp; và sau `send` nếu phản hồi không kèm `questions`) | — | `GradingAttemptDetailResponse` |
| E4 | `PUT /grading/answers/{answerId}` body `GradeAnswerRequest` | grading — nút "Lưu" của câu đã có bản ghi trả lời; và tự động trước khi gửi với bản nháp còn khác điểm đã lưu | gate `quiz-grading` | `GradingAttemptDetailResponse` (toàn bộ bài sau khi chấm) |
| E5 | `PUT /grading/attempts/{attemptId}/questions/{questionId}` body `GradeAnswerRequest` | grading — câu học viên bỏ trống (chưa có `answerId`): backend **tự tạo bản ghi trả lời rỗng** rồi chấm | gate `quiz-grading` | `GradingAttemptDetailResponse` (câu đó nay có `answerId`) |
| E6 | `POST /grading/attempts/{attemptId}/send` body `{}` | grading — "Gửi kết quả cho học viên", gọi cho từng bài đủ điểm | gate `quiz-grading` | `GradingAttemptDetailResponse` **kèm `questions[].returnedAt`** (nếu chỉ trả xác nhận, frontend gọi thêm E3) |
| E7 | `PUT /grading/attempts/{attemptId}/finalize` body `FinalizeAttemptRequest` | **không dùng** ở 3 màn này (HSK cũ cũng không gọi từ GradingWorkspacePage); client giữ cho tương thích | gate `quiz-grading` | `GradingAttemptDetailResponse` |
| E8 | `POST /grading/schedules/{scheduleId}/students/{userId}/send?classId=` | **không dùng** ở 3 màn này (giữ cho màn khác) | gate `quiz-grading` | `{ sent: number }` |
| E9 | `GET /grading/schedules/{scheduleId}/lesson-detail?classId=&title=` | lesson-detail | — | `LessonDetailResponse` (`modules` **phải là mảng**) |
| E10 | `PUT /grading/schedules/{scheduleId}/lesson-detail?classId=` body `LessonDetailResponse` | lesson-detail — "Lưu thay đổi" | gate `lesson-detail` | `LessonDetailResponse` đã lưu (nguồn sự thật sau khi lưu) |

Mã lỗi: `400` body/tham số sai (`VALIDATION_ERROR`), `401`, `403`/`404` theo mục 2, `409` xung đột trạng thái (chấm lại câu đã gửi; gửi bài đã `RETURNED`; `VERSION_CONFLICT` khi hai giảng viên chấm đồng thời), `5xx` lỗi hệ thống. Frontend hiện `errorMessage` ngắn (≤ 300 ký tự, không HTML) nếu có.

## 4. DTO (nguyên văn `src/types/grading.ts`, kế thừa `quiz.type.ts` HSK cũ) và cách frontend dùng

### 4.1 `GradingStudentResponse` (E1) — màn Danh sách nộp bài

```ts
{ userId: string;                      // bắt buộc, khoá dòng; là userId của Auth chung => đi vào query của màn chấm bài
  name?/fullName?: string;             // tên hiển thị (name > fullName); chữ cái đầu lấy từ tên
  studentCode?: string; email?: string;// hiển thị + tìm kiếm (tìm theo name/fullName/studentCode/email)
  completionRate?: number;             // 0..100, vòng tròn "Chuyên cần bài tập"
  totalScore?: number;                 // ĐIỂM TỔNG đã tính đúng ở backend (tổng điểm hiện tại của các bài đã nộp: teacherScore ?? autoScore từng câu)
  answeredQuestions?/totalQuestions?: number;  // "x / y câu"
  submittedAny?: boolean;              // false => ô điểm xám "Chưa nộp bài"
  modules?: GradingStudentModuleResponse[];    // mọi bài đã GIAO trong buổi: { moduleId, attemptId?, quizId?, label, skillType?, submitted, status?: "submitted"|"graded"|"returned", score?, maxScore?, groupId?, groupName?, groupOrder?, quizOrder? }
}                                                // score/maxScore dùng cho tông màu điểm và màu biểu tượng sách (chờ chấm/đã chấm/đã trả)
```

Backend **phải trả `modules[].score` và `totalScore` đúng** — frontend mới không gọi E3 để tính lại (khác HSK cũ). Mock đã làm vậy (`grading-model.mjs` `scheduleStudents`).

### 4.2 `GradingAttemptSummaryResponse` (E2) và `GradingAttemptDetailResponse` (E3–E7) — màn chấm bài

- Tóm tắt: `attemptId` (khoá), `quizId`, `quizTitle` (nhãn bài; thiếu ⇒ `skillType`), `gradingStatus` (`SUBMITTED|AUTO_GRADED|GRADED|RETURNED`…), `autoScore`, `finalScore`, `totalPoints` (điểm tối đa bài), `groupId/groupName/groupOrder/quizOrder` (gom + sắp theo module `#1 Quiz - Nghe`).
- Chi tiết: `attemptId, quizId, gradingStatus, totalPoints, teacherComment, submittedAt, audioFileId?, passageImageFileId?, passageText?` (ngữ liệu dùng chung) và `questions[]`:
  `answerId?` (thiếu ⇒ câu bỏ trống ⇒ chấm qua E5), `questionId`, `questionType`, `questionText`, `questionMediaUrl?` (id tệp hoặc URL), `maxScore`, `isCorrect` (máy chấm), `autoScore`, `teacherScore`, `teacherComment`, `explanation?`, `returnedAt?` (**đã gửi cho học viên ⇒ câu khoá**), dữ liệu hiển thị theo loại: `options[{id, content, mediaUrl?, isCorrect}]`, `matchingPairs[{id, prompt, answer, promptMediaUrl?, answerMediaUrl?}]`, `blanks[{index, correctAnswer}]`, `sentenceChunks[{id, content, isDistractor}]`, `studentAudioId?`, `studentAnswer` (hình dạng theo loại: id đáp án / `{ pairMatches: [{promptId, answerId}] }` / `{ blankAnswers: [{blankIndex, answer}] }` / mảng id mảnh / văn bản), gợi ý AI `aiScore?/aiFeedback?/aiJobStatus?` (chỉ tham khảo).
- Điểm mặc định của câu (frontend, như HSK cũ): `teacherScore` → `maxScore` nếu `isCorrect` → điểm từng phần (nối cặp/điền khuyết) → `autoScore` → `"0"` nếu máy chấm sai → rỗng (chấm tay). **Backend cần tính `autoScore` nhất quán với quy tắc này** để "Số điểm đã lưu" và điểm module không lệch.
- `GradeAnswerRequest = { teacherScore?: number | null; teacherComment?: string }` — `teacherScore: null` = xoá điểm giáo viên (ô để trống); `0 ≤ teacherScore ≤ maxScore` (frontend đã kiểm; backend kiểm lại ⇒ `400`).
- Media: `audioFileId`, `passageImageFileId`, `studentAudioId`, `questionMediaUrl`, `*.mediaUrl` là **id tệp của repo-storage** (`GET {NEXT_PUBLIC_STORAGE_API_BASE_PATH}/file/{id}?disposition=inline`) hoặc URL tuyệt đối. Chưa cấu hình storage ⇒ frontend hiện "Không có tệp" (không bịa `/api/storage/files/{id}` như HSK cũ). Backend cần bảo đảm giảng viên của lớp được tải tệp bài nộp của học viên (quyền ở storage).

### 4.3 `LessonDetailResponse` (E9/E10) — màn Chi tiết bài học

```ts
{ lessonTitle: string;                  // GET: bản đã lưu hoặc `title` của query (tiêu đề buổi)
  modules: [{ id: string; label: string; topicType?: "Bài học"|"Slide"|"Từ vựng"|"Ngữ pháp"; materialType?: "Nghe"|"Đọc hiểu"|"Viết"|"Nói"|"Từ vựng"|"Ngữ pháp"|"Slide";
             locked?: boolean; slideName?: string;
             exercises?: [{ name?: string; audioName?: string; quizId?: string;
                            questions?: [{ no: number; type: string; text?: string; score?: number; options?: [{ label: string; correct?: boolean }] }] }] }] }
```

- GET gộp thay cho 3 lời gọi của HSK cũ (mục 1); `quizId` để màn Phân tích học tập đối chiếu bài chưa làm.
- PUT nhận **toàn bộ tài liệu** (frontend sửa trên bản nháp rồi lưu một lần: thêm/xoá chủ đề, bài tập, câu hỏi, đáp án; đánh dấu đáp án đúng duy nhất; đổi `audioName` — chỉ tên tệp, **không tải tệp lên**; đổi điểm câu). Backend validate ⇒ `400` khi `lessonTitle` không phải chuỗi hoặc `modules` không phải mảng; trả bản đã lưu. HSK cũ không có thao tác lưu thật — backend cần quyết định có cho giảng viên sửa nội dung bài tập của buổi hay chỉ Admin (nếu chỉ Admin: trả `403` cho giảng viên, frontend giữ bố cục "Chỉ xem" bằng cách để `NEXT_PUBLIC_WRITE_LESSON_DETAIL` trống).

## 5. Ngữ nghĩa thao tác ghi của màn chấm bài (frontend đã cài theo HSK cũ)

1. **Lưu một câu** (E4/E5): cập nhật `teacherScore`/`teacherComment` của câu; bài `SUBMITTED` ⇒ `GRADED` khi đã có điểm (frontend hiển thị module "graded" sau lần lưu đầu). Phản hồi là **cả bài** để frontend tính lại điểm module và tổng.
2. **Gửi kết quả** (E6), gọi cho từng bài mà mọi câu chưa gửi đều đã có điểm (GV, bản nháp, hoặc máy chấm): trước đó frontend tự lưu (E4) các bản nháp còn khác điểm đã lưu (kể cả điểm máy chấm chưa được "chốt" thành `teacherScore`), bỏ qua câu đã có `returnedAt`. Backend: đặt `returnedAt` cho mọi câu chưa gửi, `gradingStatus = RETURNED`, phát thông báo cho học viên; chấm lại câu đã gửi ⇒ `409`. Bài còn câu thiếu điểm **không** được gửi (frontend chặn và cảnh báo; backend nên kiểm lại ⇒ `409`/`400`).
3. Gửi lặp (bấm hai lần, mạng chập chờn) không được tạo thông báo thứ hai ⇒ cần idempotency theo (attemptId, tập câu gửi) hoặc trả `409` khi không còn câu nào để gửi.
4. `view=detail`, `studentName` trong URL chỉ để hiển thị/điều hướng (như HSK cũ); không dùng để phân quyền.

## 6. Hành vi frontend khi tham số/phản hồi bất thường (đã kiểm thử với mock và vitest)

| Tình huống | Hiển thị |
|---|---|
| `classId` / `scheduleId` (/ `userId` ở màn chấm) thiếu hoặc không hợp lệ | Thông báo trong khung nội dung; **không gọi API**, không toast |
| Chưa cấu hình `NEXT_PUBLIC_QUIZ_API_BASE_PATH` | "WAITING FOR BACKEND"; không toast; không gọi mạng |
| 401/403/404/5xx/mạng ở lời gọi đọc | Toast (như bản cũ) + khối lỗi có "Thử lại"; **không** hiện "Chưa có học viên"/"Học viên chưa nộp bài nào"/"Buổi này chưa có bài tập" |
| E1 `data` không phải mảng / E9 thiếu `modules` / E3 không phải object | Lỗi hợp đồng "không đúng định dạng" |
| Một E3 lỗi khi tải màn chấm | Cả màn ở trạng thái lỗi (HSK cũ âm thầm bỏ bài đó) |
| Công tắc ghi đóng | Ô điểm/nhận xét bị khoá, nút Lưu/Gửi/"Lưu thay đổi" disabled + `WriteLockedNotice`; màn chi tiết bài học về bố cục "Chỉ xem" |
| E4/E5/E6/E10 lỗi | Toast `errorMessage` của máy chủ (hoặc thông điệp mặc định); dữ liệu/bản nháp đang nhập giữ nguyên; không có "thành công giả" |
| Rỗng thật | "Chưa có học viên" / "Học viên chưa nộp bài nào" / "Buổi này chưa có bài tập" |

## 7. Khác biệt có chủ đích so với HSK cũ (để backend/QA đối chiếu)

- Bỏ N+1 `getGradingAttempt` ở Danh sách nộp bài (mục 4.1). Màn chấm bài vẫn tải chi tiết từng bài (1 + N) vì cần câu hỏi để chấm; điểm module tính từ câu hỏi theo cùng công thức lúc lưu.
- `classId` bắt buộc và mọi khoá URL được kiểm tra trước khi gọi API.
- Media qua repo-storage đã cấu hình, không bịa URL.
- Modal cảnh báo react-bootstrap ⇒ antd Modal; xoá chủ đề/bài tập ở Chi tiết bài học qua `confirmAction` (bản cũ xoá ngay); lưu chi tiết bài học là thao tác ghi thật (bản cũ "thành công giả").
- Trước khi gửi không chấm lại câu đã `returnedAt` (bản cũ có thể gửi PUT lên câu đã trả).
- `finalizeAttempt` (E7) và `sendStudentResults` (E8) không được màn nào trong gói này gọi.

## 8. Điểm backend cần xác nhận trước khi tích hợp

1. Endpoint thật, base path, dịch vụ chủ quản (dùng lại `repo-lms-quiz` hay dịch vụ mới trong backend chung); ánh xạ `userId` Auth chung ↔ roster lớp (B0 D1/D2).
2. D6: `403` hay `404` khi lớp/buổi/học viên/bài không thuộc giảng viên; D7b: `class_id` trên bài nộp để kiểm quyền E3–E8.
3. Quy tắc tính `autoScore`/điểm từng phần và `totalScore` (mục 4.2) để khớp hiển thị; làm tròn.
4. Ngữ nghĩa `send`: đặt `returnedAt` từng câu hay cả bài; thông báo học viên; idempotency; khoá lạc quan (`VERSION_CONFLICT`).
5. Quyền tải tệp bài nộp qua repo-storage cho giảng viên của lớp; có cần `studentName` trong chi tiết bài làm (frontend hiện lấy từ URL).
6. Chi tiết bài học: giảng viên có được sửa (E10) hay chỉ Admin; `audioName` chỉ là tên tệp — có cần tích hợp tải lên storage ở màn này không.
7. Phân trang E1 cho lớp đông học viên (hiện tải toàn bộ, tìm kiếm phía client).
