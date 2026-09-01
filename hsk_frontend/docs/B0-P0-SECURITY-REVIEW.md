# B0 / P0 — Rà soát bảo mật backend HSK và đề xuất khắc phục (để thống nhất thứ tự xử lý)

Ngày: 2026-10-27. Trạng thái B0: **OPEN**. Tài liệu này **chỉ khảo sát, đánh giá, đề xuất**; không thay đổi code/DB/migration/production/Auth; không thử khai thác; không truy xuất dữ liệu cá nhân thật.
Bổ sung (không thay thế) `B0-BACKEND-VERIFICATION-REPORT.md`, `B0-IDENTITY-AUTHORIZATION-CONTRACT.md`, `M4C0-SURVEY.md`.
Nhãn: **[SỰ THẬT]** đọc trong source/git; **[ĐỀ XUẤT]** chưa duyệt; **[KHÔNG XÁC MINH ĐƯỢC]** cần chạy thật hoặc nguồn ngoài workspace (CMS/ERP, AI-CNH, cấu hình ingress thật, log truy cập).
Quy ước: **không khẳng định đã bị khai thác**. Mọi "có thể bị đọc/ghi" nghĩa là *kiểm soát truy cập không chặn trong source*, không phải bằng chứng đã xảy ra.

## 0. Trạng thái triển khai thực tế — bằng chứng và giới hạn

| Bằng chứng | Nguồn | Ý nghĩa |
|---|---|---|
| Có cấu hình prod chạy sau gateway: route `/api/quiz/**` và `/api/online-learning/**` (không filter xác thực/role) | `repo-api-gateway/application-prod.yml`, `application-dev.yml`; `src/main/java` chỉ có `GlobalErrorHandler` + lớp ứng dụng | Gateway chỉ định tuyến |
| Tài liệu deploy: stack `SPRING_PROFILE=prod` sau Traefik, domain `lms-ai.hoc-ba.edu.vn` | `LMS_Backend/docs/lms-docker-deploy.md` | Có quy trình deploy production (tài liệu, không phải trạng thái live) |
| Ghi nhớ dự án (ngày 2026-06): dev server `lms.dangch.tech` chạy backend này sau Cloudflare Tunnel → nginx, DB dev có **dữ liệu thật** (~3.151 người dùng) | memory `project_dev_server_deploy_auth_split` (ghi nhớ cũ ~4 tháng) | Cần xác nhận lại hiện trạng |
| Compose chính không publish cổng của quiz/onl-learning (chỉ MySQL) | `docker-compose.yml` | Đường vào = gateway/ingress |
| Frontend HSK cũ gọi U1–U4 (và `GET /leads` có token) | `LMS_Frontend/src/core/services/quiz.service.ts`, `online-course.service.ts` | Có người dùng thật trên các đường này |
| **Không xác minh được**: bản nào đang chạy production, ingress/WAF có chặn đường dẫn không, log truy cập | — | Cần chủ hạ tầng cung cấp |

**Kết luận thận trọng:** coi U1–U6 là **"được cấu hình để chạy trên môi trường có người dùng thật"** cho tới khi chủ hạ tầng xác nhận khác. Chưa có bằng chứng khai thác; chưa có bằng chứng ngược lại.
**Việc cần chủ hạ tầng làm (chỉ đọc, không thử khai thác):** (1) xác nhận commit/nhánh đang chạy ở từng môi trường; (2) kiểm tra cấu hình nginx/Cloudflare/Traefik có chặn đường dẫn `/api/online-learning/leads`, `…/all-student-progress`, `…/grading-classes/admin/*`, `/api/quiz/grading/admin/*`; (3) xem log truy cập (số lần gọi, có `Authorization` hay không, IP/User-Agent) cho U5/U6 trong N ngày gần nhất để biết **ai đang gọi**.

---

## 1. U1–U6 — phân tích theo 10 tiêu chí

Ký hiệu cột: Auth = yêu cầu xác thực; Role = kiểm tra role; Own = kiểm tra sở hữu/phân công.

### U1 — `POST /grading-classes/{classId}/schedules/{scheduleId}/students/{studentUserId}/notes`
1. **Sở hữu:** `repo-lms-onl-learning` — `GradingClassController.sendTeacherNote` → `GradingClassServiceImpl.sendTeacherNote`. Gateway: `/api/online-learning/grading-classes/...`.
2. **Dữ liệu:** ghi `learning_analysis_notes` (classId, scheduleId, studentUserId, `studentEmail` do client gửi, teacherEmail, content) **và** phát `NotificationEvent` tới `studentUserId` trong đường dẫn (chủ đề `LEARNING_ANALYSIS_NOTE`, trích 140 ký tự, kèm `teacherEmail` trong payload).
3. **Auth:** có (`anyRequest().authenticated()`).
4. **Role:** không.
5. **Own:** không (không kiểm tra giảng viên ∈ lớp, học viên ∈ lớp, buổi ∈ lớp). Chỉ kiểm tra `studentUserId`/`content` không rỗng.
6. **Lớp bảo vệ khác:** gateway không lọc; `@EnableMethodSecurity` bật nhưng không có annotation; `NotificationPublisher` lỗi bị nuốt (không chặn). **Không có bảo vệ bổ sung được xác minh.**
7. **Production:** frontend HSK cũ gọi (`online-course.service.ts`, `/students/{userId}/notes`). Live: KHÔNG XÁC MINH ĐƯỢC (mục 0).
8. **Bảo vệ khác đã xác minh:** không.
9. **Ảnh hưởng:** **CAO (toàn vẹn + thông báo tới học viên):** tài khoản đã đăng nhập bất kỳ có thể ghi nhận xét "của giảng viên" vào lớp bất kỳ và gửi thông báo tới bất kỳ `userId` (biết/đoán được ULID). Hậu quả: giả mạo giảng viên, nội dung lừa đảo tới học viên, ô nhiễm dữ liệu học tập. Mỗi lần gọi = 1 ghi chú + 1 thông báo (khoá chống trùng là id ghi chú mới).
10. **Giảm thiểu ngay:** (a) chặn route POST này ở ingress **hoặc** (b) thêm kiểm tra tối thiểu trong service: `emailVerified`, role ∈ {TEACHER, MENTOR}, giảng viên ∈ lớp (tái dùng `hasSnapshotClassAccess`/`assertCmsClassAccess`), học viên ∈ lớp, buổi ∈ lớp. **Dài hạn:** `ClassAccessService` (mục 4), `idempotencyKey`, giới hạn tần suất/độ dài, bỏ `studentEmail` client, audit, không phát thông báo khi từ chối.

