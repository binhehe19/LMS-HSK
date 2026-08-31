# M4C.0 — Khảo sát định danh giảng viên, quyền theo lớp/buổi và phạm vi M4C.1

Ngày khảo sát: 2026-10-26. Phạm vi: **chỉ đọc** source của `Authentication_Backend`, `LMS_Backend` (HSK cũ), `LMS_IELTS/backend` (backend chung), `LMS_Frontend` (HSK cũ). Không sửa gì ngoài tài liệu trong `LMS_HSK/frontend`; không chạy hệ thống thật; không gọi Auth/backend.
Checkpoint M4B: commit `f03b6a8`, tag `m4b-checkpoint`. **B0 = OPEN** (mới có tài liệu đề xuất; chưa backend nào xác nhận). **M2 REAL AUTH VERIFICATION = PENDING.**

Quy ước nhãn: **[ĐÃ XÁC MINH]** = đọc thấy trong source (có đường dẫn); **[ĐỀ XUẤT]** = thiết kế do frontend đề xuất, backend chưa chấp thuận; **[KHÔNG XÁC MINH ĐƯỢC]** = nguồn không có trong workspace (vd. CMS/ERP) hoặc cần chạy hệ thống thật.

## 1. Định danh người dùng của Authentication chung

| # | Câu hỏi | Kết luận | Nguồn |
|---|---|---|---|
| 1 | Trường identity | Access token (RS256, `aud=external`, `typ=access`) mang: `sub` = userId, `uid` = userId, `email`, `user_code`, `roles` (mảng), `email_verified`. `AuthPrincipal(userId, email, emailVerified, roles)` được dựng từ token ở `BearerTokenAuthenticationFilter` (từ header `Authorization: Bearer` hoặc cookie `access_token`) và quyền (`GrantedAuthority`) = đúng các role trong token. [ĐÃ XÁC MINH] | `repo-auth/.../JwtTokenServiceImpl.buildAccessToken`; `repo-common-framework/.../JwtVerifier.toPayload`, `BearerTokenAuthenticationFilter`, `SecurityConstants` |
| 2 | Có user ID ổn định không | **Có.** `users.id` là ULID 26 ký tự do `BaseEntity.onCreate` sinh một lần (`updatable = false`). [ĐÃ XÁC MINH] | `BaseEntity` (id `length=26`, `updatable=false`, `UlidGenerator`) |
| 3 | `Authentication.getName()` là gì | `AuthPrincipal.getName()` trả **email nếu có, ngược lại userId** — nên `getName()` KHÔNG phải khoá ổn định (đổi theo việc token có `email` hay không). HSK cũ vừa dùng `principal.email()` vừa dùng `getName()` làm định danh giảng viên. [ĐÃ XÁC MINH] | `AuthPrincipal.getName`; `GradingClassController.extractEmail` |
| 4 | Email có đổi được không | `users.email` là `unique, not null`. Ở code hiện tại **không có đường nào đổi email**: `PUT /users/me` không có trường email; `AdminUpdateUserRequest` CÓ trường `email` nhưng `AdminServiceImpl.updateUser` **không áp dụng** nó. Nghĩa là email hiện bất biến *trên thực tế* nhưng không được ràng buộc bởi schema hay hợp đồng, và DTO admin cho thấy ý định cho phép đổi. Không nên coi là định danh chính. [ĐÃ XÁC MINH; ý định là suy luận] | `User`, `ProfileController`, `AdminUpdateUserRequest`, `AdminServiceImpl.updateUser` |
| 5 | Vai trò | `RoleName` gồm `ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_MENTOR`, `ROLE_TEACHER_MANAGER`, `ROLE_COLLABORATOR`, `ROLE_USER`, `ROLE_MANAGER`, `ROLE_CLASS_MANAGER`, … Role nằm **trong token** nên thay đổi role chỉ có hiệu lực khi token được cấp lại (access TTL ~10 phút ở môi trường dev theo báo cáo `AUTH-SPLIT-LOCAL-FULLSTACK-REPORT.md`; chưa kiểm tra giá trị prod). [ĐÃ XÁC MINH] | `RoleName`; `AdminServiceImpl.updateUser` (role gán phía server) |
| 6 | Tra cứu danh tính giữa dịch vụ | Auth có API nội bộ tra hồ sơ: `GET /internal/profiles/{userId}`, `POST /internal/profiles/batch`, `POST /internal/profiles/by-emails` (email → userId), `/internal/users/lookup|search`. [ĐÃ XÁC MINH] | `InternalProfileController`, `UserLookupController` |
| 7 | Frontend nhận gì | `GET /users/me` trả `id`, `email`, `fullName`, `roles`, `emailVerified`, … (frontend HSK mới dùng `id`, `email`, `fullName`, `roles`). [ĐÃ XÁC MINH] | `ProfileController.me`, `ProfileResponse` |

