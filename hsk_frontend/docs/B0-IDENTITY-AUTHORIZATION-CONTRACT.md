# B0 — Hợp đồng định danh giảng viên và phân quyền theo lớp/buổi (bàn giao cho người phụ trách Backend)

Trạng thái: **B0 = OPEN (chưa giải quyết).** Tài liệu này là **đề xuất của frontend** để backend xem xét; **chưa có backend/Auth nào xác nhận**. Không được ghi nhận B0 là RESOLVED cho tới khi đạt đủ điều kiện ở mục 11.
Người soạn: frontend HSK mới (`LMS_HSK/frontend`). Frontend **không** sửa backend/Auth/database và **không** ánh xạ role.
Ngày: 2026-10-26. Liên quan: `docs/M4C0-SURVEY.md` (bằng chứng chi tiết), `docs/BACKEND-AUTH-HANDOVER.md`, `docs/api-requirements/instructor-list-class.md`, `instructor-list-lesson.md`.

Nhãn dùng trong tài liệu:
- **[SỰ THẬT]** — đọc thấy trong source (có dẫn nguồn); chưa chạy hệ thống thật.
- **[BẮT BUỘC]** — yêu cầu bảo mật tối thiểu; không phụ thuộc lựa chọn thiết kế. Mã `M1…M15`.
- **[CHỌN]** — lựa chọn thiết kế cần backend/chủ dự án thống nhất. Mã `D1…D10` (mục 10). Phần mô tả mô hình ở mục 5 là **đề xuất chưa duyệt**.
- **[KHÔNG XÁC MINH ĐƯỢC]** — nguồn không có trong workspace (CMS/ERP) hoặc cần chạy thật.

## 1. Tóm tắt một trang

1. Frontend mới cần các endpoint "lớp / buổi / học viên / bài nộp / chấm bài / phân tích học tập" **của giảng viên đang đăng nhập**.
2. HSK cũ xác định giảng viên **bằng email** và đã có kiểm tra sở hữu lớp ở một số endpoint, nhưng: nhiều endpoint **không kiểm tra role**, các endpoint `/admin/*` **mở cho mọi người đã đăng nhập**, một endpoint **ghi + phát thông báo không kiểm tra quyền**, `classId` thường **tuỳ chọn**, và có chỗ **trả 200 rỗng khi bị từ chối**.
3. Auth chung cấp **userId ULID ổn định** trong JWT (`sub`/`uid`); email không bị ràng buộc là bất biến. Backend chung IELTS không có endpoint tương đương cho giảng viên.
4. Đề xuất: lấy chủ thể **từ principal đã xác thực (userId)**, tra phân công lớp ở server, kiểm tra quyền **mọi lần** (đọc và ghi), chuẩn hoá 401/403/404, **không bao giờ** nhận email/role/teacherId từ client làm căn cứ quyền.
5. Cho tới khi B0 chốt, frontend chỉ làm giao diện ở trạng thái WAITING FOR BACKEND / API BLOCKED.

## 2. Vấn đề hiện tại

- **Không có mô hình định danh thống nhất** giữa Auth chung (userId) và dữ liệu lớp HSK (email). Việc nối hai bên chưa được thiết kế ở backend chung.
- **Không có hợp đồng phân quyền theo lớp** ở backend chung: endpoint lớp/buổi hiện có chỉ dành ADMIN và khác dữ liệu.
- Nếu frontend mới trỏ thẳng vào HSK cũ, sẽ **thừa hưởng các lỗ hổng** liệt kê ở mục 3.
- Frontend hiển thị một lớp **không phải bằng chứng** người dùng có quyền ở endpoint chi tiết — mọi endpoint chi tiết phải tự kiểm tra.

## 3. HSK cũ hiện xử lý thế nào [SỰ THẬT, từ source]

