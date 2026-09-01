# B0 — Báo cáo xác minh backend và đề xuất để thống nhất hợp đồng

Ngày: 2026-10-26. Trạng thái B0: **OPEN (P0)** — báo cáo này **không** đánh dấu RESOLVED.
Phạm vi: **chỉ đọc source** của `LMS_Backend` (quiz, onl-learning, api-gateway, common-framework), `Authentication_Backend`, `LMS_IELTS/backend`. Không sửa code/schema/migration, không chạy hệ thống, không gọi production, không đọc dữ liệu thật.
Giới hạn bằng chứng: mọi kết luận là **phân tích tĩnh**. Không có kết quả chạy thật nào (chưa test T1–T20 trên staging). Nguồn CMS/ERP và AI-CNH không nằm trong workspace nên các điểm phụ thuộc hai hệ này ghi **KHÔNG XÁC MINH ĐƯỢC**.

Nhãn phân loại theo yêu cầu: **CONFIRMED VULNERABILITY** (xác nhận trong source, không có lớp nào chặn), **MITIGATED BY ANOTHER LAYER**, **POTENTIAL RISK** (phụ thuộc điều kiện/không xác minh được), **NOT APPLICABLE**.

---

## 0. KHẨN CẤP — cần người phụ trách backend xem trước (đang được dùng, có nguy cơ lộ hoặc sửa dữ liệu)

Các endpoint dưới đây **đang được frontend HSK cũ gọi** (`LMS_Frontend/src/core/services/quiz.service.ts`, `online-course.service.ts`) nên nằm trên đường chạy thật. Gateway chỉ định tuyến (không có filter xác thực/role: thư mục `repo-api-gateway/src/main/java` chỉ có `GlobalErrorHandler` và lớp ứng dụng; route `/api/quiz/**`, `/api/online-learning/**`, `StripPrefix=2`). Docker compose chính không publish cổng của quiz/onl-learning (chỉ MySQL), nên gateway là đường vào — **nhưng ingress/WAF thật ở production không xác minh được từ source**.

| # | Endpoint | Phân loại | Bằng chứng | Hậu quả |
|---|---|---|---|---|
| U1 | `POST /grading-classes/{classId}/schedules/{scheduleId}/students/{studentUserId}/notes` | **CONFIRMED VULNERABILITY (ghi + thông báo)** | `GradingClassController.sendTeacherNote` chỉ lấy email người gọi; `GradingClassServiceImpl.sendTeacherNote` kiểm tra mỗi `studentUserId` không rỗng và `content` không rỗng, rồi `learningAnalysisNoteRepository.save` và `notificationPublisher.publish(new NotificationEvent(studentUserId, …))`. Không có: kiểm tra role, giảng viên ∈ lớp, học viên ∈ lớp, `scheduleId ∈ classId`. Cấu hình `anyRequest().authenticated()` | Mọi tài khoản đã đăng nhập (kể cả học viên) có thể ghi nhận xét vào lớp bất kỳ và **gửi thông báo tới bất kỳ `userId`**. Nội dung hiển thị cho học viên ⇒ nguy cơ giả mạo giảng viên/phishing nội bộ. Mỗi lần gọi tạo ghi chú + thông báo mới (khoá chống trùng là `note.getId()`, luôn mới) |
| U2 | `GET /grading-classes/{classId}/schedules/{scheduleId}/students/{studentEmail}/attendance-analysis` | **CONFIRMED VULNERABILITY (đọc)** | Controller không nhận `Authentication`; service chỉ gọi `cmsClient.getClassStudents(classId)` và lọc theo email trong đường dẫn | Biết `classId` là đọc được **tỷ lệ chuyên cần trung bình của cả lớp**; thêm email ⇒ thấy nhật ký điểm danh của học viên đó. Không cần là giảng viên |
| U3 | `GET /grading-classes/{classId}/schedules/{scheduleId}/students/{studentUserId}/notes/latest` | **CONFIRMED VULNERABILITY (đọc)** | Controller không nhận `Authentication`; repository tra `scheduleId + studentUserId`, **bỏ qua `classId`** | Đọc nhận xét giảng viên của học viên bất kỳ (kèm email giảng viên) |
| U4 | `GET /grading/admin/classes`, `GET /grading/admin/classes/{classId}/students` (quiz); `GET /grading-classes/admin/all|{classId}/sessions|{classId}/students` (onl-learning) | **CONFIRMED VULNERABILITY (đọc, PII)** | Không có `@PreAuthorize` nào trong `GradingController`/`GradingClassController`; cả hai service có `@EnableMethodSecurity` nhưng chỉ các controller khác dùng nó; `anyRequest().authenticated()` | Mọi tài khoản đã đăng nhập liệt kê được toàn bộ lớp và danh sách học viên (email/họ tên/điện thoại/điểm). Cùng service, các controller quản trị khác **có** `@PreAuthorize` (vd. `SystemSyncController`) ⇒ đây là thiếu sót nhất quán, không phải chủ ý |
| U5 | `GET /leads` (danh sách đăng ký tư vấn: `fullName`, `email`, `phone`, `note`) — **ngoài phạm vi B0 nhưng phát hiện trong lúc xác minh** | **CONFIRMED VULNERABILITY (đọc, PII, không cần đăng nhập)** | `onl-learning/config/SecurityConfig`: `requestMatchers(GET, "/leads/**").permitAll()`; `LeadController.getLeads` có dòng `@PreAuthorize` **bị comment**; `LeadRegistrationResponse` chứa `fullName, email, phone, note` | Truy cập ẩn danh qua gateway (`/api/online-learning/leads`) có thể liệt kê lead. (Comment ở config cho thấy `/leads/all` "CMS pull" là chủ ý public; `/leads` thì có vẻ do `/leads/**` phủ rộng.) `GET /leads/export` **có** `@PreAuthorize` ⇒ an toàn |
| U6 | `GET /schedule-modules/all-student-progress` — ngoài phạm vi B0 | **CONFIRMED VULNERABILITY (đọc, PII, không cần đăng nhập)** | `permitAll` trong `SecurityConfig` (comment "Public: lấy tiến độ tổng hợp"); response gồm `userId`, `userEmail`, tiến độ từng module của **mọi học viên** | Lộ định danh + tiến độ học viên cho người ẩn danh |