Tiền lệ trong backend chung: `IdentityClient` của IELTS ghi rõ nguyên tắc **"LMS chỉ giữ userId; Auth là nguồn duy nhất của tên/email"** và `MeController` ghi chú **"scope kết quả theo JWT người gọi (không nhận studentId/teacherId qua param để tránh IDOR)"**. [ĐÃ XÁC MINH]

## 2. Quan hệ người dùng — giảng viên — lớp

| # | Câu hỏi | Kết luận | Nguồn |
|---|---|---|---|
| 1 | Dữ liệu lớp HSK liên kết với giáo viên theo trường nào | **EMAIL** (không có userId): bảng `timetable_class_participants(class_id, email, participant_role, sync_version)` trong `onl-learning`; `participant_role ∈ {STUDENT, TUTOR}`. Được đồng bộ từ CMS bởi `TimetableSyncServiceImpl` (email lấy từ `session.tutorEmail`/lớp). Khi không có snapshot, rơi về CMS `GET /lms-integration/teachers/{email}/classes`. [ĐÃ XÁC MINH] | `TimetableClassParticipant`, `TimetableParticipantRole`, `TimetableSyncServiceImpl`, `GradingClassServiceImpl.getMyClasses`, `CmsClient.getTeacherClasses` |
| 2 | Có bảng/dịch vụ ánh xạ Auth chung ↔ giáo viên HSK không | **Có một phần.** `lms-identity.teacher_profiles` khoá chính `identity_user_id` (= Auth userId, 26 ký tự) + `email` unique + hồ sơ giảng dạy (V6 đã bỏ các trường trùng với Auth). Nó là **hồ sơ giáo viên**, KHÔNG phải quan hệ phân công lớp. Quan hệ lớp ↔ giáo viên vẫn theo email (mục 1). Quiz service đổi email ↔ userId của HỌC VIÊN qua `IdentityProfileClient` (`/internal/profiles/by-emails`, `/batch`); `QuizAttempt.userId` là userId của Auth. [ĐÃ XÁC MINH] | `TeacherProfile`, `V6__...sql`, `IdentityProfileClient` |
| 3 | Teacher và Mentor có quan hệ phân công nào | Trong dữ liệu lớp **không có vai trò MENTOR riêng**: chỉ `STUDENT`/`TUTOR`. Mentor chỉ thấy lớp nếu email của họ nằm trong dữ liệu `TUTOR` (CMS). `LmsAccessPolicy` và `LessonMaterialAuthorizationService` coi `ROLE_TEACHER` và `ROLE_MENTOR` như nhau (nhóm "AUTHOR"). Chính sách "Mentor được truy cập lớp nào" **chưa được định nghĩa** (CMS có thể có khái niệm khác — không có source CMS trong workspace). [ĐÃ XÁC MINH / một phần KHÔNG XÁC MINH ĐƯỢC] | `TimetableParticipantRole`, `LmsAccessPolicy`, `LessonMaterialAuthorizationService` |
| 4 | Backend chung IELTS | Lớp/phiên lấy từ CMS: `GET /classes`, `/classes/{id}/sessions` (**cả controller `@PreAuthorize ROLE_ADMIN`**) và `GET /me/classes` (CMS `/me/classes`, scope theo token người gọi; `CmsMyClass.teacherId`). Không có endpoint "lớp của giảng viên" kiểu HSK. `teacherId` của CMS là id trong hệ CMS — **chưa rõ có trùng Auth userId không**. [ĐÃ XÁC MINH; ánh xạ id KHÔNG XÁC MINH ĐƯỢC] | `ClassController`, `MeController`, `CmsClient`, `client/dto/Cms*` |