### U2 — `GET /grading-classes/{classId}/schedules/{scheduleId}/students/{studentEmail}/attendance-analysis`
1. onl-learning — `GradingClassController.getAttendanceAnalysis` → `GradingClassServiceImpl.getAttendanceAnalysis`; nguồn dữ liệu CMS `getClassStudents(classId)` (có cache Redis 180 giây).
2. **Dữ liệu:** xu hướng điểm danh luỹ kế của học viên theo email trong đường dẫn + **trung bình cả lớp** + nhật ký điểm danh.
3. Auth: có. 4. Role: không. 5. Own: **không** — controller **không nhận `Authentication`**.
6. Lớp khác: không. 7. Frontend cũ gọi (`.../students/{email}/attendance-analysis`). 8. Không.
9. **Ảnh hưởng: TRUNG BÌNH–CAO (đọc, PII học tập):** biết `classId` ⇒ lấy được chuyên cần trung bình lớp; thêm email ⇒ lấy lịch sử điểm danh cá nhân. Không cần là giảng viên của lớp.
10. **Ngay:** bắt buộc principal + kiểm tra giảng viên ∈ lớp (hoặc Admin) trước khi gọi CMS; **dài hạn:** thay email bằng `studentUserId` đã kiểm tra thuộc lớp (M12).

### U3 — `GET …/{classId}/schedules/{scheduleId}/students/{studentUserId}/notes/latest`
1. onl-learning — `getLatestTeacherNote`.
2. **Dữ liệu:** nội dung nhận xét giảng viên gần nhất + `author` (= email giảng viên) + thời điểm.
3. Auth: có. 4. Role: không. 5. Own: không. **Controller không nhận `Authentication`; repository tra theo `(scheduleId, studentUserId)` và bỏ qua `classId`.**
6–8. Không có bảo vệ bổ sung. Frontend cũ gọi.
9. **Ảnh hưởng: TRUNG BÌNH (đọc):** đọc nhận xét của học viên bất kỳ; rò email giảng viên. Vì bỏ qua `classId`, ghi chú còn dùng chung giữa các lớp cùng giáo trình.
10. **Ngay:** kiểm tra giảng viên ∈ lớp & học viên ∈ lớp; **dài hạn:** khoá theo `(classId, sessionId, studentUserId)`, không trả email giảng viên.

### U4 — Route admin lớp học
- **U4a** quiz: `GET /grading/admin/classes`, `GET /grading/admin/classes/{classId}/students` (`GradingController` → `GradingServiceImpl.getAdminClasses/getAdminClassStudents` → `OnlLearningGradingClient` → onl-learning admin).
- **U4b** onl-learning: `GET /grading-classes/admin/all`, `/admin/{classId}/sessions`, `/admin/{classId}/students`.
2. **Dữ liệu:** toàn bộ lớp (mã lớp, tên, khoá học, giảng viên + email, trợ giảng, lịch, trạng thái); danh sách học viên từng lớp (email, họ tên, điện thoại; ở quiz thêm điểm/hoàn thành/trạng thái từng kỹ năng).
3. Auth: có. 4. Role: **không** (`GradingController`, `GradingClassController` không có `@PreAuthorize`; trong khi `SystemSyncController`, `AvailableScheduleModuleController`, `OnlineCourseController` cùng service **có**). 5. Own: không áp dụng (đây là điểm vào "toàn hệ thống").
6. Quiz→onl-learning chuyển tiếp token người gọi nên **không** tạo thêm bảo vệ; gateway không lọc. 7. Frontend cũ gọi (`quiz.service.ts:580,590`; trang `admin/class-management`).
8. Không. 9. **Ảnh hưởng: CAO (đọc PII hàng loạt):** mọi tài khoản đã đăng nhập (kể cả `ROLE_USER` từ đăng ký công khai) liệt kê được lớp và học viên toàn hệ thống.
10. **Ngay:** `@PreAuthorize` cho ADMIN (+ TEACHER_MANAGER nếu D4 chốt) trên cả U4a và U4b, hoặc chặn `…/admin/**` ở ingress trong lúc chờ; **dài hạn:** role check nằm trong `ClassAccessService.assertRole`, test tự động cho từng role.

### U5 — `GET /leads` (danh sách đăng ký tư vấn)
1. onl-learning — `LeadController.getLeads` → `LeadService.getLeads`.
2. **Dữ liệu:** `LeadRegistrationResponse`: `fullName`, `email`, `phone`, `note`, `status`, mã/khoá học, thời điểm đăng ký (lead tiềm năng — PII).
3. **Auth: không** — `SecurityConfig`: `requestMatchers(GET, "/leads/**").permitAll()`. 4. Role: không — dòng `@PreAuthorize` trên `getLeads` **đang bị comment**. 5. Own: không áp dụng.
6. Lớp khác: không. (Đối chiếu: `GET /leads/export` **có** `@PreAuthorize` ADMIN/TEACHER_MANAGER ⇒ không đọc được khi ẩn danh; `GET /leads/me/**` yêu cầu đăng nhập.)
7. **Bằng chứng lịch sử [SỰ THẬT]:** quy tắc từng là `GET /leads/** → hasAnyAuthority(ROLE_ADMIN, ROLE_TEACHER_MANAGER)`; commit `b3e8362` ("fix ho trungnc", 2026-06-02) đổi thành `permitAll()`. Tài liệu luồng online-course của `Authentication_Frontend/markdown/ONLINE_COURSE_FLOW_GUIDE.md` ghi rõ quản lý lead là **ADMIN/TEACHER_MANAGER** (xác nhận chính sách dự định). Frontend cũ gọi `GET /leads` **kèm token** (`axiosInstance`, trang `/admin/online-course/leads`) nên **không cần** truy cập ẩn danh. Quy tắc `GET /leads/all` (và mẫu `/api/onl/leads/all` ở `BearerTokenAuthenticationFilter`) **không có handler tương ứng** trong `LeadController` ⇒ có vẻ là phần còn lại của một thiết kế cũ ("CMS pull") — **KHÔNG XÁC MINH ĐƯỢC** CMS còn gọi hay không.
8. Không có bảo vệ khác. Live: KHÔNG XÁC MINH ĐƯỢC.
9. **Ảnh hưởng: CAO (đọc PII, không cần đăng nhập)** nếu bản đang chạy có commit `b3e8362` và ingress không chặn.
10. **Ngay [ĐỀ XUẤT]:** khôi phục `hasAnyAuthority(ROLE_ADMIN, ROLE_TEACHER_MANAGER)` cho `GET /leads/**` và bỏ comment `@PreAuthorize` trên `getLeads`; xoá quy tắc/mẫu `/leads/all` chết sau khi CMS owner xác nhận không dùng. **Dài hạn:** quy tắc URL mặc định `denyAll`/`authenticated` + allow-list tường minh; test hồi quy "ẩn danh nhận 401".