**Khuyến nghị tạm thời (đề xuất, backend quyết định, frontend không thực hiện):** chặn U4–U6 tại ingress hoặc thêm kiểm tra role ngay; U1–U3 cần kiểm tra quyền theo lớp (M3–M7 của hợp đồng B0). Nếu `/leads/all` và `all-student-progress` do CMS gọi, thay `permitAll` bằng token dịch vụ (`X-Internal-Token`) hoặc danh sách IP — cần xác nhận người gọi thực tế (KHÔNG XÁC MINH ĐƯỢC từ source).

---

## 1. Kết quả xác minh các rủi ro bảo mật (báo cáo mục 1)

### R1 — Thiếu kiểm tra role tường minh ở grading/admin
- Xác minh toàn đường: `SecurityConfig` (quiz và onl-learning) → controller → service → client.
  - Không `@PreAuthorize`/`hasRole` trong `GradingController` (quiz) và `GradingClassController` (onl-learning).
  - Service không đọc role (`AuthPrincipal.roles()` không được dùng trong `GradingServiceImpl`/`GradingClassServiceImpl`).
  - Gateway: không có filter.
- **Admin endpoints (U4): CONFIRMED VULNERABILITY.**
- **Endpoint giảng viên (đọc theo lớp/buổi/học viên/bài làm/ghi chấm): MITIGATED BY service-level ownership** về *dữ liệu*: sở hữu được suy từ email của principal (xem R3). Nhưng **role vẫn không được kiểm** ⇒ ranh giới an ninh chỉ là "email có nằm trong TUTOR/CMS hay không". Ghi nhận thêm: học viên không có hàng `TUTOR` nên lấy được rỗng/403; việc CMS `GET /lms-integration/teachers/{email}/classes` trả gì cho email học viên **KHÔNG XÁC MINH ĐƯỢC**.
- `GET /grading/classes/{classId}/ungraded-count`: MITIGATED (gọi `getClassSchedules` ⇒ 403 nếu không phụ trách lớp).

### R2 — Ghi ghi chú không xác minh quan hệ giảng viên–lớp–học viên
- **CONFIRMED VULNERABILITY** (U1, U3). Đồng thời `SendTeacherNoteRequest.studentEmail` do client gửi và được lưu (`note.studentEmail`) mà không đối chiếu với `studentUserId` — **POTENTIAL RISK về toàn vẹn dữ liệu**.
- Các thao tác ghi trong quiz (`gradeAnswer`, `gradeQuestion`, `finalize`, `send`, `sendSchedule`, `snapshot`, `approve`) **có** kiểm tra: `assertTeacherCanAccessAttempt` / `assertTeacherCanAccessScheduleStudent` ⇒ **MITIGATED BY service-level check**; `snapshot`/`approve` còn bắt buộc `classId` + `ownsClass` + học viên ∈ lớp. Hai điểm yếu còn lại: (a) `reportId` của `approve` không được ràng buộc với (học viên, buổi, lớp) — chỉ chuyển cho AI-CNH `/api/v1/ai-cnh/bridge/reports/{id}/approve` ⇒ **POTENTIAL RISK (AI-CNH kiểm tra hay không: KHÔNG XÁC MINH ĐƯỢC)**; (b) không có khoá/phiên bản khi chấm đồng thời ⇒ ghi cuối thắng (**POTENTIAL RISK**).

### R3 — Xác định dữ liệu theo email
- Đúng như báo cáo: `GradingClassController.extractEmail` lấy `principal.email()` (từ JWT), nên **email không do client gửi** ở nhóm endpoint giảng viên ⇒ không phải lỗ hổng tự thân.
- **POTENTIAL RISK nghiêm trọng khi kết hợp** (mới phát hiện, chưa ghi ở khảo sát M4C.0):
  1. `AuthServiceImpl.signup` tạo tài khoản `emailVerified=false` rồi **`return jwtTokenService.issueTokens(saved)` ngay** — cấp access token mang `email` do người dùng khai và `email_verified=false`. (Refresh bị từ chối tới khi xác minh; `login` cũng yêu cầu xác minh.)
  2. Quiz/onl-learning **không** đăng ký `EmailVerifiedFilter` (`SecurityConfig` của hai service không có; filter này không phải `@Component`; chỉ `repo-realtime` và `LMS_IELTS` repo-lms dùng) và không đọc `principal.emailVerified()`.
  3. Hệ quả: nếu một email giảng viên **có trong dữ liệu CMS/`TUTOR` nhưng chưa có tài khoản Auth**, người khác đăng ký email đó sẽ nhận token và qua các kiểm tra sở hữu theo email trong thời hạn access token. Điều kiện tiên quyết thực tế (email chưa đăng ký) làm rủi ro mang tính **POTENTIAL**, nhưng khi xảy ra thì kéo theo cả U1–U4. Đồng thời kẻ chiếm email giữ một tài khoản chưa xác minh khiến giảng viên thật không đăng ký được.
