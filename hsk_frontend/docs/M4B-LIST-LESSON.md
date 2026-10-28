# M4B — Màn "Danh sách bài học" của Giảng viên (`/instructor/list-class/list-lesson`)

Trạng thái: **UI COMPLETE · API WAITING FOR BACKEND (và API BLOCKED về mô hình định danh/quyền sở hữu lớp) · TESTED trên MOCK**. Không chức năng nào ở mức `API INTEGRATED`. **M2 REAL AUTH VERIFICATION vẫn PENDING.**
Nguồn so sánh: `LMS_Frontend` @ `72292b7` (chỉ đọc). Phạm vi: chỉ `LMS_HSK/frontend`. Checkpoint M4A: commit `f117148`, tag `m4a-checkpoint`.

## 1. Chức năng thực tế của màn cũ

`LessonListPage` (`features/instructor/class-management/lesson-list-page.tsx`, 237 dòng), PrivateRoute `TEACHER`, `MENTOR`. **Chỉ ĐỌC** — không có thao tác ghi; ba nút ở mỗi dòng chỉ điều hướng.

| Hạng mục | Thực tế ở bản cũ |
|---|---|
| URL / tham số | `/instructor/list-class/list-lesson?classId=&courseId=[&page=]`. `classId` quyết định lớp và là tham số duy nhất gọi API; `courseId` chỉ chuyển tiếp; **số trang nằm trong URL** (`?page=`, `setSearchParams(..., { replace: true })`) để nút back của trình duyệt về đúng trang đang xem |
| Dữ liệu | `quizService.getGradingClassSchedules(classId)` = `GET {quiz}/grading/classes/{classId}/schedules` (id nối thẳng vào đường dẫn, **không mã hoá**). Có `classId` thì gọi một lần khi `classId` đổi; **không có `classId` thì không gọi API** và bảng hiện "Chưa có bài học" |
| Tìm kiếm | Một ô "Tìm kiếm" (placeholder "Tên bài học") lọc theo `title` **hoặc** `topic`, không phân biệt hoa/thường; state cục bộ; chỉ khi người dùng gõ mới về `page=1` (có cờ `isFirstKeywordRender` để không ghi đè trang lúc mount) |
| Sắp xếp | Theo `sessionNo` tăng dần (thiếu ⇒ cuối), cùng số buổi theo tiêu đề tiếng Việt có số; không sắp theo cột |
| Phân trang | antd `Pagination` 10 dòng/trang, không đổi cỡ trang; STT liên tục |
| Bảng | STT, Tên bài học (tiền tố "Buổi N:" nếu title chưa bắt đầu bằng "buổi", chủ đề sau ": "; màu đỏ sẫm `#800020` nếu `hasAssignment`, xanh nhạt `#71A6D2` nếu không; in đậm), 3 nút biểu tượng: Chi tiết bài học, Danh sách nộp bài (chấm đỏ `*` nếu `hasPendingGrading`), Phân tích học tập |
| Điều hướng | Breadcrumb "Danh sách lớp học" (`Link` về `/instructor/list-class`) › "Danh sách bài học"; ba nút `navigate()` (push) tới `submissions` / `lesson-detail` / `learning-analysis` với query `?classId&courseId&scheduleId=<syllabusScheduleId \|\| sessionId>&title=` |
| Loading / empty / error | Spinner dưới bảng; "Chưa có bài học"; **lỗi chỉ toast rồi hiện "Chưa có bài học"** (che lỗi) |
| Layout / CSS | `.content > .container > .row` + `InstructorSidebar` + `.col-lg-9`; `class-management.css` (đã có từ M4A); `ProfileCard` là `() => null` |

## 2. Đã chuyển / chưa chuyển

**Đã chuyển (toàn bộ chức năng của màn):** breadcrumb, ô tìm kiếm, sắp xếp theo buổi, định dạng/màu tiêu đề, bảng, ba nút điều hướng (query đúng contract), phân trang qua `?page=` (replace), các trạng thái.
Luồng `/instructor/list-class` → bấm mã lớp → `list-lesson?classId&courseId` hoạt động, đọc đúng `classId`/`courseId`, reload URL trực tiếp vẫn chạy, nút back/breadcrumb về danh sách lớp.