Cơ chế đúng, nên giữ ý tưởng:
- Giảng viên lấy từ **principal**, không từ tham số client (`GradingClassController.extractEmail`).
- `onl-learning` kiểm tra email ∈ `TUTOR` của lớp (snapshot `timetable_class_participants`, rơi về CMS `GET /lms-integration/teachers/{email}/classes`) và ném `FORBIDDEN` "Giáo viên không phụ trách lớp này" khi không thuộc (`GradingClassServiceImpl.assertCmsClassAccess`, `hasSnapshotClassAccess`).
- Quiz gọi `onl-learning` kèm danh tính người dùng được chuyển tiếp (`InternalApiClient.send(..., forwardUserAuth=true)`).
- Ghi (chấm điểm/gửi kết quả) đi qua `assertTeacherCanAccessAttempt` ⇒ 403 nếu học viên không thuộc lớp nào của giảng viên có buổi đó.

Lỗ hổng/điểm yếu cần **không sao chép** (xem bảng đầy đủ ở `M4C0-SURVEY.md` mục 3):

| # | Phát hiện | Rủi ro |
|---|---|---|
| G1 | Không có `@PreAuthorize`/role check trong grading của `quiz` và `onl-learning`; cấu hình chỉ `anyRequest().authenticated()`; gateway không lọc role | Học viên/bất kỳ tài khoản nào đã đăng nhập gọi được endpoint giảng viên |
| G2 | `GET /grading/admin/classes`, `/admin/classes/{id}/students`, onl-learning `/grading-classes/admin/*` không kiểm tra role | Lộ toàn bộ lớp + danh sách học viên (*nếu gateway/mạng không chặn thêm — KHÔNG XÁC MINH ĐƯỢC từ source*) |
| G3 | `GET …/students/{studentEmail}/attendance-analysis` nhận **email học viên từ đường dẫn**, không kiểm tra sở hữu | IDOR: xem điểm danh của học viên tuỳ ý |
| G4 | `POST …/{classId}/schedules/{scheduleId}/students/{studentUserId}/notes` không kiểm tra giảng viên∈lớp, học viên∈lớp, `scheduleId∈classId`; ghi và **phát thông báo** cho `studentUserId` trong đường dẫn | Giảng viên bất kỳ nhắn/thông báo học viên bất kỳ |
| G5 | `GET …/notes/latest` không kiểm tra | Đọc ghi chú tuỳ ý |
| G6 | `GET /grading/schedules/{id}/ungraded-count` không xác thực phạm vi, đếm toàn cục theo `scheduleId` | Rò rỉ + sai khi `syllabusScheduleId` dùng chung giữa các lớp |
| G7 | `GET /grading/schedules/{s}/students` với `classId` không thuộc ⇒ **200 `[]`**; `classId` tuỳ chọn; không kiểm `scheduleId∈lớp` | Che lỗi quyền, gom nhầm học viên giữa các lớp |
| G8 | *(Đã hiệu đính 2026-10-26 sau khi xác minh sâu — xem `B0-BACKEND-VERIFICATION-REPORT.md` V8.)* `GET personalization`: `classId` tuỳ chọn; thiếu ⇒ chỉ còn kiểm tra theo `scheduleId` (vẫn có ownership qua roster). `POST snapshot` và `POST approve`: **bắt buộc `classId`** (400 nếu thiếu) và kiểm tra giảng viên sở hữu lớp + học viên ∈ lớp; **nhưng `reportId` của `approve` không được ràng buộc với (học viên, buổi, lớp) ở tầng LMS** (chỉ chuyển `reportId` sang AI-CNH) | GET phụ thuộc client; approve: POTENTIAL RISK (AI-CNH có kiểm tra hay không — KHÔNG XÁC MINH ĐƯỢC) |
| G9 | Phân công lớp ↔ giảng viên **chỉ theo email**; Mentor không có vai trò riêng (`STUDENT`/`TUTOR`) | Email đổi/thiếu ⇒ mất/nhầm quyền; Mentor không có chính sách |
| G10 | Điểm tổng tính ở frontend cũ qua N lời gọi `GET /grading/attempts/{id}` | Hiệu năng + logic điểm nằm ở client |