### U6 — `GET /schedule-modules/all-student-progress`
1. onl-learning — `ScheduleModuleController.getAllStudentProgress` → `ScheduleModuleServiceImpl.getAllStudentProgress`.
2. **Dữ liệu:** với **mọi bản ghi tiến độ chưa xoá**: theo khoá học → từng học viên: `userId`, `userEmail`, module, `progressPercentage`, `completed`, `completedItems`, `totalItems`, `lastInteractedAt`. Không phân trang/lọc.
3. **Auth: không** (`permitAll`, chú thích "Public: lấy tiến độ tổng hợp học viên theo module"). 4. Role: không. 5. Own: không.
6–8. Không có bảo vệ khác. **Ai gọi [SỰ THẬT, chỉ trong workspace]:** không có lời gọi nào trong `LMS_Frontend/src`, các service `LMS_Backend`, hay Authentication_*; chỉ có tài liệu SDD nhắc `all-student-progress` như dữ liệu sẵn có cho phần "lớp giảng viên" (`SPEC-P4-lambai-chambai.md`). Quy tắc có từ commit gốc (2026-05-11). **Người gọi thật (CMS/dịch vụ ngoài/công cụ báo cáo) KHÔNG XÁC MINH ĐƯỢC** — cần log truy cập và chủ CMS (mã nguồn CMS/ERP không có trong workspace).
9. **Ảnh hưởng: CAO (đọc PII hàng loạt, không cần đăng nhập)** + chi phí tải (truy vấn toàn bảng không phân trang ⇒ vector làm chậm dịch vụ).
10. **Không giữ công khai vì "CMS cần"** (theo chỉ đạo): [ĐỀ XUẤT] (1) lấy danh sách người gọi từ log (chủ hạ tầng); (2) nếu có dịch vụ nội bộ/CMS hợp lệ ⇒ chuyển sang **xác thực dịch vụ**: repo đã có cơ chế `InternalJwtFilter` bảo vệ `/internal/**` bằng `X-Internal-Token` (audience=internal, cấp từ `POST /oauth/token` của Auth) ⇒ tạo `/internal/schedule-modules/all-student-progress` + quyền theo dịch vụ gọi; (3) route công khai cũ trả 401/403 sau thời gian chuyển tiếp ngắn đã thống nhất; (4) endpoint cho giảng viên/quản lý (nếu cần) phải **theo lớp/khoá**, có phân trang, qua `ClassAccessService`, không trả `userEmail` hàng loạt.

### Tổng hợp trạng thái U1–U6
| # | Mức | Cần xác thực | Role | Sở hữu | Frontend cũ gọi | Hạ tầng chặn (xác minh) | Trạng thái |
|---|---|---|---|---|---|---|---|
| U1 | CAO | có | ✖ | ✖ | có | KHÔNG XÁC MINH ĐƯỢC | CONFIRMED VULNERABILITY (source) |
| U2 | TB–CAO | có | ✖ | ✖ | có | KHÔNG XÁC MINH ĐƯỢC | CONFIRMED VULNERABILITY (source) |
| U3 | TB | có | ✖ | ✖ | có | KHÔNG XÁC MINH ĐƯỢC | CONFIRMED VULNERABILITY (source) |
| U4 | CAO | có | ✖ | n/a | có | KHÔNG XÁC MINH ĐƯỢC | CONFIRMED VULNERABILITY (source) |
| U5 | CAO | **✖** | ✖ | n/a | có (kèm token) | KHÔNG XÁC MINH ĐƯỢC | CONFIRMED VULNERABILITY (source); hồi quy từ 2026-06-02 |
| U6 | CAO | **✖** | ✖ | n/a | không thấy trong workspace | KHÔNG XÁC MINH ĐƯỢC | CONFIRMED VULNERABILITY (source); người gọi chưa biết |

**Yêu cầu quyết định khẩn cho người có trách nhiệm:** phê duyệt biện pháp giảm thiểu U4–U6 (ưu tiên U5 và U6 vì không cần đăng nhập) và U1–U3, theo thứ tự ở mục 11. **Không có hành động nào được thực hiện trên production trong bước này.**

---

## 2. Định danh và email chưa xác minh

**Hiện trạng [SỰ THẬT]:**
- `AuthServiceImpl.signup`: tạo `User(emailVerified=false, ROLE_USER)`, gửi link xác minh, rồi `return jwtTokenService.issueTokens(saved)` ⇒ trả access + refresh token mang `email` người dùng khai, `email_verified=false`. `login` và `refreshTokens` từ chối khi chưa xác minh; Google OAuth đặt `emailVerified=true`.
- `quiz` và `onl-learning`: `SecurityConfig` **không** đăng ký `EmailVerifiedFilter` (lớp này không phải `@Component`; chỉ `repo-realtime` và `LMS_IELTS` `repo-lms` dùng); không có chỗ nào đọc `principal.emailVerified()`.
- HSK xác định giảng viên theo `principal.email()` (chữ thường) so với `timetable_class_participants.email` và CMS `/lms-integration/teachers/{email}/classes`.
- `by-emails` của Auth trả `userId, email, userCode, phoneNumber, …` — **không có `emailVerified`, `status`, `roles`**.