**Chưa chuyển** (giữ NOT_MIGRATED, hiện trang "Chức năng đang được chuyển đổi" ở đúng URL; không tạo màn giả): `lesson-detail`, `submissions`, `grading`, `learning-analysis` (+ `/detail`) — ngoài phạm vi M4B (yêu cầu mục 11).

## 3. Khác biệt có chủ đích so với bản cũ

| # | Bản cũ | Bản mới | Lý do / bằng chứng |
|---|---|---|---|
| 1 | Thiếu/rỗng `classId` ⇒ "Chưa có bài học" (không gọi API) | Thông báo "Thiếu mã lớp (classId)…" (không gọi API, không toast) | Không nói sai rằng lớp không có bài học; probe: old = "Chưa có bài học", API 0 lần; new = thông báo, API 0 lần |
| 2 | `classId` bất kỳ được nối vào đường dẫn API | `classId` không hợp lệ (`/ \ ? # %`, ký tự điều khiển, `.`/`..`, > 128 ký tự) ⇒ thông báo, **không gọi API**; id hợp lệ được `encodeURIComponent` | "Không gọi API với tham số không hợp lệ" (yêu cầu mục 3); 23 ca test |
| 3 | `?page=-3` ⇒ bảng trống ("rows 0"); `?page=99` ⇒ bảng trống với trang 3 active | Số nguyên ≥ 1 ngược lại ⇒ trang 1; quá lớn ⇒ trang cuối | Probe trên bản cũ production: `page=-3` old 0 dòng / new 10 dòng; `page=99` old 0 dòng / new 3 dòng (trang cuối). `page=abc`/`0` cho kết quả như nhau (trang 1) |
| 4 | Lỗi (kể cả 403 lớp không thuộc giảng viên) ⇒ toast rồi "Chưa có bài học" | Toast như cũ + khối lỗi có "Thử lại"; chưa cấu hình ⇒ "WAITING FOR BACKEND" | Không che lỗi backend |
| 5 | Phản hồi không phải mảng ⇒ coi là rỗng | Lỗi hợp đồng | Không che lỗi |
| 6 | `Link` react-router | `next/link` (prefetch tắt); `Pagination` đổi trang bằng `router.replace` (`scroll: false`) | Next.js |
| 7 | — | `type="button"`, `aria-label` cho ba nút biểu tượng; `htmlFor`/`id` cho ô tìm kiếm | Khả năng truy cập, không đổi hiển thị |

## 4. Cấu trúc source

```
app/(management)/instructor/list-class/list-lesson/page.tsx          page mỏng (bọc Suspense vì dùng useSearchParams)
components/management/instructor-lesson-list/
  instructor-lesson-list-page-content.tsx   container: đọc classId/courseId/page từ URL, tìm kiếm cục bộ, ghi ?page= (replace), điều hướng
  instructor-lesson-list-view.tsx           view thuần (DOM/CSS như lesson-list-page.tsx cũ)
  use-class-lessons.ts                      tải theo khoá classId (tái dùng use-keyed-fetch của M3B.4): đổi lớp ⇒ bỏ phản hồi lớp cũ, không lẫn dữ liệu
lib/lesson-list/lesson-list-params.ts       checkClassId / parsePage / clampPage / readCourseId (an toàn tham số URL)
lib/lesson-list/lesson-list-model.ts        lọc + sắp xếp, tiêu đề/màu, liên kết sang màn kế tiếp
lib/api/quiz-grading-client.ts              + listClassSchedules (GET /grading/classes/{classId}/schedules, id được mã hoá)
types/grading.ts                            + GradingScheduleResponse
```

Tái dùng: `ManagementShell`/`ManagementPageFrame`/`ManagementSidebar`, `quiz-client` (cùng service quiz, **không** client thứ hai), `class-management.css` (M4A), `useKeyedFetch`. Không Redux slice, không abstraction mới.

## 5. API, quyền và định danh giảng viên

API: `GET {quiz}/grading/classes/{classId}/schedules` — WAITING FOR BACKEND. Backend chung IELTS **không có endpoint tương đương** (`GET /classes/{classId}/sessions` là ADMIN-only, thiếu `title/topic/syllabusScheduleId/hasAssignment/hasPendingGrading`). Chi tiết: `docs/api-requirements/instructor-list-lesson.md`.