## 4. Auth chung hoạt động thế nào [SỰ THẬT]

- JWT RS256; claims: `sub`=`uid`=userId (ULID 26 ký tự, `BaseEntity`), `email`, `user_code`, `roles`, `email_verified`, `typ` (`SecurityConstants`, `JwtTokenServiceImpl`).
- `AuthPrincipal(userId, email, emailVerified, roles)`; `getName()` = **email nếu có, không thì userId** ⇒ **không dùng `getName()` làm khoá**.
- `users.email` unique, not null; hiện không có đường đổi email trong code (`ProfileController` không có; `AdminServiceImpl.updateUser` không áp dụng dù `AdminUpdateUserRequest` có trường `email`) ⇒ bất biến *trên thực tế* nhưng **không được hợp đồng hoá**.
- Role nằm trong token ⇒ đổi role chỉ có hiệu lực khi cấp token mới.
- API nội bộ tra hồ sơ: `GET /internal/profiles/{userId}`, `POST /internal/profiles/batch`, `POST /internal/profiles/by-emails`.
- `lms-identity.teacher_profiles` khoá chính `identity_user_id` (= Auth userId) + email unique: hồ sơ giáo viên, **không phải phân công lớp**.
- Tiền lệ chuẩn trong backend chung: `IdentityClient` (IELTS) "LMS chỉ giữ userId", `MeController` scope theo JWT chống IDOR; `LessonMaterialAuthorizationService` + `OnlLearningValidationServiceImpl` (HSK) tính phạm vi giảng viên từ principal kèm mã lý do.
- **[KHÔNG XÁC MINH ĐƯỢC]**: CMS/ERP (nguồn `tutorEmail`, `teacherId`, `/lms-integration/*`, `/me/classes`) không có trong workspace; `teacherId` của CMS có trùng Auth userId hay không chưa rõ.

## 5. Phương án định danh và quy tắc phân quyền

### 5.1 Mô hình định danh — **[ĐỀ XUẤT, chưa duyệt; xem D1, D2]**

- **Chủ thể = Auth `userId`** lấy từ principal đã xác thực (không bao giờ từ query/path/body/header do client gửi).
- Email chỉ để hiển thị/tra cứu qua Auth nội bộ, không là khoá nghiệp vụ.
- Bảng phân công **theo userId**, ví dụ `class_staff_assignment(class_id, user_id, staff_role {TEACHER|MENTOR|…}, source, synced_at, version)`. Khi đồng bộ từ CMS (đang theo email) thì đổi email → userId qua `POST /internal/profiles/by-emails`; email không tìm thấy ⇒ **không cấp quyền** và ghi log để đối soát.
- Một `ClassAccessService` duy nhất tại backend sở hữu dữ liệu lớp, với các hàm: `assertCanAccessClass(principal, classId)`, `assertScheduleInClass(classId, scheduleId)`, `assertStudentInClassSchedule(classId, scheduleId, studentUserId)`, `assertAttemptInScope(principal, classId, attemptId)`. Các service khác (quiz…) gọi hàm này thay vì tự suy ra từ email.
- Lý do chọn (không phải khẳng định): userId bất biến, đã có sẵn trong token, khớp tiền lệ IELTS; tránh phụ thuộc email. Phương án thay thế (vẫn dùng email nhưng lấy từ principal và coi là bất biến; hoặc dùng `teacherId` CMS) — xem D1.

### 5.2 Quy tắc bắt buộc **[BẮT BUỘC]**