## 3. Điểm kiểm tra quyền của backend HSK cũ (theo từng endpoint)

Cấu hình bảo mật: `onl-learning` và `quiz` chỉ khai báo `.anyRequest().authenticated()` cho nhóm grading; **không có `@PreAuthorize` nào** trong `GradingController`/`GradingServiceImpl`/`GradingClassController`. Gateway HSK chỉ định tuyến (`/api/quiz/**`, `/api/online-learning/**`), không có bộ lọc role. [ĐÃ XÁC MINH]

Danh tính được lấy từ principal (đúng), nhưng ở hai tầng khác nhau: quiz gọi `onl-learning` kèm **danh tính người dùng chuyển tiếp** (`InternalApiClient.send(..., forwardUserAuth=true)`) và `onl-learning` tra lớp theo **email** của principal.

| Endpoint (HSK cũ) | Kiểm tra role | Kiểm tra sở hữu / phạm vi | Khi bị từ chối | Nhận xét |
|---|---|---|---|---|
| quiz `GET /grading/classes` | không | theo principal (email) qua `onl-learning /grading-classes/me` | — | Đúng nguyên tắc "scope theo principal" |
| quiz `GET /grading/classes/{classId}/schedules` | không | `onl-learning getClassSessions`: email ∈ TUTOR của lớp (snapshot) hoặc ∈ CMS → nếu không `ApiException(FORBIDDEN, "Giáo viên không phụ trách lớp này")` | **403** | Tốt về ownership; thiếu kiểm tra role |
| quiz `GET /grading/classes/{classId}/ungraded-count` | không | gián tiếp (gọi `getClassSchedules` ⇒ 403 nếu không phụ trách) | 403 | OK |
| quiz `GET /grading/schedules/{scheduleId}/ungraded-count` | không | **không có** (đếm toàn cục theo `scheduleId`, gồm học viên của lớp khác dùng chung `syllabusScheduleId`) | — | Rò rỉ boolean + sai ngữ nghĩa |
| quiz `GET /grading/schedules/{scheduleId}/students[?classId]` | không | có `classId` nhưng **không thuộc giảng viên ⇒ trả `[]` (200)**; không có `classId` ⇒ lấy lớp đầu tiên của giảng viên chứa buổi đó; **không kiểm tra `scheduleId ∈ lớp`** | **200 rỗng** | Che lỗi quyền; `classId` tuỳ chọn |
| quiz `GET /grading/schedules/{s}/students/{userId}/attempts` | không | `assertTeacherCanAccessScheduleStudent`: email học viên ∈ roster **của mọi lớp của giảng viên có chứa buổi `s`** | 403 / 404 | Có ownership; dựa vào `scheduleId` dùng chung giữa các lớp |
| quiz `GET /grading/attempts/{id}`, `PUT /grading/answers/{id}`, `PUT /grading/attempts/{id}/questions/{q}`, `PUT /grading/attempts/{id}/finalize`, `POST /grading/attempts/{id}/send`, `POST /grading/schedules/{s}/students/{u}/send` | không | `assertTeacherCanAccessAttempt` ⇒ như dòng trên (suy từ `attempt.scheduleId` + `attempt.userId`) | 403 | Có ownership cho GHI; không kiểm tra `classId`; không có audit/idempotency được thấy |
| quiz personalization `GET` | không | `classId` **tuỳ chọn**: có ⇒ `ownsClass` + học viên ∈ lớp; **không có ⇒ chỉ còn `assertTeacherCanAccessScheduleStudent`** (vẫn kiểm sở hữu qua roster) | 403 | Phụ thuộc client truyền `classId` |
| quiz `POST …/personalization/snapshot`, `POST …/reports/{reportId}/approve` *(hiệu đính 2026-10-26)* | không | **`classId` BẮT BUỘC** (400 nếu thiếu); `ownsClass` + học viên ∈ lớp + `assertTeacherCanAccessScheduleStudent`. **`reportId` không được ràng buộc với học viên/buổi/lớp** (chỉ chuyển sang AI-CNH) | 400/403 | Ghi có kiểm tra; `reportId` là POTENTIAL RISK |
| quiz `GET /grading/admin/classes`, `GET /grading/admin/classes/{classId}/students` | **không** | **không** | — | **Mọi người dùng đã đăng nhập (kể cả học viên) gọi được** — liệt kê mọi lớp và danh sách học viên. Gateway không chặn |
| onl-learning `GET /grading-classes/{classId}/sessions|students` | không | email ∈ TUTOR/CMS | **403** | OK ownership |
| onl-learning `GET /grading-classes/admin/all`, `/admin/{classId}/sessions`, `/admin/{classId}/students` | **không** | **không** | — | Như trên; được gateway phơi qua `/api/online-learning/**` |
| onl-learning `GET …/students/{studentEmail}/attendance-analysis` | không | **không** (nhận **email học viên từ đường dẫn**, tra CMS theo `classId`) | — | Rủi ro IDOR: biết `classId` + email là xem được điểm danh |
| onl-learning `POST …/{classId}/schedules/{scheduleId}/students/{studentUserId}/notes` | không | **không kiểm tra** giảng viên thuộc `classId`, học viên thuộc lớp, hay `scheduleId ∈ classId`; ghi `learning_analysis_notes` và **phát thông báo cho `studentUserId` từ đường dẫn** | — | **GHI không kiểm tra quyền**: giảng viên bất kỳ có thể gửi ghi chú/thông báo cho học viên bất kỳ |
| onl-learning `GET …/students/{studentUserId}/notes/latest` | không | không | — | Đọc ghi chú tuỳ ý (theo `scheduleId` + `studentUserId`) |

