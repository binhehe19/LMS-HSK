# M4A — Màn "Quản lý lớp học" của Giảng viên (`/instructor/list-class`)

Trạng thái: **UI COMPLETE · API WAITING FOR BACKEND · TESTED trên MOCK**. Không chức năng nào ở mức `API INTEGRATED`. **M2 REAL AUTH VERIFICATION vẫn PENDING.**
Nguồn so sánh: `LMS_Frontend` @ `72292b7` (chỉ đọc). Phạm vi: chỉ `LMS_HSK/frontend`. Checkpoint M3B.4: commit `0b50973`, tag `m3b4-checkpoint`.

## 1. Chức năng thực tế của màn cũ

`ClassListPage` (`features/instructor/class-management/class-list-page.tsx`, 254 dòng), PrivateRoute `TEACHER`, `MENTOR`. **Chỉ ĐỌC** — không có thao tác ghi nào.

| Hạng mục | Thực tế ở bản cũ |
|---|---|
| Dữ liệu | `quizService.getGradingClasses()` = `GET {quiz}/grading/classes` — lớp của chính giảng viên (backend lấy theo email của principal; `hasPendingGrading` từng lớp; lớp còn bài chờ chấm lên trước). Tải **một lần** khi vào trang; không có làm mới |
| Bộ lọc (phía client, trên toàn bộ danh sách) | Khóa học (gộp theo tên không phân biệt hoa/thường, sắp theo tiếng Việt), Mã lớp (theo khoá đã chọn; nhãn "Tên (mã)"), Thời gian (Mọi thời gian / Ngày chính xác + ô ngày mặc định hôm nay / Hôm nay / Ngày mai / Hôm qua / 7 ngày qua / 7 ngày tới) |
| Sắp xếp | Lớp còn bài chờ chấm lên đầu (ổn định); bảng không có sắp xếp theo cột |
| Phân trang | antd `Pagination` 10 dòng/trang, không đổi cỡ trang; đổi bộ lọc về trang 1; STT liên tục |
| Bảng | STT, Mã lớp (liên kết), Khóa học, Giáo viên (huy hiệu chữ cái đầu + tên + email), Ngày bắt đầu, Ngày kết thúc dự kiến, Số học viên, Bài chưa chấm (chấm đỏ `*` / `✓`); ô trống hiện `-`; bảng `min-width: 900` cuộn ngang trong `.table-responsive`; chân bảng dính (`cm-sticky-footer`) |
| Click | Mã lớp → `all_routes.listLesson?classId=&courseId=` (`/instructor/list-class/list-lesson`); **không có** click ở dòng/ô nào khác |
| Loading / empty / error | Spinner dưới bảng; "Chưa có lớp được phân công" / "Không có lớp phù hợp bộ lọc"; **lỗi chỉ toast rồi hiện trạng thái rỗng "Chưa có lớp được phân công"** (che lỗi) |
| Layout / CSS | `.content > .container > .row` + `InstructorSidebar` + `.col-lg-9`; `class-management.css` (toàn bộ khu Quản lý lớp: `.cm-*`); `ProfileCard` là `() => null` |
| Router | `routes.listClass` = `/instructor/list-class`; 6 route con (`list-lesson`, `lesson-detail`, `submissions`, `grading`, `learning-analysis`, `learning-analysis/detail`) |

## 2. Đã chuyển / chưa chuyển

**Đã chuyển (toàn bộ chức năng của màn):** khung trang, 3 bộ lọc (kể cả ô ngày), sắp xếp, phân trang, bảng, liên kết mã lớp, các trạng thái loading/rỗng/lọc không khớp. Giao diện khớp HSK cũ **0 pixel ở 21/21 ca** (mục 6).

**Chưa chuyển và lý do** (giữ trạng thái chính xác NOT_MIGRATED, hiện trang "Chức năng đang được chuyển đổi" ở đúng URL, không tạo màn giả):

| Route | Chức năng cũ (phụ thuộc) | Lý do chưa chuyển |
|---|---|---|
| `/instructor/list-class/list-lesson` | `getSchedules` (lịch buổi của lớp) | Ngoài phạm vi M4A (yêu cầu mục 11); API chưa có trong backend chung |
| `/instructor/list-class/lesson-detail` | `getLessonDetail` (chuỗi lời gọi onl-learning + quiz) + `saveLessonDetail` | Ngoài phạm vi; ghi |
| `/instructor/list-class/submissions` | `getStudents` (bài nộp + tính điểm từng attempt) | Ngoài phạm vi |
| `/instructor/list-class/grading` | `getAttempt`, `getStudentModules`, **`gradeAnswer`, `gradeQuestion`, `sendAttempt`** (ghi) | Ngoài phạm vi; thao tác ghi nhạy cảm cần hợp đồng backend |
| `/instructor/list-class/learning-analysis` (+`/detail`) | `getStudents`; phân tích học tập, ghi chú giáo viên, báo cáo AI (`personalizationService`) | Ngoài phạm vi |