| Mã | Quy tắc |
|---|---|
| M1 | Danh tính người gọi **chỉ** từ principal đã xác thực. Mọi `email`, `role`, `teacherId`, `userId giảng viên` trong query/path/body/header **bị bỏ qua** cho mục đích quyền. |
| M2 | Mọi endpoint giảng viên/admin kiểm tra **role nghiệp vụ** đúng (xem D3–D5 cho chính sách cụ thể). Không dùng chỉ `authenticated()`. |
| M3 | Mọi endpoint theo lớp kiểm tra người gọi **được phân công/được phép** với `classId` ở server, mỗi lần gọi (không cache quyết định phía client). |
| M4 | Mọi endpoint theo buổi kiểm tra `scheduleId` **thực sự thuộc** `classId`. `syllabusScheduleId` dùng chung giữa nhiều lớp nên **không đủ** để xác định phạm vi. |
| M5 | `classId` **bắt buộc** ở mọi endpoint chi tiết/ghi (đường dẫn), không tuỳ chọn. |
| M6 | Học viên/bài làm/câu trả lời/báo cáo phải thuộc đúng `(classId, scheduleId)` được kiểm tra; kiểm tra `studentUserId` ∈ roster của lớp đó. |
| M7 | Mọi thao tác **ghi** (chấm điểm, gửi kết quả, ghi chú, tạo/duyệt báo cáo AI) kiểm tra quyền riêng **tại thời điểm ghi** (không dựa vào việc đã đọc được), kiểm tra scope như trên, ghi audit (ai, lớp, buổi, học viên, hành động, thời điểm). |
| M8 | Thao tác gây tác dụng ra ngoài (gửi kết quả, thông báo) có **chống gửi trùng** (idempotency key hoặc trạng thái) và không phát thông báo khi kiểm tra quyền thất bại. |
| M9 | Phản hồi từ chối **chuẩn hoá** (mục 8): thiếu/hết hạn xác thực ⇒ 401; sai role hoặc không được phân công ⇒ 403 (hoặc 404, D6); lớp/buổi không tồn tại ⇒ 404. **Không** trả `200` với danh sách rỗng để che việc bị từ chối ở endpoint chi tiết. |
| M10 | Endpoint danh sách "của tôi" chỉ trả lớp của chính người gọi (kiểu `/me`); rỗng ở đây nghĩa là **thực sự không có lớp**, không phải bị từ chối. |
| M11 | Mọi endpoint `/admin/*` chỉ ADMIN (và vai trò quản lý được D4 cho phép). Không sao chép tình trạng "mở cho mọi tài khoản" của HSK cũ. |
| M12 | Không nhận **email học viên từ đường dẫn** làm khoá tra cứu quyền; dùng `studentUserId` đã kiểm tra thuộc lớp. |
| M13 | Phản hồi không lộ thông tin ngoài phạm vi (vd. số lượng/boolean của lớp khác; thông điệp lỗi không tiết lộ lớp tồn tại hay không nếu chọn 404, D6). |
| M14 | Role thay đổi / giảng viên bị bỏ phân công phải **mất quyền** trong thời hạn đã thống nhất (D9: kiểm tra phân công ở server mỗi lần nên không phụ thuộc token cũ; role trong token cũ chỉ sống tới hết TTL). |
| M15 | Token không được ghi vào log; log lỗi quyền chỉ chứa userId + classId/scheduleId, không chứa email học viên/nội dung bài làm. |

### 5.3 Quy tắc theo vai trò — **[CHỌN]** (D3–D5)

Đề xuất mặc định (chưa duyệt): `ROLE_ADMIN` truy cập mọi lớp (đọc/ghi theo chính sách ghi riêng); `ROLE_TEACHER` và `ROLE_MENTOR` chỉ lớp được phân công; `ROLE_TEACHER_MANAGER` do chủ dự án quyết (UNKNOWN); `ROLE_COLLABORATOR` không có quyền ở khu này; `ROLE_USER`/học viên không có quyền. Mentor có được **ghi** (chấm/gửi) hay chỉ đọc — D4.

## 6. Endpoint cần backend cung cấp (ma trận)