**Kịch bản rủi ro [POTENTIAL RISK, KHÔNG thử]:** email giảng viên có trong CMS/TUTOR nhưng **chưa có tài khoản Auth** ⇒ người khác đăng ký email đó, nhận token ngay, và (vì thiếu role check + sở hữu theo email) được xử lý như giảng viên trong thời hạn access token; đồng thời chiếm email, giảng viên thật không đăng ký được. Điều kiện tiên quyết thực tế phụ thuộc dữ liệu; **cần đối soát** (mục dưới) để biết có tồn tại email như vậy không.

**Phương án nhiều lớp [ĐỀ XUẤT]:**
1. **Ở service LMS (không đổi Auth):** `ClassAccessService.assertRole` yêu cầu `principal.emailVerified()==true` cho mọi endpoint giảng viên/admin/ghi. Phương án thay thế (rộng hơn) là đăng ký `EmailVerifiedFilter` toàn service với danh sách bỏ qua — **ảnh hưởng** học viên vừa đăng ký chưa xác minh (mọi chức năng LMS dành cho học viên cũng bị chặn) nên cần chủ dự án quyết; khuyến nghị bắt đầu bằng **kiểm tra hẹp** ở khu giảng viên/admin.
2. **Khi ánh xạ CMS→userId:** chỉ chấp nhận tài khoản `emailVerified=true`, không bị khoá, có role phù hợp ⇒ cần Auth bổ sung các trường đó vào `by-emails` (đề nghị gửi cho người phụ trách Auth; **không tự sửa**).
3. **Chuẩn bị tài khoản trước khi phân công:** tạo/mời tài khoản giảng viên (đã xác minh) trước khi email xuất hiện trong dữ liệu phân công; báo cáo **đối soát chỉ-đọc**: danh sách email `TUTOR` không có tài khoản Auth hoặc chưa xác minh (xuất dưới dạng đếm + id ẩn, không xuất PII ra tài liệu).
4. **Chính sách signup (thuộc người phụ trách Auth, cần phối hợp trước):** có tiếp tục cấp token trước xác minh không. Frontend/LMS không tự đổi. Lựa chọn: giữ UX hiện tại nhưng mọi dịch vụ phải kiểm `email_verified`; hoặc không cấp token tới khi xác minh.
5. **Email đổi/thiếu/không ánh xạ được:** phân công theo userId (mục 3) không phụ thuộc email sau lần ánh xạ; hàng không ánh xạ được đi vào hàng đợi đối soát, **không cấp quyền**; nếu bật đổi email ở Auth thì phát sự kiện để cập nhật `source_email`.

## 3. Thiết kế định danh và ánh xạ userId [ĐỀ XUẤT]

- **Chủ thể:** `userId` từ principal; email chỉ hiển thị/tra cứu; không bao giờ nhận định danh người gọi từ client (M1).
- **Bảng phân công theo userId** (tên cột minh hoạ, backend quyết): `class_staff_assignment(id, class_id, user_id, staff_role {TEACHER|MENTOR|…}, source {CMS_SYNC|MANUAL}, source_email, status {ACTIVE|REVOKED}, valid_from, valid_to, synced_at, sync_run_id)`; khoá duy nhất `(class_id, user_id, staff_role)`.
- **Đồng bộ CMS → userId:** chuẩn hoá email (trim, chữ thường) → `by-emails` theo lô → ghi `user_id`. Email không có tài khoản/không xác minh ⇒ không tạo quyền, ghi vào `assignment_reconciliation` (đếm theo lý do).
- **Giai đoạn chuyển tiếp:** chạy **bóng** (shadow): so sánh quyết định theo email (cũ) và userId (mới) trên mọi yêu cầu, ghi **chỉ đếm/loại bất đồng** (không PII); chuyển sang userId khi bất đồng được giải thích.
- **Vai trò theo buổi vs theo lớp:** hiện `tutorEmail` cấp buổi biến giảng viên thành TUTOR **cả lớp**. Đề xuất giữ mức lớp ở giai đoạn đầu (không đổi hành vi) nhưng ghi `staff_role`/phạm vi để sau này giới hạn theo buổi — cần xác nhận nghiệp vụ.

## 4. `ClassAccessService` [ĐỀ XUẤT]

Đặt ở service **sở hữu dữ liệu lớp** (onl-learning) và công bố qua API nội bộ có xác thực dịch vụ cho quiz (không để quiz tự suy ra từ email). Hàm và quy tắc:
| Hàm | Kiểm tra | Từ chối |
|---|---|---|
| `assertAuthenticatedVerified(principal)` | có principal, `emailVerified`, tài khoản không bị khoá (cần Auth cung cấp trạng thái) | 401 / 403 |
| `assertRole(principal, action)` | role ∈ chính sách cho hành động (mục 6) | 403 |
| `assertCanAccessClass(principal, classId, mode READ/WRITE)` | ADMIN theo chính sách; TEACHER/MENTOR có phân công ACTIVE và còn hiệu lực | 404/403 (D6) |
| `assertSessionInClass(classId, sessionId)` | buổi (timetable session) thuộc lớp; `syllabusScheduleId` chỉ là thuộc tính | 404 |
| `assertStudentInClass(classId, studentUserId)` | học viên ∈ roster lớp | 404/403 |
| `assertAttemptInScope(classId, sessionId, studentUserId, attemptId)` | bài làm thuộc học viên, đúng buổi, **và đúng lớp (D7b)** | 404/403 |
| `assertCanWrite(principal, classId, action)` | quyền ghi riêng theo hành động và vai trò (mục 6) | 403 |
Quy tắc chung: **đóng-khi-lỗi** (CMS/Auth/DB lỗi ⇒ 502/503, không mặc định cho phép, không trả rỗng); mỗi lần gọi kiểm tra lại (không dựa vào đã đọc được); phản hồi lỗi chuẩn hoá (mục 5); audit mọi ghi; log chỉ `userId/classId/sessionId`, không email.
**Thu hồi quyền [ĐỀ XUẤT chính sách, cần phê duyệt]:** phân công `REVOKED`/hết hạn có hiệu lực **ngay** trong lần gọi kế tiếp (đọc DB, không cache quyết định > 60 giây); cache CMS cho quyền (hiện 180 giây) không được cấp quyền khi snapshot nói ngược lại; đồng bộ ngắn hơn một lần/đêm (vd. mỗi 15–60 phút hoặc theo sự kiện) và hỗ trợ "gỡ phân công thủ công" có hiệu lực tức thì. Role đổi ở Auth hiệu lực khi token mới (TTL access) — chấp nhận hay yêu cầu tra role hiện tại từ Auth là quyết định D9.