- Email không bất biến theo hợp đồng (xem mục 2). Email đổi/thiếu/trùng khi nhập — mục 3.

### R4 — `scheduleId` dùng chung giữa nhiều lớp
- `scheduleId` ở HSK thực chất là **`syllabusScheduleId`** — giá trị chung cho mọi lớp cùng giáo trình (chính mã nguồn và comment ở `GradingServiceImpl` xác nhận bug đã gặp ở `hasClassPendingGrading`/`getClassSchedules`).
- Phân loại theo endpoint:
  - `GET /grading/schedules/{scheduleId}/ungraded-count`: **CONFIRMED VULNERABILITY (mức thấp)** — `existsByScheduleIdAndIsOfficialTrueAndGradingStatus` đếm toàn cục, không kiểm tra quyền; trả boolean cho mọi người đăng nhập, và sai ngữ nghĩa giữa các lớp. Đang được frontend cũ gọi.
  - `assertTeacherCanAccessScheduleStudent`: **MITIGATED** — hợp roster của **mọi lớp của giảng viên có chứa buổi đó**, nên dữ liệu học viên lớp khác của giảng viên khác không bị lộ. **POTENTIAL RISK (thiết kế):** bài làm (`QuizAttempt`) gắn `(scheduleId, userId)`, không gắn lớp ⇒ nếu một học viên thuộc hai lớp của hai giảng viên cùng giáo trình, **cả hai** giảng viên đọc/chấm cùng bài; ghi chú `notes/latest` cũng dùng chung theo `(scheduleId, studentUserId)`.
  - `getScheduleStudents(scheduleId, classId)`: `classId` hợp lệ ⇒ lấy đúng roster lớp đó; không kiểm tra `scheduleId ∈ classId` ⇒ **POTENTIAL RISK (đúng-sai nghiệp vụ, không thấy rò dữ liệu)** vì lượt join bài làm bị giới hạn theo `userId` của roster.
  - Khi thiếu `classId`: lấy **lớp đầu tiên khớp** (comment trong code ghi là tương thích client cũ) ⇒ **POTENTIAL RISK** cho nghiệp vụ.
  - Ngoài ra: giảng viên trở thành `TUTOR` của **cả lớp** nếu xuất hiện là `tutorEmail` của **một buổi** (`TimetableSyncServiceImpl` dòng ~216, `collectParticipant(sessionClassId, ROLE_TUTOR, session.tutorEmail())`) ⇒ phạm vi quyền thô hơn "dạy buổi đó" — **POTENTIAL RISK (chính sách)**.

### R5 — 200 với danh sách rỗng khi không có quyền
- `GET /grading/schedules/{id}/students?classId=X` với `X` không thuộc giảng viên: `resolveStudentsForSchedule` trả `List.of()` ⇒ **200 `[]`** — **CONFIRMED (che việc từ chối)**. (Không rò dữ liệu; sai tín hiệu.)
- Nơi khác từ chối đúng bằng `403`: `getClassSessions`, `getClassStudents`, `assertTeacherCanAccess*`, `ownsClass` của personalization.
- Các chỗ **nuốt lỗi và trả giá trị mặc định**: `hasClassPendingGradingOrFalse` (lỗi ⇒ `false`), `getAdminClassStudents` (lỗi lấy buổi ⇒ danh sách rỗng, chỉ log). **POTENTIAL RISK** về độ tin cậy dữ liệu (không phải quyền).
- CMS không khả dụng và không có cache: `CmsEnvelope.cmsUnavailable()` ⇒ `data=null` ⇒ `safeData` rỗng ⇒ `assertCmsClassAccess` ném **403 "không phụ trách lớp"** — **đóng-khi-lỗi (fail closed) là đúng**, nhưng mã 403 gây hiểu nhầm; nên là 502/503.

### Kết luận tổng
| Phát hiện của khảo sát frontend | Kết quả xác minh sâu |
|---|---|
| Thiếu role check ở grading/admin | **CONFIRMED** cho admin endpoints (U4); endpoint giảng viên: thiếu role nhưng **MITIGATED** về dữ liệu bởi ownership theo email |
| Ghi ghi chú thiếu xác minh | **CONFIRMED** (U1) |
| Endpoint dựa trên email | Đúng, nhưng lấy từ principal; **POTENTIAL RISK** do signup cấp token chưa xác minh + không kiểm `email_verified` |
| `scheduleId` dùng chung | **CONFIRMED** (`ungraded-count`); phần còn lại **MITIGATED/POTENTIAL** |
| 200 rỗng khi không có quyền | **CONFIRMED** (`students?classId`) |
| (Điều chỉnh khảo sát cũ) `snapshot`/`approve` "classId tuỳ chọn" | **SAI** — `classId` bắt buộc ở hai endpoint này; chỉ `GET personalization` tuỳ chọn. Đã sửa ở `B0-…-CONTRACT.md` (G8) và `M4C0-SURVEY.md` |
| (Mới) attendance-analysis, notes/latest, leads, all-student-progress | **CONFIRMED** (U2, U3, U5, U6) |

---

## 2. Quyết định định danh userId / email (báo cáo mục 2)