Trạng thái: **AVAILABLE** = có sẵn, tương thích; **PARTIAL** = có phần, thiếu trường/quyền; **MISSING** = chưa có; **BLOCKED** = không tích hợp được vì cần quyết định B0.
Tên endpoint ở cột "Đề xuất" là **gợi ý**; backend có thể chọn khác, miễn đáp ứng M1–M15.

### 6.1 Danh sách lớp / buổi (đã có UI; M4A/M4B)

| Màn | HSK cũ | Backend chung IELTS | Request | Response | Phân trang/lọc | Role | Kiểm tra lớp/buổi | Trạng thái | Câu hỏi |
|---|---|---|---|---|---|---|---|---|---|
| `/instructor/list-class` | `GET {quiz}/grading/classes` (principal) | `GET /classes` ADMIN-only, dữ liệu khác; CMS `/me/classes` (`MeController`) — chưa xác minh dùng cho giảng viên | không tham số định danh (M1) | `GradingClassResponse[]`: `classId, classCode, className, courseId, courseName, teacherName, teacherEmail, startDate, endDate, actualEndDate, studentCount, hasPendingGrading` | HSK cũ: không phân trang server; frontend lọc/phân trang (6/trang) | TEACHER, MENTOR (D3) | chỉ lớp của người gọi (M10) | **MISSING** ở backend chung (HSK cũ AVAILABLE nhưng có G1) | Định dạng ngày; phân trang server? `hasPendingGrading` tính thế nào |
| `/admin/class-management` | `GET {quiz}/grading/admin/classes` | `GET /classes` (ADMIN) khác trường | — | như trên | như trên | ADMIN | M11 | **PARTIAL/BLOCKED** (G2 ở HSK cũ) | Có thêm vai trò quản lý nào (D4)? |
| `/instructor/list-class/list-lesson` | `GET {quiz}/grading/classes/{classId}/schedules` | `GET /classes/{classId}/sessions` ADMIN-only, `ClassSessionResponse` thiếu `title/topic/syllabusScheduleId/hasAssignment/hasPendingGrading` | path `classId` | `GradingScheduleResponse[]`: `sessionId, sessionNo, title, topic, syllabusScheduleId, hasAssignment, hasPendingGrading` | frontend phân trang 10/trang | TEACHER, MENTOR | `assertCanAccessClass` (M3); lớp không có ⇒ 404; không được phân công ⇒ 403/404 (D6) | **PARTIAL** (HSK cũ 403 đúng; IELTS INCOMPATIBLE) | Nguồn `title/topic/hasAssignment`; mã lỗi |

### 6.2 Endpoint cho màn M4C và sau (chưa có UI)