**Danh tính giảng viên:** HSK cũ xác định giảng viên theo **email** và kiểm tra quyền sở hữu lớp ở `onl-learning` (`hasSnapshotClassAccess`/`assertCmsClassAccess`); controller quiz không kiểm tra. Frontend mới **không** gửi email/định danh nào để xác định lớp và **không** coi guard route là quyền. Yêu cầu backend (đã đưa vào `docs/BACKEND-AUTH-HANDOVER.md` mục 2, mục B0 — P0, trạng thái **API BLOCKED**): xác định giảng viên từ principal đã xác thực, tự ánh xạ sang dữ liệu lớp, kiểm tra quyền sở hữu từng `classId` ở server (403/404, không trả 200 rỗng).

Quyền frontend: chỉ `ROLE_TEACHER`, `ROLE_MENTOR` (PrivateRoute HSK cũ của chính `list-lesson` ∩ role hỗ trợ). Admin, Teacher-manager, Collaborator, Manager, User, không role ⇒ trang "không có quyền", không sidebar, **không request** tới API buổi học. Chưa đăng nhập ⇒ Auth đúng một lần, redirect về **đúng URL kèm query** (kể cả `&page=`), không gọi API.

## 6. Registry

148 route khu quản lý = **6 MIGRATED** (+`/instructor/list-class/list-lesson`) + **69 NOT_MIGRATED** (5 route con còn lại của list-class: `lesson-detail`, `submissions`, `grading`, `learning-analysis`, `learning-analysis/detail`) + **49 UNKNOWN** (không đổi) + **24 OUT_OF_SCOPE**. Menu Giảng viên không đổi (3 MIGRATED / 10 NOT_MIGRATED / 1 UNKNOWN: mục "Quản lý lớp học" trỏ `/instructor/list-class`).

## 7. Kết quả kiểm thử

Bản sao sạch (sao chép cây làm việc sang thư mục mới, `npm ci`, không dùng node_modules/.next của cây chính), cổng rảnh:

| Bước | Kết quả |
|---|---|
| `npm ci` | OK |
| `npm run typecheck` | 0 lỗi |
| `npm run lint` | 0 lỗi/cảnh báo |
| `npm test` (Vitest) | **634/634** (M4A: 565; +69: logic thuần/tham số URL 45, màn danh sách bài học 23, cập nhật placeholder) |
| `npm run e2e:build` | OK (build production + quét địa chỉ mock) |
| `npm run test:e2e` (Playwright, MOCK) | **343/343**, 23,9 phút (M4A: 308): 27 ca màn danh sách bài học + 8 ảnh visual mới. Reporter chẩn đoán: "đóng băng 0s, test nghi ngờ 0"; `globalTimeout` 60 phút (dùng ~40%) |
| `npm run test:e2e:dev` | 1/1 |

Trong quá trình phát triển chỉ chạy test liên quan; bộ đầy đủ chạy ở cuối. **Lần chạy sạch đầu tiên có 3 ca lỗi** (không có "nhảy đồng hồ", không máy ngủ trong lúc chạy), đã điều tra từng ca rồi chạy lại toàn bộ:
1. `auth.spec.ts:100` — `page.goto: net::ERR_NO_BUFFER_SPACE` tới mock (Windows hết bộ đệm socket, ngay lúc mở trang, thời lượng 0s; máy còn ~2,3/14 GB RAM trống và hàng trăm kết nối TIME_WAIT). **Nguyên nhân môi trường**, không phải ứng dụng; chạy riêng đạt, chạy lại toàn bộ đạt. Không thêm retry (giữ `retries: 0`).
2. `instructor-class-list.spec.ts:181` ("đang tải") — **thiết kế test yếu**: phụ thuộc cửa sổ 4 giây cố định của mock "slow"; khi máy tải nặng spinner đã hết trước lúc kiểm tra. Đổi sang giữ lời gọi bằng `page.route` có cổng (xác định, như spec thông báo ở M3B.4); áp dụng cho cả ca tương tự của list-lesson.
3. `notifications-page.spec.ts:248` (toast lỗi) — toast của sonner chỉ tồn tại vài giây; kiểm tra toast bị đặt sau các kiểm tra khác. Đổi thứ tự: kiểm tra toast NGAY khi lỗi xuất hiện.
Cả ba ca chạy riêng đạt sau khi sửa; chạy lại toàn bộ bản sao sạch: 343/343.