## 5. Mã lỗi và nhất quán

| Tình huống | HTTP | Mã |
|---|---|---|
| Chưa/không hợp lệ xác thực | 401 | `AUTH_REQUIRED` |
| Email chưa xác minh / tài khoản khoá | 403 | `EMAIL_NOT_VERIFIED` / `ACCOUNT_BLOCKED` |
| Sai role | 403 | `ROLE_FORBIDDEN` |
| Không được phân công / ngoài phạm vi | 404 hoặc 403 (D6, **một chính sách duy nhất**) | `CLASS_NOT_FOUND` hoặc `CLASS_ACCESS_DENIED`; `SESSION_NOT_IN_CLASS`; `STUDENT_NOT_IN_CLASS`; `ATTEMPT_OUT_OF_SCOPE` |
| Nguồn bắt buộc lỗi (CMS/Auth/DB) | 502/503 | `UPSTREAM_UNAVAILABLE` (hiện trả 403) |
| Dữ liệu ghi sai | 400/422 | `VALIDATION_FAILED` |
| Trùng/xung đột phiên bản | 409 | `DUPLICATE_REQUEST` / `VERSION_CONFLICT` |
- **Không** trả `200 []` để che từ chối (hiện `getScheduleStudents` với `classId` lạ trả `[]`).
- **Chỉ số tổng hợp** (`hasPendingGrading`, điểm, chuyên cần) tính theo **(lớp, buổi)** ở backend, không theo `syllabusScheduleId` thô; bỏ `hasSchedulePendingGrading` toàn cục.
- **Idempotency:** `idempotencyKey` cho ghi chú, gửi kết quả, thông báo (khoá = (người gọi, lớp, buổi, học viên, key)); thông báo dùng khoá chống trùng suy ra từ khoá đó chứ không từ id ghi chú mới.
- **Đồng thời:** `version`/`@Version` cho `QuizAnswer`/`QuizAttempt` khi chấm; `VERSION_CONFLICT` 409; audit ghi (ai, khi nào, giá trị cũ → mới).
- **Đồng bộ CMS:** xem mục 5b.

### 5b. Kiểm tra quy trình đồng bộ CMS
**Hiện trạng [SỰ THẬT]:** `syncAll` bỏ qua khi CMS lỗi/`data==null` (giữ snapshot) — tốt. Nhưng khi CMS trả **danh sách rỗng thành công**, `flattenSnapshot` cho `participants` rỗng và `cleanupOldSnapshot(syncVersion)` chạy `DELETE FROM timetable_class_participants WHERE sync_version <> ?` ⇒ **xoá toàn bộ phân công** (và `classes/sessions` tương ứng nếu cùng cleanup). Hệ quả: mất quyền hàng loạt tới lần đồng bộ kế (mặc định 01:00 hằng đêm); các yêu cầu sau đó rơi về CMS theo email (có thể hoạt động nếu CMS khôi phục) — nên là **mất khả dụng**, không phải cấp quyền sai. Ngược lại, snapshot **cũ** (CMS lỗi nhiều ngày) vẫn cấp quyền cho phân công đã bị gỡ ở CMS.
**Đề xuất:** (1) từ chối thay snapshot nếu số hàng giảm quá ngưỡng (vd. >20% hoặc về 0) trừ khi có cờ xác nhận thủ công; (2) giữ tuổi snapshot (`synced_at`) và **không cấp quyền từ snapshot quá hạn** (ngưỡng thống nhất) — trả 503; (3) đồng bộ theo giao dịch (cleanup chỉ sau upsert thành công); (4) cảnh báo khi sync lỗi liên tiếp; (5) đồng bộ thủ công theo lớp khi gỡ phân công.

## 6. Ma trận quyền — để chủ dự án phê duyệt (chưa quyết)

Nguyên tắc: **có role không có nghĩa được vào mọi lớp.** ○ = chỉ lớp được phân công (ACTIVE). ✖ = không. ? = cần quyết định. Collaborator **chưa tự cấp**.
| Hành động | ADMIN | TEACHER_MANAGER | TEACHER | MENTOR | COLLABORATOR |
|---|---|---|---|---|---|
| Danh sách lớp của tôi | ✖ (không có lớp riêng, trừ khi được phân công) | ○ ? | ○ | ○ | ✖ |
| Danh sách lớp toàn hệ thống / học viên toàn lớp (đọc quản trị) | ✔ | ? | ✖ | ✖ | ✖ |
| Đọc buổi/học viên/bài nộp của lớp | ✔ (đọc) | ? | ○ | ○ ? | ✖ |
| Chấm điểm, chốt bài | ? | ? | ○ | ? | ✖ |
| Gửi kết quả cho học viên | ? | ? | ○ | ? | ✖ |
| Gửi nhận xét giảng viên | ? | ? | ○ | ? | ✖ |
| Tạo/duyệt báo cáo AI | ? | ? | ○ | ? | ✖ |
| Đồng bộ CMS thủ công | ✔ | ✔ (hiện có) | ✖ | ✖ | ✖ |
| Xem lead đăng ký (U5) | ✔ | ✔ (đúng quy tắc trước 2026-06-02) | ✖ | ✖ | ✖ |
| Tiến độ tổng hợp học viên (U6) | dịch vụ nội bộ + ? | ? | theo lớp được phân công | theo lớp | ✖ |
**Tiền lệ code [SỰ THẬT]:** `LmsAccessPolicy` gom `ADMIN`+`TEACHER_MANAGER` thành nhóm "quản lý" và `TEACHER`+`MENTOR`+`COLLABORATOR` thành nhóm "tác giả nội dung" (cho tài liệu bài học). Đây là tiền lệ **cho tài liệu**, **không** tự động áp dụng cho dữ liệu lớp/học viên; riêng `COLLABORATOR` ở khu lớp học **không** được cấp theo chỉ đạo.
Câu hỏi nghiệp vụ cần chủ dự án: Mentor có được **chấm/gửi/nhận xét** hay chỉ đọc? Teacher-manager có quyền xem mọi lớp thuộc phạm vi quản lý nào? Admin có ghi thay giảng viên không (và có audit)?