| Chức năng | HSK cũ | Backend chung | Đề xuất | Request | Response | Role | Kiểm tra | Trạng thái | Câu hỏi |
|---|---|---|---|---|---|---|---|---|---|
| Danh sách học viên theo buổi (submissions, learning-analysis) | `GET {quiz}/grading/schedules/{s}/students[?classId]` | MISSING | `GET …/classes/{classId}/schedules/{scheduleId}/students` | path | `GradingStudentResponse[]` (xem mục 7) | TEACHER, MENTOR | M3, M4, M5; lớp/buổi lạ ⇒ 404/403, **không 200 rỗng** | **BLOCKED** (B0) | Điểm tổng + trạng thái bài nộp do backend tính (D8)? |
| Chi tiết một bài làm (đọc) | `GET {quiz}/grading/attempts/{attemptId}` | MISSING | `GET …/classes/{classId}/schedules/{scheduleId}/students/{studentUserId}/attempts` + `GET …/attempts/{attemptId}` | path | `GradingAttemptResponse` | TEACHER, MENTOR | M3–M6 | **BLOCKED** | Bỏ N+1 ở client? |
| Đếm chờ chấm theo buổi | `GET {quiz}/grading/schedules/{id}/ungraded-count` | MISSING | gộp vào `hasPendingGrading` của danh sách buổi, hoặc `GET …/classes/{classId}/schedules/{scheduleId}/ungraded-count` | path | `{count}` | TEACHER, MENTOR | M3, M4 (G6) | **BLOCKED** | |
| Phân tích điểm danh | `GET onl …/students/{studentEmail}/attendance-analysis` | MISSING | `GET …/classes/{classId}/students/{studentUserId}/attendance-analysis` | path (userId, **không email**, M12) | điểm danh theo lớp | TEACHER, MENTOR | M3, M6, M12 | **BLOCKED** | CMS có khoá theo userId không (KHÔNG XÁC MINH ĐƯỢC) |
| Nhận xét gần nhất | `GET onl …/notes/latest` | MISSING | `GET …/classes/{classId}/schedules/{scheduleId}/students/{studentUserId}/notes/latest` | path | `{note, createdAt, author}` | TEACHER, MENTOR | M3–M6 (G5) | **BLOCKED** | |
| **GHI** Gửi nhận xét cho học viên | `POST onl …/notes` | MISSING | `POST …/classes/{classId}/schedules/{scheduleId}/students/{studentUserId}/notes` | body `{content, idempotencyKey}` | `{noteId, createdAt}` | TEACHER (D4 cho MENTOR) | M3–M8 (G4) | **BLOCKED** | Phát thông báo? kênh? idempotency |
| Báo cáo AI — đọc | `GET {quiz}/…/personalization` | MISSING | `GET …/personalization` dưới đường dẫn lớp/buổi/học viên | path | báo cáo + phiên bản + trạng thái | TEACHER, MENTOR | M3–M6 (G8) | **BLOCKED** | AI advisory, người duyệt cuối là giảng viên |
| **GHI** Tạo báo cáo AI | `POST …/personalization/snapshot?classId&forceNewVersion` | MISSING | `POST …/personalization/snapshot` | body `{forceNewVersion}` | `{reportId, status}` | TEACHER | M3–M8 | **BLOCKED** | Giới hạn tần suất/chi phí |
| **GHI** Duyệt báo cáo AI | `POST …/reports/{reportId}/approve?classId` | MISSING | `POST …/reports/{reportId}/approve` (classId trong path) | — | `{status}` | TEACHER (D4) | M3–M8 | **BLOCKED** | Ai được duyệt |
| **GHI** Chấm câu trả lời / câu hỏi / chốt bài | `PUT …/answers/{id}`, `PUT …/attempts/{a}/questions/{q}`, `PUT …/attempts/{a}/finalize` | MISSING | dưới đường dẫn lớp/buổi/học viên | body điểm/nhận xét | bài làm đã cập nhật | TEACHER (D4) | M3–M8 | **BLOCKED** | Khoá lạc quan (phiên bản)? |
| **GHI** Gửi kết quả cho học viên | `POST …/attempts/{id}/send`, `POST …/students/{u}/send` | MISSING | `POST …/send` dưới đường dẫn | body `{idempotencyKey}` | `{sentAt}` | TEACHER (D4) | M3–M8 | **BLOCKED** | Gửi gộp vs từng bài; chống gửi trùng |
| Lưu chi tiết bài học | **Không tồn tại** (frontend cũ giả `success: true`) | — | Cần quyết định sản phẩm | — | — | — | — | **BLOCKED (không có hợp đồng)** | Có cần lưu thật không? |

## 7. DTO tham chiếu