**Đề xuất:** userId (`sub`/`uid`) từ principal là chủ thể và khoá quyền. Email là thuộc tính và khoá **ánh xạ dữ liệu cũ**.
**Bằng chứng:** userId ULID 26 ký tự, sinh một lần, `updatable=false` (`BaseEntity`); có trong mọi token (`JwtTokenServiceImpl`). `AuthPrincipal.getName()` = email-hoặc-userId nên không ổn định. `users.email` unique + not null; `AdminServiceImpl.updateUser` hiện không áp dụng trường `email` của `AdminUpdateUserRequest`; signup lưu `request.getEmail()` nguyên văn (không chuẩn hoá chữ thường; `UserRepository.findByLowerEmailIn` và `getProfilesByEmails` chuẩn hoá chữ thường khi tra cứu). Tiền lệ userId: `IdentityClient` (IELTS), `QuizAttempt.userId`, `teacher_profiles.identity_user_id`.
**Ảnh hưởng hệ thống:** onl-learning (`timetable_class_participants` theo email), quiz (`GradingServiceImpl` suy roster theo email rồi đổi sang userId qua `by-emails`), notification/ai-practice nếu dùng userId.
**Rủi ro:** (1) email đổi sau này làm mất/nhầm quyền; (2) tái sử dụng email; (3) signup chưa xác minh (R3).
**Cần phê duyệt (D1):** dùng userId làm khoá phân quyền; **bắt buộc** mọi quyết định quyền chỉ dựa trên principal (M1); `email_verified=true` là điều kiện cần cho mọi endpoint giảng viên/admin (D1b — đề xuất mới).

## 3. Phương án ánh xạ phân công lớp từ CMS (báo cáo mục 3)

**Hiện trạng (xác minh từ source):**
- Nguồn: CMS `/students/courses-timetable-emails` (snapshot đồng bộ) và `/lms-integration/teachers/{email}/classes` (tra theo email, có cache Redis 180 giây).
- Đồng bộ: `SystemSyncScheduler` mặc định **01:00 hằng đêm** (`system-sync.auto-sync.cron`, bật mặc định), có endpoint đồng bộ thủ công (`SystemSyncController`, ADMIN/TEACHER_MANAGER) và đồng bộ theo từng lớp (`deleteStaleParticipantsForClass`). `cleanupOldSnapshot` **xoá** mọi dòng `sync_version <> mới`. Khi CMS lỗi, `syncAll` **bỏ qua** (giữ snapshot cũ, không xoá).
- Chuẩn hoá email: `normalizeEmail` = trim + chữ thường; email rỗng bị bỏ qua (`collectParticipant` return); trùng bị khử bằng khoá `(class_id, email, role)` (cả dedupe trong bộ nhớ lẫn UNIQUE `uk_tcp_class_email_role`).
- Vai trò chỉ `TUTOR`/`STUDENT`; `TUTOR` lấy từ `teacherEmail` cấp lớp **và** `tutorEmail` cấp buổi.

**Các trường hợp bạn yêu cầu xác minh:**
| Trường hợp | Hiện xử lý | Rủi ro |
|---|---|---|
| Email thiếu ở CMS | Bỏ qua, không tạo dòng | Giảng viên không thấy lớp (fail closed) |
| Email trùng | Gộp theo `(class, email, role)` | Không có lỗi phân quyền; mất thông tin phân biệt nếu hai người dùng chung email (vô lý với Auth unique) |
| Chữ hoa/thường, khoảng trắng | Chuẩn hoá chữ thường + trim ở sync/tra cứu | Biến thể khác (dấu chấm Gmail, `+tag`) **không** gộp ⇒ mất quyền (fail closed) |
| Email trong CMS khác email trong Auth | Không khớp ⇒ mất quyền | Giảng viên thật bị chặn; gây áp lực "sửa nhanh" kém an toàn |
| Email ở CMS không có tài khoản Auth | Không có userId để ánh xạ | Cho phép chiếm email (R3) nếu giữ cơ chế email |
| Email đổi ở Auth | Hiện không có đường đổi trong code | Nếu bật sau này ⇒ phải có quy trình đồng bộ |
| Học viên chưa đăng ký Auth | `by-emails` **âm thầm bỏ qua** email không tìm thấy | Roster thiếu học viên; số đếm lệch |
| CMS trả danh sách rỗng thành công | `cleanupOldSnapshot` xoá hết `participants` | **POTENTIAL RISK về khả dụng** (mất quyền hàng loạt tới lần sync kế); cần chốt chặn (từ chối xoá nếu giảm đột biến) |

**Đề xuất ánh xạ (chưa duyệt):**
1. Thêm bảng phân công theo userId (tên/schema do backend quyết — **không tạo migration ở bước này**): `class_id`, `user_id`, `staff_role`, `source`, `source_email`, `synced_at`, `version`.
2. Khi đồng bộ: chuẩn hoá email → `POST /internal/profiles/by-emails` → ghi `user_id`; email không có tài khoản ⇒ **không cấp quyền** và đưa vào báo cáo đối soát.
3. `ProfileByEmailResponse` hiện **không** có `emailVerified`, `status`, `roles` ⇒ đề nghị Auth bổ sung (đề xuất cho người phụ trách Auth, chưa làm) để chỉ ánh xạ tài khoản đã xác minh, không bị khoá, có role phù hợp.
4. Giai đoạn chuyển tiếp: ghi kép (email + userId), so sánh kết quả hai cách trong log (không dùng log chứa PII), chỉ chuyển sang userId khi tỷ lệ khớp được chấp nhận.
5. Chốt chặn đồng bộ: từ chối thay snapshot khi số dòng giảm vượt ngưỡng đã thống nhất; hết hạn cache quyền ngắn hơn hoặc xoá cache khi gỡ phân công.
6. Chính sách thu hồi: xem D9.