Những khác biệt có chủ đích so với bản cũ:

| # | Bản cũ | Bản mới | Lý do |
|---|---|---|---|
| 1 | Lỗi/chưa cấu hình: toast rồi "Chưa có lớp được phân công" | Chưa cấu hình: dòng "WAITING FOR BACKEND" (không toast); lỗi: toast như cũ + dòng lỗi có "Thử lại"; không bao giờ nói "chưa có lớp" khi chưa biết | API chưa sẵn sàng / che lỗi |
| 2 | Phản hồi không phải mảng bị coi là rỗng | Lỗi hợp đồng | Không che lỗi |
| 3 | Khung hình đầu hiện "Chưa có lớp được phân công" trước khi tải | Hiện spinner ngay | Sửa nhấp nháy |
| 4 | `Link` của react-router | `next/link`, prefetch tắt | Next.js |
| 5 | — | `role="img"`/`aria-label` cho chấm đỏ và dấu ✓ | Khả năng truy cập, không đổi hiển thị |
| 6 | StrictMode dev gọi API 2 lần | 1 lần | Chỉ là hiện tượng của dev React StrictMode ở bản cũ |

## 3. Cấu trúc source

```
app/(management)/instructor/list-class/page.tsx          page mỏng
components/management/instructor-class-list/
  instructor-class-list-page-content.tsx   container: hook + state bộ lọc/trang cục bộ
  instructor-class-list-view.tsx           view thuần (DOM/CSS như class-list-page.tsx cũ)
  use-teacher-classes.ts                   tải lớp; loading/ok/not-integrated/error (dùng chung kiểu ClassListState với màn Admin)
  class-management.css                     CSS khu Quản lý lớp của Giảng viên, SAO NGUYÊN VĂN (cmp identical)
lib/class-list/class-list-filters.ts       port NGUYÊN VĂN class-list-filters.ts (kiểu GradingClassResponse)
lib/class-list/class-list-model.ts         tuỳ chọn lọc, lọc + sắp xếp ổn định, display/initials, lessonHref
lib/api/quiz-grading-client.ts             + listTeacherGradingClasses (GET /grading/classes)
styles/page-styles.ts                      + import CSS (trước admin css, đúng thứ tự import của router cũ)
```

Tái dùng: `ManagementShell`/`ManagementPageFrame`/`ManagementSidebar`, `quiz-client` (`NEXT_PUBLIC_QUIZ_API_BASE_PATH`), `GradingClassResponse`, `ClassListState`. Không Redux slice, không client/abstraction mới.

## 4. API và quyền

API: `GET {quiz}/grading/classes` — WAITING FOR BACKEND; backend chung IELTS **không có** endpoint tương đương (`GET /classes` ADMIN-only, dữ liệu khác). Chi tiết: `docs/api-requirements/instructor-list-class.md`. Danh sách bàn giao có ưu tiên: `docs/BACKEND-AUTH-HANDOVER.md`.

Quyền: chỉ `ROLE_TEACHER` và `ROLE_MENTOR` (PrivateRoute HSK cũ ∩ role hỗ trợ). Admin, Teacher-manager, Collaborator, Manager, User, không role → trang "không có quyền", không sidebar, **không request** tới API lớp (e2e). Chưa đăng nhập → Auth đúng một lần, không gọi API. Phân quyền frontend không thay thế quyền ở backend.

## 5. Registry

148 route khu quản lý = **5 MIGRATED** (`/admin/class-management`, `/admin/settings/notifications`, `/instructor/welcome`, `/instructor/instructor-notifications`, `/instructor/list-class`) + **70 NOT_MIGRATED** (6 route con của list-class giữ NOT_MIGRATED) + **49 UNKNOWN** (không đổi) + **24 OUT_OF_SCOPE**. Menu Giảng viên: 3 MIGRATED (Tổng quan, Thông báo của tôi, Quản lý lớp học) / 10 NOT_MIGRATED / 1 UNKNOWN.

## 6. Kết quả kiểm thử

Bản sao sạch (sao chép cây làm việc sang thư mục mới, `npm ci`, không dùng node_modules/.next của cây chính), cổng rảnh:

| Bước | Kết quả |
|---|---|
| `npm ci` | OK |
| `npm run typecheck` | 0 lỗi |
| `npm run lint` | 0 lỗi/cảnh báo |
| `npm test` (Vitest) | **565/565** (M3B.4: 538; +27: logic thuần/bộ lọc 15, màn danh sách lớp 11, cập nhật registry/sidebar/placeholder) |
| `npm run e2e:build` | OK (build production + quét địa chỉ mock) |
| `npm run test:e2e` (Playwright, MOCK) | **308/308**, 23,2 phút (M3B.4: 274): 27 ca màn danh sách lớp + 7 ảnh visual mới. Reporter chẩn đoán: "đóng băng 0s, test nghi ngờ 0"; `globalTimeout` 60 phút (dùng ~39%) |
| `npm run test:e2e:dev` | 1/1 |

Trong quá trình phát triển chỉ chạy các test liên quan (spec mới, visual, registry/sidebar/placeholder); bộ đầy đủ chạy một lần ở cuối để nghiệm thu.

### Hồi quy bốn màn đã chuyển và khung

Toàn bộ nằm trong 308 ca và **đều đạt, không ảnh chuẩn cũ nào phải cập nhật vì lý do giao diện**: Admin Class Management (11 ca + 3 ảnh toàn trang), Instructor Welcome (spec riêng + 5 ảnh), Instructor Notifications (24 ca + 6 ảnh), Admin Notifications (24 ca + 17 ảnh), sidebar Admin/Giảng viên × 6 tình huống × 3 khung, chuông thông báo, toast ticket, placeholder, registry/navigation (`navigation.spec`), guard/role (`auth.spec`, `management-shell.spec`), `css-fidelity` (93 thành phần + 13 hover).
Ngoại lệ có giải thích: 4 ảnh chuẩn bị cập nhật (`placeholder-teacher-{desktop,tablet,mobile}`, `teacher-bell-open-desktop`) vì **các spec cũ dùng `/instructor/list-class` làm trang placeholder**; khi route này thành trang thật, chúng được chuyển sang `/instructor/list-class/list-lesson` (route NOT_MIGRATED của Giảng viên) và phần khác biệt duy nhất của ảnh là **dòng chữ đường dẫn trong mô tả placeholder** (đã xem ảnh diff: chỉ hai dòng chữ). Một ca `navigation.spec` (landing của Giảng viên) cũng chuyển sang `/instructor/welcome` vì `/instructor/list-class` không còn là placeholder; `REAL_PAGE_MARKER` có thêm route mới.

### So sánh với HSK cũ (Vite :3101 ↔ Next :3100 bản build e2e, Edge headless, mạng chặn, cùng dữ liệu giả: 25 lớp, ngày theo đồng hồ đóng băng 23/10/2026 09:00 +07)

**21/21 ca khớp 0 pixel** (`maxDelta 0`); DOM (tiêu đề thẻ, dòng, liên kết `href`, tuỳ chọn của 3 ô chọn, ô ngày, số trang, chân bảng), không cuộn ngang và 0 lỗi trang cũng trùng: danh sách (desktop/tablet/mobile, kèm cả `.content` có sidebar Giảng viên), 3 lớp, rỗng (3 khung), lọc khoá (desktop, mobile), lọc khoá + lớp, Hôm nay, 7 ngày tới, Ngày chính xác (desktop, mobile; ô ngày hiện), ngày không có lớp ("Không có lớp phù hợp bộ lọc"), trang 2 (desktop, mobile), trang 3, rê chuột lên dòng, rê chuột lên mã lớp, đang tải (spinner).
Không có khác biệt cần phân loại. Số lời gọi API: bản cũ 2 (React.StrictMode ở dev gọi effect hai lần), bản mới 1 — không ảnh hưởng hiển thị.
Trạng thái chờ backend/lỗi/sai định dạng là khác biệt có chủ đích (mục 2) nên không đặt vào phép so ảnh.

## 7. Giới hạn chưa xác minh

- Mọi dữ liệu là MOCK; chưa gọi API/Auth thật; M2 REAL AUTH VERIFICATION vẫn PENDING.
- Hợp đồng `GET /grading/classes`, định dạng ngày, định danh email của principal, quyền: chưa backend xác nhận (xem handover).
- Bộ lọc thời gian dựa vào giờ trình duyệt; e2e dùng đồng hồ đóng băng.
- Ảnh chuẩn visual chỉ có trên Windows + Chromium + Internet.
- So ảnh với HSK cũ dùng dữ liệu giả giống nhau; trạng thái chờ backend/lỗi là khác biệt có chủ đích nên không so ảnh.