Từ frontend cũ (`core/types/quiz.type.ts`), dùng làm **điểm xuất phát**, chưa phải hợp đồng đã duyệt:
- `GradingStudentResponse`: `userId, email?, name?, fullName?, phone?, avatarUrl?, studentCode?, completionRate?, totalScore?, answeredQuestions?, totalQuestions?, submittedAny?, ungradedCount?, modules?, statusBySkill?`.
- Đề xuất: **backend là nơi tính** `totalScore`, `completionRate`, `submittedAny`, `ungradedCount`, trạng thái từng kỹ năng; frontend không tự suy ra từ N lời gọi chi tiết (G10). Trường `email` chỉ để hiển thị (có thể bỏ nếu không cần), **không dùng làm khoá**.
- `GradingScheduleResponse` (đã dùng ở M4B): `sessionId, sessionNo, title, topic, syllabusScheduleId, hasAssignment, hasPendingGrading`.
- `GradingClassResponse`: xem mục 6.1.
- Lỗi: mục 8. Mọi DTO ghi cần `idempotencyKey` (M8) nếu có tác dụng ngoài.

## 8. Mã lỗi — **[CHỌN] D6 cho 403 vs 404; phần còn lại [BẮT BUỘC]**

| Tình huống | HTTP | Mã lỗi nghiệp vụ đề xuất | Ghi chú |
|---|---|---|---|
| Thiếu/hết hạn/không hợp lệ token | 401 | `AUTH_REQUIRED` | Frontend sẽ thử refresh một lần |
| Role không được phép ở endpoint này | 403 | `ROLE_FORBIDDEN` | |
| Lớp không tồn tại | 404 | `CLASS_NOT_FOUND` | |
| Lớp tồn tại nhưng người gọi không được phân công | 403 `CLASS_ACCESS_DENIED` **hoặc** 404 `CLASS_NOT_FOUND` | | D6; khuyến nghị 404 để không lộ sự tồn tại, nhưng frontend cần phân biệt để hiển thị |
| `scheduleId` không thuộc `classId` | 404 | `SCHEDULE_NOT_IN_CLASS` | Không 200 rỗng |
| Học viên không thuộc lớp/buổi | 404 (hoặc 403) | `STUDENT_NOT_IN_CLASS` | |
| Bài làm/câu trả lời ngoài phạm vi | 404 (hoặc 403) | `ATTEMPT_OUT_OF_SCOPE` | |
| Dữ liệu ghi không hợp lệ | 400/422 | `VALIDATION_FAILED` | |
| Gửi trùng | 409 hoặc 200 idempotent | `DUPLICATE_REQUEST` | D10 |
| Dịch vụ phụ thuộc (CMS/Auth) lỗi | 502/503 | `UPSTREAM_UNAVAILABLE` | Không đổi thành 403/404 |

Định dạng thân lỗi: `{status, code, message, traceId}`; `message` không chứa email/dữ liệu cá nhân.

## 9. Kịch bản kiểm thử bảo mật (backend chạy trên staging; frontend không tự gọi)

Mọi ca phải xác nhận **không có tác dụng phụ** (không ghi, không thông báo) khi bị từ chối.

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| T1 | Không token / token hết hạn / token sai chữ ký gọi từng endpoint | 401 |
| T2 | Học viên (`ROLE_USER`) gọi endpoint giảng viên và `/admin/*` | 403 |
| T3 | Teacher A gọi `classId` của Teacher B (đọc danh sách buổi) | 403/404 theo D6; **không 200 rỗng** |
| T4 | Teacher A gọi `classId` hợp lệ của A kèm `scheduleId` của lớp B | `SCHEDULE_NOT_IN_CLASS` |
| T5 | Hai lớp dùng chung `syllabusScheduleId`: giảng viên chỉ dạy lớp 1 truy cập học viên lớp 2 qua `scheduleId` | từ chối |
| T6 | `studentUserId` không thuộc lớp (nhưng thuộc lớp khác của chính giảng viên) | từ chối |
| T7 | Thay `attemptId`/`answerId` bằng của học viên lớp khác | từ chối (đọc và ghi) |
| T8 | Gửi `email`/`teacherId`/`role` giả trong query/header/body | bị bỏ qua; quyền vẫn theo token |
| T9 | Ghi chú/nhận xét gửi tới học viên ngoài lớp | từ chối, **không phát thông báo** |
| T10 | Attendance-analysis với email học viên ngoài lớp (nếu còn giữ tham số email) | từ chối |
| T11 | Mentor chưa được phân công vào lớp | từ chối; Mentor đã phân công theo D4 |
| T12 | Collaborator / Teacher-manager gọi theo D3–D5 | theo chính sách đã chốt |
| T13 | Giảng viên bị gỡ khỏi lớp, vẫn dùng token cũ chưa hết TTL | mất quyền theo D9 |
| T14 | Đổi role người dùng; token cũ | hành vi đúng D9, ghi rõ trong tài liệu |
| T15 | Lớp không tồn tại vs lớp không được phân công | phản hồi đúng D6, không lộ chênh lệch nếu chọn 404 |
| T16 | Gửi trùng thao tác ghi/gửi kết quả (cùng idempotency key) | một tác dụng duy nhất |
| T17 | Ghi đồng thời hai giảng viên cùng chấm một bài (nếu cho phép nhiều giảng viên/lớp) | không mất cập nhật (khoá lạc quan) |
| T18 | Đường dẫn chứa ký tự lạ/độ dài lớn/ID sai định dạng | 400/404, không lỗi 500 |
| T19 | Log lỗi quyền | không chứa token/email học viên/nội dung bài |
| T20 | CMS/Auth lỗi khi tra phân công | 502/503, **không mặc định cho phép** (fail closed) |