## 4. Thiết kế Class Authorization (báo cáo mục 4)

Giữ nguyên thiết kế đã đề xuất ở `B0-…-CONTRACT.md` mục 5 (chủ thể userId; `ClassAccessService` ở service sở hữu dữ liệu lớp), bổ sung sau xác minh:
- Hàm cần có: `assertRole`, `assertCanAccessClass(principal, classId)`, `assertScheduleInClass(classId, scheduleId)` (phân biệt **buổi cụ thể của lớp** với `syllabusScheduleId` dùng chung), `assertStudentInClass(classId, studentUserId)`, `assertAttemptInScope(classId, scheduleId, studentUserId, attemptId)`, `assertCanWrite(principal, classId, action)`.
- Quy tắc **đóng-khi-lỗi**: lỗi CMS/Auth/DB khi tra phân công ⇒ 502/503, không cho phép, không trả rỗng.
- Quy tắc **không tin client**: bỏ qua email/role/teacherId từ query/body/header (M1); không nhận email học viên làm khoá (M12).
- Hậu quả thiết kế đã thấy trong source cần giải quyết rõ: bài làm hiện gắn `(scheduleId, userId)` chứ không gắn lớp ⇒ phải quyết **ai là chủ bài làm** khi học viên học nhiều lớp cùng giáo trình (D7b — mới).
- Frontend ẩn menu **không** là kiểm soát; mọi endpoint phải tự kiểm tra (M2–M7).

## 5. Ma trận vai trò và quyền (báo cáo mục 5) — đề xuất, chưa duyệt

Ký hiệu: ✔ cho phép; ○ chỉ khi được phân công lớp; ✖ không; ? cần quyết định.
| Hành động | ADMIN | TEACHER_MANAGER | TEACHER | MENTOR | COLLABORATOR | USER/học viên |
|---|---|---|---|---|---|---|
| Danh sách lớp của tôi (`/me`) | ✖ (không có lớp riêng) | ○ ? | ○ | ○ | ✖ (chưa tự cấp) | ✖ |
| Danh sách lớp toàn hệ thống | ✔ | ? | ✖ | ✖ | ✖ | ✖ |
| Buổi/học viên/bài nộp của lớp (đọc) | ✔ | ? | ○ | ○ (D4) | ✖ | ✖ |
| Chấm điểm, chốt bài | ? (khuyến nghị ✖ nếu không phân công) | ? | ○ | ? (D4) | ✖ | ✖ |
| Gửi kết quả cho học viên | ? | ? | ○ | ? (D4) | ✖ | ✖ |
| Gửi nhận xét giảng viên | ? | ? | ○ | ? (D4) | ✖ | ✖ |
| Tạo/duyệt báo cáo AI | ? | ? | ○ | ? | ✖ | ✖ |
| Đồng bộ CMS thủ công | ✔ | ✔ (hiện đã có) | ✖ | ✖ | ✖ | ✖ |
Ghi chú: `ROLE_TEACHER_MANAGER` hiện đã có quyền ở các controller khóa học/đồng bộ (`SecurityConfig`/`@PreAuthorize`), nên chính sách cho nhóm này thiên về "quản lý" hơn "dạy"; **Collaborator chưa được cấp quyền** theo yêu cầu. Mọi ô "?" thuộc D3–D5.

## 6. API đã có / thiếu / một phần (báo cáo mục 6)

Rà theo từng chức năng: **backend chung = `LMS_IELTS/backend` (repo-lms)**. Không giả định tương đương theo tên.
- **Danh sách lớp giảng viên**: HSK `GET /grading/classes` ⇒ có (nhưng phụ thuộc email). IELTS: `GET /classes` ADMIN-only, dữ liệu khác; `GET /me/classes` lấy từ CMS theo token — chưa xác minh dùng được cho giảng viên và `teacherId` CMS có trùng Auth userId hay không **KHÔNG XÁC MINH ĐƯỢC** ⇒ **PARTIAL/MISSING**.
- **Buổi theo lớp**: HSK `GET /grading/classes/{classId}/schedules` ⇒ có, 403 đúng. IELTS `GET /classes/{classId}/sessions` ADMIN-only, `ClassSessionResponse` thiếu `title/topic/syllabusScheduleId/hasAssignment/hasPendingGrading` ⇒ **INCOMPATIBLE → PARTIAL**.
- **Danh sách lớp Admin**: HSK `GET /grading/admin/classes` có nhưng **không có role check (U4)**; IELTS `GET /classes` (ADMIN) khác trường ⇒ **PARTIAL**.
- **Học viên theo buổi/lớp, bài nộp, phân tích, điểm danh, ghi chú, chấm, gửi kết quả, báo cáo AI**: HSK có nhưng các điểm yếu ở mục 1; IELTS **MISSING** (các controller chấm của IELTS là admin-only, xem `AssessmentGradingManagementController`).
- Hợp đồng chi tiết từng endpoint: `B0-IDENTITY-AUTHORIZATION-CONTRACT.md` mục 6 (cập nhật 2026-10-26).

## 7. DTO và mã lỗi đề xuất (báo cáo mục 7)