## 7. D7b — `QuizAttempt` không gắn lớp

**Sự thật [từ source]:**
- `quiz_attempts` có `user_id`, `quiz_id`, `study_set_id`, `schedule_id`, `module_id`, `attempt_no`, `is_official`, `grading_status`, … **không có `class_id`**.
- `schedule_id` do **client gửi khi nộp bài** (`QuizAttemptServiceImpl`: `request.getScheduleId()`), **không** được đối chiếu với lớp/buổi mà học viên thực sự tham gia.
- Quyền giảng viên hiện = "học viên ∈ roster của **bất kỳ lớp nào của giảng viên có `syllabusScheduleId` đó**" (`resolveStudentEmailsForSchedule`); các test hiện tại **cố ý** bảo vệ hành vi này (`gradeAnswer_allowsAccessWhenStudentBelongsToSecondMatchingClass`, `getScheduleStudents_withoutClassId_keepsOldFirstMatchBehaviorForLegacyClients`) vì giảng viên dạy nhiều lớp cùng giáo trình từng bị từ chối oan.
- Schema: `quiz` và `onl-learning` dùng `ddl-auto: update` ở prod (quiz không có thư mục migration; onl-learning có Flyway) ⇒ **thêm trường vào entity sẽ tự `ALTER` khi khởi động** nếu không kiểm soát.

**Vấn đề:** học viên thuộc lớp X (giảng viên A) và lớp Y (giảng viên B) cùng giáo trình ⇒ một bài làm `(schedule, user)` đều đọc/chấm được bởi A và B; ghi chú `notes/latest` dùng chung; bài làm đã `RETURNED` bởi A hiện cho B.

**Phương án (chỉ lập phương án, chưa triển khai):**
| | A. Cột `class_id` (nullable) trên `quiz_attempts` | B. Bảng ánh xạ `attempt_class_assignment(attempt_id, class_id, source)` | C. Quy tắc đọc "lớp chủ" không đổi schema |
|---|---|---|---|
| Ý tưởng | Khi nộp bài, bắt buộc `classId` hợp lệ (học viên ∈ roster, buổi ∈ lớp) và lưu | Không đụng bảng nóng; ánh xạ riêng, cho phép gán lại | Suy ra lớp từ ngày nộp/lịch buổi |
| Truy vấn | Đơn giản, có index | Thêm join | Phức tạp, mơ hồ |
| Rủi ro | `ALTER` bảng nóng; ddl-auto tự chạy; cần backfill | Thêm bảng/đồng bộ | Không giải quyết triệt để, khó chứng minh đúng |
| Khuyến nghị | **Ưu tiên nếu chấp nhận `ALTER` có kiểm soát** | Phương án thay thế **ít xâm lấn**, đáng cân nhắc nếu chủ dự án ngại sửa bảng nóng | Không khuyến nghị |

**Kế hoạch khuyến nghị (A, theo pha):**
1. **Pha 0 (chỉ đọc):** báo cáo tác động trên bản sao dữ liệu ẩn danh: với mỗi `(user, schedule)`, đếm số lớp khớp qua `participants`⇢`by-emails`. Phân loại: **duy nhất** / **mơ hồ (≥2 lớp)** / **mồ côi (0)** và tỷ lệ mỗi loại. Quyết định tiếp theo dựa trên con số này.
2. **Pha 1:** migration **tường minh** (không dựa `ddl-auto`) thêm `class_id` NULL + index + cột `class_resolution` {RESOLVED, AMBIGUOUS, ORPHAN, LEGACY}; tắt tự `ALTER` cho thay đổi này; có kế hoạch hoàn tác.
3. **Pha 2 (ghi):** API nộp bài nhận `classId` (hoặc suy ra khi học viên chỉ thuộc 1 lớp khớp), **kiểm tra** học viên ∈ lớp và buổi ∈ lớp; bỏ tin `scheduleId` thô.
4. **Pha 3 (backfill):** gán `class_id` cho hàng *duy nhất*; hàng *mơ hồ* để NULL + `AMBIGUOUS`; ghi báo cáo; **không đoán**.
5. **Pha 4 (đọc):** có `class_id` ⇒ chỉ giảng viên của lớp đó đọc/chấm; `AMBIGUOUS/LEGACY` ⇒ quy tắc cũ (hợp roster) **có cờ tính năng** + audit để theo dõi và dọn dần; cập nhật các test đang bảo vệ hành vi cũ.
6. **Pha 5:** đóng quy tắc cũ khi tỷ lệ mơ hồ chấp nhận được; `is_official` và `attempt_no` cần định nghĩa lại theo `(class, schedule, user)` (quyết định kèm D7b).
**Tác động cần báo cáo trước khi duyệt:** bảng `quiz_attempts` (kích thước/ khoá), `study_set_attempts`/tiến độ liên quan, AI-CNH (đã mang `classId` làm provenance), thông báo, báo cáo điểm, API nộp bài của học viên (thay đổi hợp đồng cho frontend học viên), các test hiện có.
**Câu hỏi nghiệp vụ:** học viên học hai lớp cùng giáo trình có được coi là **hai bài làm** hay **một**? Ai là giảng viên chịu trách nhiệm chấm khi hai lớp cùng ngày? Bài làm cũ mơ hồ xử lý thế nào?

## 8. Phân biệt hai công việc

**A. Bảo vệ backend HSK cũ (còn chạy):** theo mức phơi lộ: U5, U6 (không cần đăng nhập) → U4 → U1/U2/U3 → email chưa xác minh (kiểm hẹp ở service). Thay đổi **nhỏ, có thể hoàn tác**, kèm test hồi quy; không chờ B0 đầy đủ.
**B. Backend chung cho LMS HSK mới:** xây theo hợp đồng B0 (`ClassAccessService`, userId, D7b, mã lỗi, idempotency, audit); **không sao chép** hành vi của backend cũ (không role check, `200 []`, `classId` tuỳ chọn, email trên đường dẫn). Hai việc có lịch khác nhau nhưng chung chính sách.