Lưu ý: những mục "không" ở cột role/ownership được suy ra từ source; **chưa chạy thật** để xác nhận cấu hình triển khai (vd. có tường lửa/Traefik chặn đường dẫn `admin` hay không — **KHÔNG XÁC MINH ĐƯỢC** từ source).

## 4. Khoảng trống phân quyền khi chuyển sang backend chung

1. **Backend chung chưa có** endpoint "lớp/buổi/bài nộp/chấm bài của giảng viên"; endpoint tương tự (`/classes`, `/classes/{id}/sessions`) là ADMIN-only và khác dữ liệu (xem ma trận ở `docs/B0-IDENTITY-AUTHORIZATION-CONTRACT.md` mục 6).
2. **Định danh giảng viên ↔ lớp theo email** (HSK) không có tương đương theo userId; cần mô hình phân công theo userId hoặc quy tắc ánh xạ rõ ràng (B0).
3. **`/admin/*` không có kiểm tra role** ở HSK cũ — không được sao chép.
4. **Quy tắc phản hồi từ chối không nhất quán**: 403 (class sessions), `200 []` (students có classId lạ), 403 chung ở attempt, không kiểm tra ở nhiều nơi.
5. **`scheduleId` (syllabusScheduleId) dùng chung giữa nhiều lớp** nên không đủ để xác định phạm vi; HSK để `classId` tuỳ chọn ở nhiều endpoint (đã từng có lỗi đếm lẫn học viên giữa các lớp, tự ghi trong comment).
6. **Thao tác ghi** (ghi chú giảng viên, chấm điểm, gửi kết quả, duyệt báo cáo AI) cần kiểm tra quyền riêng, `classId` bắt buộc, audit, chống gửi trùng.
7. **Mentor**: chưa có chính sách truy cập lớp.
8. **Điểm số tính ở frontend cũ** (`computeAttemptScoreFromQuestions` sau N lời gọi `GET /grading/attempts/{id}` cho mỗi bài đã nộp) — nên backend trả điểm cuối cùng.