Giữ nguyên `B0-…-CONTRACT.md` mục 7–8. Bổ sung sau xác minh:
- `GradingStudentResponse`/lớp/buổi: backend tính `totalScore`, `completionRate`, `submittedAny`, `ungradedCount`, `hasPendingGrading` **theo (lớp, buổi cụ thể)**, không theo `syllabusScheduleId` thô.
- Thêm `UPSTREAM_UNAVAILABLE` 502/503 thay cho 403 khi CMS/Auth lỗi (hiện CMS lỗi ⇒ 403).
- Thân lỗi `{status, code, message, traceId}`; không đưa email vào `message`/log (hiện `CmsClient` log email giảng viên ở mức WARN).
- DTO ghi: `idempotencyKey` bắt buộc cho gửi nhận xét/gửi kết quả; `version` (khoá lạc quan) cho chấm điểm.
- `SendTeacherNoteRequest`: bỏ `studentEmail` do client gửi; backend tự lấy từ userId đã kiểm tra thuộc lớp.

## 8. Kế hoạch bảo vệ endpoint ghi dữ liệu (báo cáo mục 8)

| Thao tác | Hiện trạng | Cần có |
|---|---|---|
| Gửi nhận xét (U1) | Không kiểm tra; mỗi lần gọi = 1 ghi chú + 1 thông báo | Role + `assertCanWrite` + `scheduleId∈classId` + `studentUserId∈lớp`; `idempotencyKey`; giới hạn tần suất/độ dài; bỏ `studentEmail` client; audit; không phát thông báo khi từ chối |
| Chấm điểm câu / chốt bài | Có ownership; không phiên bản/khoá; không audit riêng (chỉ `gradedBy/gradedAt`) | Khoá lạc quan (`version`); audit ai-khi-nào-giá trị cũ/mới; chặn sửa bài đã `RETURNED` theo chính sách |
| Gửi kết quả (`send`) | Có ownership; tự idempotent một phần (`hasNewReturns`); gửi gộp trả lặng im khi không có bài `GRADED` | Mã rõ ràng cho "không có gì để gửi"; idempotency; audit; thông báo một lần |
| Snapshot/duyệt báo cáo AI | Có ownership + `classId` bắt buộc; `reportId` không ràng buộc | Ràng buộc `reportId` thuộc (học viên, buổi, lớp) ở LMS trước khi gọi AI-CNH; xác nhận AI-CNH cũng kiểm tra; giới hạn tần suất tạo snapshot; audit |
| Mọi ghi | Tin `anyRequest().authenticated()` | `email_verified` bắt buộc; role; log lỗi quyền chỉ chứa userId/classId/scheduleId |

## 9. Kết quả đánh giá T1–T20 (báo cáo mục 9)

**Đây là đánh giá tĩnh trên backend HSK hiện có (tức hệ mà frontend mới sẽ phải nối hoặc thay thế). Chưa chạy thật** — các ô "không thể kết luận tĩnh" cần chạy trên staging. Backend chung (IELTS) **không có endpoint tương ứng** nên các ca đó **NOT APPLICABLE** cho tới khi endpoint được xây.

| # | Kịch bản | Kết quả tĩnh | Giải thích |
|---|---|---|---|
| T1 | Không token/hết hạn/sai chữ ký | **PASS (tĩnh)** | `anyRequest().authenticated()`; đường grading không nằm trong danh sách `permitAll` |
| T2 | Học viên gọi endpoint giảng viên và `/admin/*` | **FAIL** (admin: U4; ghi chú: U1; điểm danh: U2) / **PARTIAL** (endpoint đọc có ownership theo email, kết quả với CMS **KHÔNG XÁC MINH ĐƯỢC**) | Không có role check |
| T3 | Teacher A đọc buổi của lớp B | **PASS** cho `/grading/classes/{id}/schedules` & onl `/sessions` (403) / **FAIL** cho `students?classId`(200 `[]`), U2, U3 | |
| T4 | `classId` của mình + `scheduleId` của lớp khác | **PARTIAL** — `students` không kiểm tra, không thấy rò dữ liệu; `notes` ghi/đọc không kiểm tra (U1/U3) | |
| T5 | `syllabusScheduleId` dùng chung | **PARTIAL** — dữ liệu học viên bảo vệ bằng roster; `ungraded-count` toàn cục **FAIL**; `notes/latest` chung giữa các lớp **FAIL** | |
| T6 | `studentUserId` ngoài lớp | **PASS** cho attempts/chấm/personalization (403); **FAIL** cho `notes` (U1) và điểm danh theo email (U2) | |
| T7 | Đổi `attemptId`/`answerId` | **PASS (tĩnh)** — `assertTeacherCanAccessAttempt` (roster) | |
| T8 | Email/role giả | **PASS** cho endpoint giảng viên (lấy từ principal); **FAIL** U2 (email từ đường dẫn) và `studentEmail` trong body ghi chú được lưu nguyên | |
| T9 | Ghi chú tới học viên ngoài lớp | **FAIL (CONFIRMED)** — vẫn phát thông báo | |
| T10 | Điểm danh với email học viên ngoài lớp | **FAIL** — không xác thực; vẫn trả trung bình lớp | |
| T11 | Mentor chưa phân công | **PASS** cho endpoint có ownership (không có dòng TUTOR) / **FAIL** cho U1–U4; chưa có chính sách Mentor | |
| T12 | Collaborator / Teacher-manager | **KHÔNG CÓ CHÍNH SÁCH** — mọi người đã đăng nhập được xử lý như nhau | |
| T13 | Gỡ phân công, token cũ | **PARTIAL** — quyền kiểm theo dữ liệu nên không phụ thuộc token; nhưng snapshot chỉ cập nhật khi sync (mặc định 01:00 hằng đêm hoặc thủ công) + cache CMS 180 giây ⇒ độ trễ thu hồi tới ~1 ngày (chưa chạy thật) | |
| T14 | Đổi role, token cũ | **NOT APPLICABLE hiện tại** — role không được dùng để quyết định (chính là lỗ hổng R1) | |
| T15 | Lớp không tồn tại vs không được phân công | **PASS (tĩnh)** cho `getClassSessions` (cùng 403, không lộ); `students?classId` cùng `200 []` | |
| T16 | Gửi trùng | **FAIL** cho ghi chú (mỗi POST = 1 ghi chú + 1 thông báo); **PARTIAL (tốt hơn)** cho `send` (có `hasNewReturns`) | |
| T17 | Hai giảng viên chấm đồng thời | **FAIL (POTENTIAL)** — không khoá lạc quan, ghi cuối thắng | |
| T18 | ID lạ/độ dài lớn | **KHÔNG KẾT LUẬN ĐƯỢC TĨNH** — `classId`/`scheduleId` được nối thẳng vào URL nội bộ (`"/grading-classes/" + classId + …` trong `OnlLearningGradingClient`) mà không mã hoá; `StrictHttpFirewall` của Spring có khả năng chặn `;`/`%2F` nhưng cần kiểm chứng | |
| T19 | Log lỗi quyền | **PARTIAL** — không thấy log token; `CmsClient` log email giảng viên, `EmailVerifiedFilter` log userId; cần soát PII | |
| T20 | CMS/Auth lỗi khi tra phân công | **PASS (fail closed)** khi không có snapshot/cache (kết quả 403, nên là 502/503); snapshot `TUTOR` hiện có vẫn cấp quyền khi CMS lỗi (chủ ý); cache có thể cấp quyền tối đa tới hết TTL | |