## 9. Kế hoạch API P0 phục vụ frontend (hợp đồng, chưa triển khai)

Điều kiện chung: M1–M15 của `B0-IDENTITY-AUTHORIZATION-CONTRACT.md`; `email_verified`; mã lỗi mục 5.
1. `GET /teaching/me/classes` — chỉ lớp của người gọi; trả `classId, classCode, className, courseId, courseName, teacherName, startDate, endDate, actualEndDate, studentCount, hasPendingGrading` (**không** trả `teacherEmail`).
2. `GET /teaching/classes/{classId}/sessions` — `sessionId, sessionNo, title, topic, syllabusScheduleId, hasAssignment, hasPendingGrading` **tính theo lớp**.
3. `GET /admin/classes` (ADMIN, D4) — danh sách toàn hệ thống có phân trang; không trả email/điện thoại học viên trừ khi cần.
4. `GET /teaching/classes/{classId}/sessions/{sessionId}/students` — `classId` bắt buộc trong đường dẫn; backend tính điểm/chuyên cần/trạng thái; phân trang; **không `200 []` khi bị từ chối**.
5. `GET /teaching/classes/{classId}/sessions/{sessionId}/submissions` — danh sách bài nộp theo (lớp, buổi) — phụ thuộc D7b.
Giai đoạn sau (P1–P2): chi tiết bài làm, phân tích học tập/điểm danh theo `studentUserId`, ghi chú, chấm, gửi kết quả, báo cáo AI (hợp đồng đã có ở `B0-…-CONTRACT.md` mục 6.2).
Frontend mới **không** tích hợp đường nào chưa đạt tiêu chí ở mục 13.

## 10. Danh sách thay đổi dự kiến (chưa thực hiện; cần phê duyệt)

| # | Thay đổi | Dịch vụ | Loại | Rủi ro | Hoàn tác |
|---|---|---|---|---|---|
| C1 | Khôi phục `hasAnyAuthority(ADMIN, TEACHER_MANAGER)` cho `GET /leads/**`; bỏ comment `@PreAuthorize` `getLeads`; xoá rule chết `/leads/all` (sau xác nhận) | onl-learning | cấu hình/code | Thấp (admin FE gọi có token) | Revert commit |
| C2 | Đóng `GET /schedule-modules/all-student-progress` công khai; chuyển sang `/internal/...` với `X-Internal-Token` cho dịch vụ hợp lệ | onl-learning (+ bên gọi) | code + cấp token dịch vụ | Trung bình (người gọi chưa biết) | Feature flag/route song song ngắn hạn |
| C3 | `@PreAuthorize` cho U4a/U4b | quiz, onl-learning | code | Thấp (chỉ trang admin dùng) | Revert |
| C4 | Kiểm tra quyền cho U1–U3: principal + giảng viên∈lớp + học viên∈lớp + buổi∈lớp + `emailVerified` | onl-learning | code | Trung bình (phải giữ hành vi cho giảng viên hợp lệ) | Revert/flag |
| C5 | Bỏ `studentEmail` client trong DTO ghi chú; thêm `idempotencyKey` | onl-learning | DTO/DB (cột idempotency) | Trung bình | — |
| C6 | `ungraded-count` theo lớp; bỏ endpoint toàn cục | quiz | code | Thấp (FE cũ dùng — cần đổi song song) | — |
| C7 | `classId` bắt buộc ở `students` và personalization GET; trả 404/403 thay `200 []`; 502/503 khi CMS lỗi | quiz, onl-learning | code + hợp đồng | Trung bình (phá client cũ) | Flag |
| C8 | `ClassAccessService` + API nội bộ + tests | onl-learning (+ quiz client) | code | Trung bình | — |
| C9 | Bảng phân công theo userId + đồng bộ + đối soát + chốt chặn giảm đột biến | onl-learning | **schema + code** | Cao (cần duyệt) | Theo pha |
| C10 | D7b: `class_id`/`class_resolution` trên `quiz_attempts` (hoặc bảng B) + backfill | quiz | **schema + dữ liệu** | Cao (cần duyệt, ddl-auto) | Theo pha |
| C11 | Auth: bổ sung `emailVerified/status/roles` vào `by-emails`; xem lại cấp token ở signup | Authentication | code (**chủ Auth quyết**) | Cao (tác động rộng) | — |
| C12 | Khoá lạc quan + audit khi chấm; idempotency gửi kết quả | quiz | schema nhỏ + code | Trung bình | — |
| C13 | Test hồi quy bảo mật tự động (không dữ liệu thật) | tất cả | test | Thấp | — |
Mọi thay đổi cần review bởi người phụ trách backend; thay đổi schema cần kế hoạch migration riêng (không dựa `ddl-auto`).

## 11. Thứ tự khắc phục đề xuất

1. **Ngay (chờ phê duyệt biện pháp khẩn):** chủ hạ tầng thu thập thông tin mục 0 (không khai thác); C1 (U5) và quyết định C2 (U6) sau khi biết người gọi; C3 (U4).
2. **Tiếp theo:** C4 (U1–U3) và kiểm hẹp `emailVerified` ở khu giảng viên/admin; yêu cầu Auth quyết C11.
3. **Nền tảng B0:** C8, C9 (+ đối soát CMS/Auth), D7b pha 0 (báo cáo tác động), quyết định ma trận quyền.
4. **API P0 cho frontend:** mục 9 sau khi 1–3 đủ điều kiện.
5. **Sau đó:** C10–C12, các API ghi.

## 12. Kế hoạch kiểm thử T1–T20 trên staging