## 5. Đối chiếu frontend cũ: dữ liệu nào do client cung cấp

HSK cũ truyền trong URL/query: `classId`, `courseId`, `scheduleId`, `title`, `userId` (học viên), `studentName`, `studentEmail` (cho phân tích điểm danh). **Không** truyền email giảng viên. Frontend mới giữ nguyên các tham số URL này **cho điều hướng** nhưng không dùng chúng như căn cứ quyền; mọi quyết định quyền phải ở server (B0).

## 6. Phân loại chính xác READ/WRITE của các route còn lại

Đã đọc `submission-list-page.tsx`, `learning-analysis-list-page.tsx`, `learning-analysis-detail-page.tsx`, `lesson-detail-page.tsx`, `grading-workspace-page.tsx`, `class-management.api.ts`, `learning-analysis.api.ts`.

**Đính chính điểm chưa thống nhất:** báo cáo M4A nhóm "learning-analysis (+/detail)" cùng chung phần ghi chú/báo cáo AI; M4B gọi "learning-analysis" là màn đọc. Cả hai đúng ở phạm vi khác nhau: **`/learning-analysis` (danh sách) chỉ ĐỌC; `/learning-analysis/detail` là hỗn hợp ĐỌC + GHI**.

| Route | Loại | Chi tiết | API gọi |
|---|---|---|---|
| `/instructor/list-class/submissions` (SubmissionListPage, 203 dòng) | **CHỈ ĐỌC** | Breadcrumb 3 cấp; tìm kiếm (tên, mã học viên, email); danh sách học viên có vòng tròn chuyên cần, thẻ điểm, nút "Chi tiết" **chỉ điều hướng** sang `/grading?...&view=detail`. Tham số URL: `classId`, `courseId`, `scheduleId`, `title`. Không gọi API nếu thiếu `scheduleId` | `GET /grading/schedules/{scheduleId}/students?classId=`, rồi **mỗi bài đã nộp** `GET /grading/attempts/{attemptId}` để tự tính điểm (N+1) |
| `/instructor/list-class/learning-analysis` (LearningAnalysisListPage, 167 dòng) | **CHỈ ĐỌC** | Danh sách học viên + nút điều hướng sang `/detail` (kèm `studentEmail`) | `GET /grading/schedules/{id}/students?classId=` (cùng enrich N+1) |
| `/instructor/list-class/learning-analysis/detail` (442 dòng) | **HỖN HỢP** | **Đọc:** bài tập của buổi, điểm theo kỹ năng, chuyên cần (CMS), nhận xét gần nhất, báo cáo AI hiện có. **GHI (3):** (1) **Gửi nhận xét cho học viên** (`handleSendNote`: `POST /grading-classes/{classId}/schedules/{scheduleId}/students/{userId}/notes` ⇒ lưu + phát thông báo cho học viên); (2) **Tạo nhận xét AI** (`handleGeneratePersonalization`: `POST /grading/schedules/{s}/students/{u}/personalization/snapshot?classId&forceNewVersion` ⇒ kích hoạt tạo báo cáo AI-CNH); (3) **Duyệt nhận xét AI** (`handleApproveReport`: `POST …/reports/{reportId}/approve?classId`) | Đọc: `getLessonDetail`, `getStudentModules`, `getStudents`, `GET …/attendance-analysis` (email), `GET …/notes/latest`, `GET …/personalization` |
| `/instructor/list-class/grading` (GradingWorkspacePage, 599 dòng) | **HỖN HỢP (nhiều GHI)** | Đọc: bài làm của học viên (N lời gọi). **Ghi:** chấm điểm từng câu (`PUT /grading/answers/{id}` hoặc `PUT /grading/attempts/{id}/questions/{q}`), **gửi kết quả cho học viên** (`POST /grading/attempts/{id}/send`) | — |
| `/instructor/list-class/lesson-detail` (LessonDetailPage, 485 dòng) | **UI CHỈNH SỬA CỤC BỘ (hiện KHÔNG GHI thật)** | Trình soạn: thêm/xoá chủ đề, bài, câu hỏi, đáp án, âm thanh, khoá/mở khoá; nút "Lưu" gọi `classGradingApi.saveLessonDetail`. **Ở chế độ thật hàm này là `Promise.resolve({ success: true, data })` — KHÔNG gọi backend** nhưng vẫn hiện toast **"Đã lưu chi tiết bài học"** (thành công giả). Đọc: `getScheduleModulesByScheduleId` rồi `getQuizzesByStudySetId` + `getQuizById` cho từng bài (N+1) | `GET` chuỗi onl-learning + quiz |