Tóm tắt: **FAIL xác nhận: T2, T9, T10, T16 (ghi chú), T17; FAIL một phần: T3, T4, T5, T6, T8, T11, T13; PASS tĩnh: T1, T7, T15, T20; chưa có chính sách: T12, T14; chưa kết luận: T18, T19.**

## 10. Quyết định D1–D10 — Đề xuất → Bằng chứng → Ảnh hưởng → Rủi ro → Cần phê duyệt (báo cáo mục 10)

| Mã | Đề xuất | Bằng chứng | Ảnh hưởng hệ thống | Rủi ro | Cần phê duyệt |
|---|---|---|---|---|---|
| D1 | userId làm khoá định danh; `email_verified=true` bắt buộc | Mục 2; signup cấp token chưa xác minh; hai service không dùng `EmailVerifiedFilter` | onl-learning, quiz, ai-practice, Auth (`by-emails` thêm trường) | Chuyển đổi dữ liệu email→userId; email chưa có tài khoản | Chọn userId; có bật chặn chưa-xác-minh ở service LMS không; có đổi `signup` để không cấp token trước xác minh không (thuộc Auth) |
| D2 | Phân công lớp theo userId + đồng bộ từ CMS qua `by-emails` | Mục 3 | Bảng mới/đồng bộ; nightly 01:00 | Email không khớp ⇒ mất quyền; CMS rỗng ⇒ xoá hàng loạt | Schema; chu kỳ đồng bộ; chốt chặn giảm đột biến; phụ trách đối soát |
| D3 | Chỉ Teacher/Mentor (đã phân công) + Admin vào API giảng viên | Hiện không có role check | Mọi controller grading | Từ chối nhầm role hợp lệ nếu chưa rõ mapping | Danh sách role chính thức |
| D4 | Mentor: đọc theo phân công; ghi (chấm/gửi/ghi chú/duyệt AI) cần quyết; Admin không ghi nếu không phân công; Teacher-manager theo chính sách quản lý | Mục 5 | Ma trận quyền | Mentor/Admin ghi trái ý đồ | Quyết từng ô "?" |
| D5 | Collaborator **không** cấp quyền cho tới khi chủ dự án quyết | Yêu cầu "chưa tự cấp quyền Collaborator" | — | — | Xác nhận để nguyên |
| D6 | Không được phân công ⇒ 404 (không lộ tồn tại) hoặc 403; thống nhất toàn hệ thống; không 200 rỗng | R5; hiện 403/`200 []` lẫn lộn | Mọi endpoint chi tiết; frontend phân biệt lỗi | Frontend khó phân biệt lỗi quyền với không tồn tại | Chọn 403 hay 404 |
| D7 | `classId` bắt buộc trong đường dẫn; kiểm tra `scheduleId` là **buổi của lớp** | R4; code dùng `syllabusScheduleId` dùng chung, `classId` tuỳ chọn | Đổi chữ ký API; client cũ | Phá tương thích client cũ | Lộ trình bỏ phiên bản cũ |
| D7b *(mới)* | Quyết định bài làm thuộc lớp nào khi học viên có nhiều lớp cùng giáo trình | `QuizAttempt` theo `(scheduleId, userId)` | Mô hình dữ liệu bài làm | Hai giảng viên cùng chấm một bài | Chọn: gắn lớp hay giữ theo học viên |
| D8 | Backend tính điểm tổng/chuyên cần/`hasPendingGrading` theo (lớp, buổi) | Frontend cũ tính N+1; `ungraded-count` toàn cục | DTO danh sách học viên/buổi | Thay đổi định nghĩa số liệu | Công thức và nguồn |
| D9 | Thu hồi: kiểm tra phân công ở server mỗi lần; xoá cache khi gỡ; đồng bộ ngắn hạn hơn | Snapshot/cache; token role | Chu kỳ sync, Redis cache | Trễ ~1 ngày nếu giữ nguyên | SLA thu hồi chấp nhận được |
| D10 | Audit + idempotency + khoá lạc quan cho mọi ghi | Mục 8; ghi chú tạo mới mỗi lần | Bảng audit; DTO ghi | Độ phức tạp, dữ liệu audit chứa PII | Phạm vi audit/lưu giữ |
| D11 *(mới)* | Xử lý U4–U6 ngay (chặn ở ingress hoặc thêm role/token dịch vụ) | Mục 0 | Gateway/SecurityConfig | CMS có thể đang gọi các đường public | Xác nhận người gọi `/leads/all`, `/all-student-progress` |