**Chưa có kết quả thực tế; ô "PASS" chỉ hợp lệ sau khi chạy.** Dữ liệu **tổng hợp (fixture)**, không dùng PII production, không sao chép DB production.
**Fixture tối thiểu:**
- Giảng viên **A** (lớp 1, 2) và **B** (lớp 3); lớp 1 và 3 dùng chung `syllabusScheduleId`.
- Mentor **M1** được phân công lớp 1; Mentor **M2** chưa phân công.
- Teacher-manager, Collaborator, Admin; tài khoản học viên S1 (lớp 1), S2 (lớp 3), S3 (cả lớp 1 và 3); tài khoản không role; tài khoản `email_verified=false` có email trùng một email phân công.
- Bài làm của S1/S2/S3; phân công của A bị gỡ trong một kịch bản.
- CMS giả (stub) có chế độ: bình thường / lỗi / trả rỗng / trả trễ.
**Kịch bản (T1–T20 giữ nguyên ý nghĩa ở `B0-…-CONTRACT.md` mục 9), bổ sung:**
- T2b: U1–U6 gọi bằng ẩn danh, `ROLE_USER`, `email_verified=false`, mỗi role ⇒ kỳ vọng 401/403 đúng chính sách.
- T5b: A đọc/chấm bài của S3 ở lớp 3 (không phải lớp của A) ⇒ bị chặn sau D7b; S3 ở lớp 1 ⇒ được.
- T13b: sau khi gỡ A khỏi lớp 1, **lần gọi kế tiếp** mất quyền (theo chính sách thu hồi đã chốt); đo độ trễ thực tế.
- T16b: gửi trùng ghi chú/gửi kết quả cùng `idempotencyKey` ⇒ một tác dụng; không phát thông báo thứ hai.
- T17b: hai giảng viên (cùng lớp) chấm đồng thời ⇒ `VERSION_CONFLICT`.
- T20b: CMS giả lỗi/rỗng/trễ ⇒ 502/503, không cấp quyền, không xoá hàng loạt phân công; snapshot rỗng bị chặn bởi chốt chặn.
- T21: ẩn danh gọi `GET /leads`, `/schedule-modules/all-student-progress` ⇒ 401.
- T22: dịch vụ nội bộ có `X-Internal-Token` hợp lệ gọi endpoint nội bộ ⇒ 200; token thiếu/sai audience ⇒ 401.
- T23: log lỗi quyền không chứa email/token/nội dung bài.
**Báo cáo kết quả:** bảng (kịch bản, kỳ vọng, thực tế, bằng chứng — mã trace/HTTP code, không kèm token), do người chạy ký xác nhận.

## 13. Quyết định cần chủ dự án / người phụ trách xác nhận

1. Phê duyệt biện pháp khẩn cho U4–U6 và U1–U3 (mục 11 bước 1–2) và ai thực hiện.
2. Người gọi thực tế `all-student-progress` / `leads` (CMS owner + log hạ tầng).
3. D1: userId làm khoá phân quyền; `emailVerified` bắt buộc ở khu giảng viên/admin (kiểm hẹp hay toàn service).
4. Auth: có thay đổi cấp token ở signup không; bổ sung trường vào `by-emails`.
5. D2: bảng phân công theo userId, chu kỳ đồng bộ, ngưỡng chốt chặn, độ "tươi" tối đa của snapshot.
6. D3–D5: ma trận quyền (mục 6), đặc biệt quyền ghi của Mentor/Admin/Teacher-manager; Collaborator giữ ✖.
7. D6: 403 hay 404.
8. D7/D7b: `classId` bắt buộc; phương án A hay B; định nghĩa bài làm khi học viên học hai lớp cùng giáo trình; xử lý dữ liệu mơ hồ.
9. D9: SLA thu hồi quyền; role từ token hay tra lại.
10. D10: phạm vi audit/idempotency; thời gian lưu giữ.
11. Lịch cho hai công việc A và B; ai sở hữu từng thay đổi (C1–C13).
12. Môi trường staging và tài khoản test (`BACKEND-AUTH-HANDOVER.md` mục 6).

## 14. Tiêu chí nghiệm thu để đánh dấu B0 RESOLVED

**Chỉ đánh dấu RESOLVED khi đủ tất cả:**
1. Người có trách nhiệm đã phê duyệt bằng văn bản các quyết định ở mục 13 (kèm D1–D11 trong các tài liệu B0).
2. U1–U6 đã được xử lý **và** xác nhận trên môi trường đang chạy (không chỉ trong code): ẩn danh nhận 401 ở U5/U6; U1–U4 bị chặn đúng role/phân công; có bằng chứng (kết quả kiểm thử staging + xác nhận cấu hình hạ tầng).
3. `ClassAccessService` (hoặc tương đương) được dùng ở mọi endpoint dữ liệu lớp thuộc phạm vi P0; mọi thao tác ghi có kiểm tra riêng, idempotency, audit.
4. Định danh theo userId đã vận hành (chế độ bóng không còn bất đồng chưa giải thích); đối soát CMS↔Auth báo cáo xong; email chưa xác minh bị chặn theo chính sách đã chốt.
5. D7b có phương án đã duyệt **và** đã áp dụng (hoặc hàng mơ hồ có quy tắc rõ, có cờ theo dõi).
6. Mã lỗi 401/403/404/502-503 nhất quán; không còn `200` rỗng che từ chối; CMS/Auth lỗi ⇒ không cấp quyền; chốt chặn snapshot rỗng hoạt động.
7. T1–T23 chạy **thực tế trên staging đạt**, có bằng chứng, người chạy xác nhận.
8. Chính sách thu hồi quyền đo được và đạt SLA đã duyệt.
9. M2 REAL AUTH VERIFICATION hoàn tất trên staging (tài khoản theo role).
Hiện trạng: **0/9**. B0 = **OPEN**.

---
Phụ lục — dấu vết đã đọc trong lượt này: `onl-learning` (`SecurityConfig`, `LeadController`, `ScheduleModuleController`, `GradingClassController/ServiceImpl`, `TimetableSyncServiceImpl`, `SystemSyncScheduler`, `CmsClient`, `TimetableSnapshotRepository`, `application-prod.yml`), `quiz` (`GradingServiceImpl`, `QuizAttemptServiceImpl`, `QuizAttempt`, `QuizAttemptRepository`, `GradingServiceImplTest`, `application-prod.yml`), `api-gateway`, `repo-lms-common/LmsAccessPolicy`, `Authentication_Backend` (`AuthServiceImpl`, `JwtTokenServiceImpl`, `InternalProfileController`, `UserServiceImpl`), `LMS_Frontend` (`quiz.service.ts`, `online-course.service.ts`, `router.link.tsx`), git (`b3e8362`, `git blame` của `SecurityConfig`), `docs/lms-docker-deploy.md`, ghi nhớ dự án. Không đọc giá trị bí mật; không chạy dịch vụ; không gọi mạng.