Hệ quả: (a) KHÔNG được port nguyên `lesson-detail` (sẽ mang theo "lưu giả"); (b) KHÔNG phân loại `learning-analysis/detail` và `grading` là chỉ đọc; (c) chỉ `submissions` và `learning-analysis` (danh sách) là **chỉ đọc thật**.

## 7. Chức năng có thể chuyển UI an toàn / bắt buộc chờ hợp đồng

| Hạng mục | UI trước khi backend xong? | Điều kiện |
|---|---|---|
| `submissions` (toàn bộ) | **Có thể** (UI + WAITING FOR BACKEND, như M4A/M4B) | Không có thao tác ghi; nút "Chi tiết" điều hướng sang `grading` (NOT_MIGRATED ⇒ placeholder). Nhưng **API chỉ tích hợp được sau B0** (đọc dữ liệu học viên/điểm) |
| `learning-analysis` (danh sách) | **Có thể** | Giống trên; điều hướng sang `/detail` (placeholder) |
| `learning-analysis/detail` — phần đọc | Có thể về UI nhưng nên **tách**: không hiển thị nút ghi khi chưa có hợp đồng | Cần B0 cho điểm danh/ghi chú gần nhất/AI; email học viên từ URL KHÔNG được là căn cứ quyền |
| `learning-analysis/detail` — gửi nhận xét, tạo/duyệt báo cáo AI | **Chờ hợp đồng + quyền server** | Ghi + thông báo + AI; cần kiểm tra quyền riêng, `classId` bắt buộc, audit, chống gửi trùng (B0 mục 5) |
| `grading` | **Chờ** | Ghi điểm/gửi kết quả; thuộc phạm vi sau |
| `lesson-detail` | **Chờ quyết định sản phẩm** | Cần xác định hợp đồng lưu thật; không port "lưu giả" |

## 8. Đề xuất phạm vi M4C.1 (sau khi B0 được thống nhất)