### Hồi quy các màn cũ

Toàn bộ nằm trong 343 ca và **đều đạt**: Admin Class Management, Instructor Welcome, Instructor Notifications, Admin Notifications (gửi vẫn khoá mặc định, spec chưa-cấu-hình đạt), Instructor List Class (kể cả luồng bấm mã lớp), sidebar Admin/Giảng viên × 6 tình huống × 3 khung, chuông, toast ticket, placeholder, registry/navigation, guard/role, `css-fidelity`.
Thay đổi spec có giải thích: các spec dùng `/instructor/list-class/list-lesson` làm trang placeholder (M4A) chuyển sang `/instructor/list-class/submissions` (route NOT_MIGRATED); 4 ảnh chuẩn teacher (`placeholder-teacher-{desktop,tablet,mobile}`, `teacher-bell-open-desktop`) đổi vì **chỉ khác dòng chữ đường dẫn trong mô tả placeholder**; ca `instructor-class-list.spec` "bấm mã lớp" giờ kiểm tra màn thật; `REAL_PAGE_MARKER` có thêm route mới.

### So sánh với HSK cũ (cùng fixture, Edge headless, mạng chặn, đồng hồ đóng băng 23/10/2026 09:00 +07; lớp 60, 23 buổi trả đảo ngược thứ tự, có/không bài tập, có/không chờ chấm, thiếu `sessionNo`, thiếu `title`)

Bản cũ được so ở **hai chế độ**:
- **Vite dev (StrictMode)**: 18/19 ca 0 pixel; 1 ca (`url-page2`: vào thẳng `?page=2`) khác vì **React.StrictMode của bản cũ chạy dev chạy hai lần effect lúc mount**, làm cờ `isFirstKeywordRender` bị lật và `setPage(1)` ghi đè trang trong URL (bản cũ gọi API 2 lần, bản mới 1 lần). Đây là hiện tượng của môi trường dev, không phải hành vi cố ý.
- **Bản cũ BUILD PRODUCTION** (không StrictMode; build vào thư mục tạm ngoài repo, `vite preview`): **19/19 ca khớp 0 pixel** (`maxDelta 0`), DOM, tiêu đề, màu từng dòng, nút, chấm đỏ, ô tìm kiếm, breadcrumb, chân bảng, số trang trùng; **số lời gọi API 1/1**; không cuộn ngang; 0 lỗi trang. Gồm: danh sách (desktop/tablet/mobile, kèm cả `.content` có sidebar), 3 buổi, rỗng (3 khung), trang 2 (desktop, mobile), trang 3, vào thẳng `?page=2`, tìm kiếm theo tên (desktop, mobile) và theo chủ đề, tìm không có kết quả, rê chuột lên nút (thường và nút có chấm đỏ), rê chuột lên dòng, đang tải.
Query bất thường (probe trên bản cũ production vs mới): xem mục 3 (khác biệt có chủ đích, không đặt vào phép so ảnh pixel). `page=abc`, `page=0`, thiếu `courseId`: hai bản cho kết quả như nhau.
Không tuyên bố pixel-perfect ngoài các ca đã đo ở trên.

## 8. Giới hạn chưa xác minh

- Mọi dữ liệu là MOCK; chưa gọi API/Auth thật; M2 REAL AUTH VERIFICATION vẫn PENDING.
- Hợp đồng `GET /grading/classes/{classId}/schedules`, mô hình danh tính/quyền sở hữu lớp, mã lỗi khi không thuộc lớp: chưa backend xác nhận.
- Ảnh chuẩn visual chỉ có trên Windows + Chromium + Internet.
- So ảnh với HSK cũ dùng dữ liệu giả giống nhau, bản cũ **build production** (xem mục 7); trạng thái chờ backend/lỗi/query bất thường là khác biệt có chủ đích nên không đặt vào phép so ảnh pixel.