## 10. Quyết định còn mở (cần backend + chủ dự án)

| Mã | Quyết định | Phương án gợi ý (chưa duyệt) |
|---|---|---|
| D1 | Khoá định danh giảng viên | userId (khuyến nghị) / email lấy từ principal / `teacherId` CMS |
| D2 | Nơi lưu phân công lớp–nhân sự và cách đồng bộ từ CMS (email→userId) | Bảng theo userId ở service lớp học; đối soát khi email không khớp |
| D3 | Role nào dùng khu giảng viên | TEACHER, MENTOR (hiện là quyết định giao diện, chưa phải xác nhận backend) |
| D4 | Quyền của Mentor/Admin/Teacher-manager: đọc vs ghi (chấm, gửi, ghi chú, duyệt AI) | Admin đọc tất cả; ghi theo chính sách riêng |
| D5 | Collaborator có vào khu quản lý không | Chưa quyết (UNKNOWN) |
| D6 | Không phân công ⇒ 403 hay 404 | 404 chống dò; nhưng frontend cần thông điệp phân biệt |
| D7 | `classId` bắt buộc mọi endpoint chi tiết, đặt ở path | Bắt buộc (M5) |
| D8 | Điểm tổng/trạng thái do backend tính | Có |
| D9 | Hiệu lực khi đổi role/gỡ phân công | Kiểm tra phân công ở server mỗi lần; role từ token chỉ tới hết TTL |
| D10 | Idempotency và audit cho thao tác ghi/gửi | Idempotency key + bảng audit |

## 11. Điều kiện hoàn tất B0

B0 chỉ được đánh dấu **RESOLVED** khi đủ **tất cả**:
1. Backend/Auth **đã xác nhận bằng văn bản** D1–D10 (hoặc phương án thay thế).
2. M1–M15 được hiện thực ở các endpoint trong mục 6 (hoặc nhóm tối thiểu cho M4C.1: danh sách học viên theo buổi).
3. Có mã lỗi chuẩn hoá (mục 8) trong tài liệu API của backend.
4. Bộ kịch bản mục 9 chạy **đạt trên staging**, kèm bằng chứng (kết quả, không kèm token).
5. Endpoint `/admin/*` đã có kiểm tra role (G2) hoặc xác nhận chặn ở lớp mạng kèm bằng chứng.
6. M2 REAL AUTH VERIFICATION đã chạy trên staging với tài khoản theo role (chủ dự án cung cấp môi trường — xem `BACKEND-AUTH-HANDOVER.md` mục 6).
Hiện trạng: **0/6**. B0 = **OPEN**.