**M4C.1 = màn `submissions` (`/instructor/list-class/submissions`), chỉ đọc** — nhỏ, rõ ràng, nghiệm thu được:
- Port đúng DOM/CSS của `SubmissionListPage` (khối `cm-submission-*` đã có trong `class-management.css`), tìm kiếm, vòng tròn chuyên cần (antd Progress), thẻ điểm, nút chi tiết điều hướng sang `grading` (placeholder, query đúng contract cũ).
- Tham số URL an toàn như M4B (`scheduleId` bắt buộc; `classId` kiểm tra; thiếu ⇒ không gọi API); không gửi email/định danh.
- API: `GET …/students` WAITING FOR BACKEND; **không** tự tính điểm bằng N+1 ở frontend mới — chờ backend trả điểm tổng (nếu backend chưa có thì hiển thị đúng giá trị backend trả, không suy ra); so ảnh với HSK cũ (build production) bằng fixture.
- Ngoài phạm vi: `grading`, `lesson-detail`, `learning-analysis/detail`, bất kỳ thao tác ghi nào. `learning-analysis` (danh sách) có thể làm ngay sau M4C.1 với cùng khung.
Điều kiện bắt đầu: B0 được backend xác nhận ở mức "đã chọn mô hình định danh + quy tắc 401/403/404" (mục 11 của `B0-IDENTITY-AUTHORIZATION-CONTRACT.md`); nếu chưa, M4C.1 vẫn có thể làm phần UI với trạng thái WAITING FOR BACKEND nhưng **không được coi là tích hợp**.

## 9. Authentication thật (M2) — việc chủ dự án/người phụ trách phải cung cấp

M2 **REAL AUTH VERIFICATION PENDING**; mock không tương đương Auth thật. Cần:
1. **Môi trường staging an toàn** (Auth + backend lớp học) tách khỏi production, không dữ liệu thật của học viên.
2. **Tài khoản thử theo role**: Admin, Teacher (≥ 2 giảng viên khác nhau để thử truy cập chéo lớp), Mentor, Teacher-manager, Collaborator, User/học viên (thuộc lớp của giảng viên A, không thuộc lớp của B), tài khoản không có role.
3. **Dữ liệu lớp thử**: ≥ 2 lớp của giảng viên A, 1 lớp của giảng viên B, buổi dùng chung `syllabusScheduleId` giữa hai lớp, học viên có bài nộp.
4. **Domain và cookie**: giá trị `ROOT_DOMAIN`, `COOKIE_DOMAIN`, `SameSite`, `Secure`; cơ chế trả token (production không trả token trong body, chỉ cookie HttpOnly; non-prod có token ở body/hash); CORS prod chỉ `https` thuộc `ROOT_DOMAIN`; frontend (`NEXT_PUBLIC_AUTH_FRONTEND_URL`, `NEXT_PUBLIC_AUTH_API_BASE_URL`) phải cùng domain gốc để cookie dùng chung.
5. **Quy trình kiểm thử phiên thực tế**: đăng nhập → cookie → `GET /users/me` → hết hạn access → refresh một lần → logout; role đổi ⇒ hiệu lực sau khi token mới; thử truy cập chéo (B0 mục 9).
Không tự gọi Auth production; không dùng tài khoản thật.

## 10. Quyết định cần chủ dự án / người phụ trách backend xác nhận

Xem danh sách đánh số D1–D10 ở `docs/B0-IDENTITY-AUTHORIZATION-CONTRACT.md` mục 10 (định danh chính, mô hình phân công, chính sách Mentor/Admin/Teacher-manager, 403 hay 404, `classId` bắt buộc, nơi đặt kiểm tra, điểm số do backend tính, chính sách ghi chú/AI, audit).

## 11. Giới hạn của khảo sát

- Chỉ đọc source; **không chạy** hệ thống nên chưa xác nhận hành vi triển khai thật (gateway/tường lửa, dữ liệu CMS).
- Không có source CMS/ERP trong workspace: nguồn dữ liệu phân công lớp (`tutorEmail`, `teacherId`), `/lms-integration/*`, `/me/classes` của CMS **KHÔNG XÁC MINH ĐƯỢC**.
- Giá trị TTL token ở prod, cấu hình cookie thật: chưa kiểm tra.
- Không có thay đổi nào đối với backend, Auth, database, role mapping, hay màn hình đã chuyển.