## 11. Thứ tự triển khai P0/P1/P2 (báo cáo mục 11) — đề xuất

- **P0 (khẩn, không phụ thuộc thiết kế lớn):** U4 (admin role), U1–U3 (kiểm quyền theo lớp, tối thiểu: giảng viên ∈ lớp + học viên ∈ lớp + `scheduleId∈classId`), U5–U6 (đóng public), D1b (`email_verified`), mã lỗi 401/403/404/503 chuẩn, `ungraded-count` theo lớp.
- **P0 (nền cho frontend M4C.1):** endpoint danh sách học viên theo (lớp, buổi) chuẩn hợp đồng B0 (M3–M6, D6, D7, D8), danh sách lớp giảng viên và buổi theo lớp (kèm role check).
- **P1:** mô hình phân công theo userId + đồng bộ (D2), bài nộp/chi tiết bài làm theo phạm vi, phân tích học tập, điểm danh theo userId, ghi chú (idempotency, bỏ email client).
- **P2:** chấm bài/gửi kết quả/báo cáo AI với khoá lạc quan + audit đầy đủ; chốt chặn đồng bộ; chính sách Mentor/Teacher-manager chi tiết; tối ưu hiệu năng (bỏ N+1).
- Staging + bộ T1–T20 chạy thật trước khi frontend tích hợp (xem `BACKEND-AUTH-HANDOVER.md` mục 6).

## 12. Hợp đồng cụ thể để frontend tích hợp thật (báo cáo mục 12)

Frontend sẽ tích hợp khi backend cung cấp (tên là gợi ý; yêu cầu là chữ đậm):
1. `GET …/me/classes` — **chỉ lớp của người gọi**, rỗng nghĩa là không có lớp thật.
2. `GET …/classes/{classId}/schedules` — **403/404 theo D6; không 200 rỗng khi bị từ chối**; mỗi buổi có `sessionId` (buổi của lớp) **và** `syllabusScheduleId`.
3. `GET …/classes/{classId}/schedules/{sessionId}/students` — **`classId` trong đường dẫn**, backend tính điểm/chuyên cần/trạng thái.
4. Mã lỗi: 401, 403, 404, 400/422, 409, 502/503 với thân `{status, code, message, traceId}`.
5. Mọi endpoint ghi: `idempotencyKey`, `version`, audit.
6. Staging + tài khoản theo role (≥ 2 giảng viên) + dữ liệu lớp có `syllabusScheduleId` dùng chung.
Chi tiết DTO ở `B0-IDENTITY-AUTHORIZATION-CONTRACT.md` mục 6–8.

---

## Phụ lục — dấu vết xác minh (đường dẫn đã đọc)

- `LMS_Backend/repo-lms-quiz`: `config/SecurityConfig.java`, `controller/GradingController.java`, `service/impl/GradingServiceImpl.java` (dòng ~73–135, 236–345, 470–700, 698–910, 1090–1150), `client/OnlLearningGradingClient.java`, `client/IdentityProfileClient.java`, `client/AiCnhPersonalizationClient.java`.
- `LMS_Backend/repo-lms-onl-learning`: `config/SecurityConfig.java`, `controller/GradingClassController.java`, `controller/LeadController.java`, `controller/ScheduleModuleController.java`, `service/impl/GradingClassServiceImpl.java`, `service/impl/TimetableSyncServiceImpl.java`, `client/CmsClient.java`, `repository/TimetableClassRepository.java`, `repository/TimetableSnapshotRepository.java`, `entity/TimetableClassParticipant.java`, `db/migration/V6__add_timetable_snapshot_tables.sql`, `scheduler/SystemSyncScheduler.java`.
- `LMS_Backend/repo-api-gateway`: `application-prod.yml`, `application-dev.yml`, `src/main/java` (không có filter xác thực); `repo-common-framework/.../EmailVerifiedFilter.java`.
- `Authentication_Backend/repo-auth`: `service/impl/AuthServiceImpl.java` (`signup`, `login`), `service/impl/JwtTokenServiceImpl.java` (`issueTokens`, `refreshTokens`), `controller/InternalProfileController.java`, `service/impl/UserServiceImpl.java#getProfilesByEmails`, `repository/UserRepository.java`.
- `LMS_Frontend/src/core/services/quiz.service.ts`, `online-course.service.ts` (các endpoint đang được gọi).
- Không đọc giá trị bí mật, không chạy dịch vụ, không gọi mạng.
