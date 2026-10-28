# Báo cáo bàn giao M5 — Frontend quản lý LMS HSK (Admin/Giảng viên) trên Next.js

Ngày: 2026-10-27. Người nhận: chủ dự án (frontend) và người phụ trách backend/Auth của `LMS_IELTS`.
Mã nguồn: `LMS_IELTS/hsk_frontend` (sao chép từ `LMS_HSK/frontend`, nhánh `main`; **chưa push**). Tài liệu chi tiết: `docs/FEATURE-STATUS.md` (bảng từng màn), `docs/DEPLOY.md`, `docs/PREVIEW-LOCAL.md`, `docs/api-requirements/*.md` (hợp đồng gửi backend).

## 1. Hai kết luận (tách riêng, theo yêu cầu)

### Kết luận 1 — ADMIN/TEACHER UI (xem trước cục bộ): **SẴN SÀNG**

- **Toàn bộ 22 mục menu Admin và 14 mục menu Giảng viên là trang thật** (registry: 41 route MIGRATED kể cả route có tham số; 0 mục menu còn là "Chức năng đang được chuyển đổi"). Mục duy nhất không phục vụ: `Yêu cầu hỗ trợ` (UNKNOWN — HSK cũ không có PrivateRoute; chờ quyết định D-UI-1 → 404).
- Chạy xem trước: `npm ci && npm run preview:local` → http://localhost:3100/demo → chọn Quản trị viên / Giảng viên / Trợ giảng / Học viên. Bản build là **production thật** (không mock trong code), dữ liệu giả lập nằm ở máy chủ giả lập ngoài ứng dụng (12 lớp, 40 học viên, 4 giảng viên, buổi học, bài nộp/chấm bài, thông báo, ticket, kho nội dung 7 module, khoá học, tài liệu, sao kê, gói thành viên); thao tác ghi đổi dữ liệu trong bộ nhớ của mock; nút "Reset dữ liệu giả lập".
- Cả hai luồng cam kết trong `docs/M5-FULL-DEMO-PLAN.md` mục 1 đi hết: Admin (dashboard → lớp → học viên lớp → giảng viên → khoá học → giáo trình → 7 module nội dung → tài liệu → kho lưu trữ → thông báo → phân tích → sao kê → phân công → gói) và Giảng viên (tổng quan → lớp → bài học → bài nộp → chấm → chi tiết bài học → phân tích học tập → thông báo → phân công → nội dung theo ticket).
- Giới hạn có chủ đích (D-UI-2/D-UI-3, ghi ở `FEATURE-STATUS.md` cột UI): dashboard chuẩn hoá theo pattern IELTS; modal react-bootstrap → antd; **chưa chuyển**: import Excel ở mọi màn nội dung, phụ đề karaoke (kho lưu trữ), tạo nội dung/đề luyện/chọn video trong modal giáo trình, SENTENCE_BUILDER + chấm AI của bài tập, import từ điển bất đồng bộ + bảng 214 bộ thủ, hoạt hình nét chữ.
- Kiểm thử: xem mục 4 (số liệu lần chạy cuối).

### Kết luận 2 — TÍCH HỢP BACKEND THẬT: **CHƯA SẴN SÀNG** (một phần AVAILABLE, phần lớn MISSING/BLOCKED; chưa có gì INTEGRATED)

| Dịch vụ | Trạng thái | Căn cứ |
|---|---|---|
| Authentication chung (`/users/me`, refresh, logout, callback cookie/hash) | theo mã + mock; **REAL AUTH VERIFICATION PENDING** | chưa có môi trường/tài khoản dev/staging (`docs/AUTH-INTEGRATION.md` mục 8) |
| `/api/lms` (repo-lms Java): lớp, học viên, giáo trình của Admin | **AVAILABLE / PARTIAL** — client viết theo DTO trong source, test hợp đồng trên mock; thiếu endDate/actualEndDate/studentCount/ungradedCount/totalSessions ⇒ "—" | `docs/api-requirements/class-management.md` mục 0, `syllabus-modules.md` |
| `/api/notification` (repo-notification Go): chuông, danh sách, đã đọc | **AVAILABLE** — hợp đồng thật; lọc + "đọc tất cả" làm ở client; chiến dịch Admin không có REST | `notifications.md` mục 0 |
| `/api/storage` (repo-storage Go): presign → PUT → confirm | **AVAILABLE** — dùng cho ảnh/âm thanh/tài liệu/video | `lesson-materials.md`, `hsk-storage.md`, `content-tree.md` |
| Luồng giảng viên (lớp được phân công, buổi, bài nộp, chấm, chi tiết bài học, phân tích học tập) | **BLOCKED (B0)** — backend chung chỉ có `ROLE_ADMIN`, không có endpoint giảng viên; hợp đồng đề xuất đi qua `NEXT_PUBLIC_QUIZ_API_BASE_PATH` | `B0-*.md`, `instructor-*.md`, `learning-analysis.md` |
| Dịch vụ HSK: dashboard/analytics, giảng viên, thanh toán (sao kê, gói), khoá học trực tuyến + leads, tài liệu (metadata), kho lưu trữ (cây), kho nội dung 7 module, module theo buổi của giáo trình, ticket | **MISSING** — hợp đồng đề xuất qua `NEXT_PUBLIC_HSK_API_BASE_PATH` / `NEXT_PUBLIC_TICKET_API_BASE_PATH` | 12 tài liệu `docs/api-requirements/*.md` |

Ở production (biến HSK/QUIZ/TICKET để trống) các màn tương ứng hiện **WAITING FOR BACKEND**, không gọi mạng, không dữ liệu giả; mọi thao tác ghi chưa có hợp đồng xác nhận bị **công tắc ghi** chặn trước khi tạo request (`docs/DEPLOY.md` mục 5). Việc cần từ backend/chủ dự án: mục 5.

## 2. Đã làm gì (phạm vi M5)

| Nhóm | Nội dung |
|---|---|
| Nền tảng | Tầng API tách **backend chung** (`lmsClient`, notification-client, storage-client) khỏi **hợp đồng đề xuất** (`hskClient`, `quizClient`, ticket-client); write gate 10 feature + công tắc gửi chiến dịch; chế độ xem trước cục bộ (`preview:local`, `/demo`, băng-rôn, chỉ loopback/mạng riêng); mock module hoá (`scripts/mock/{core,server,data,handlers}`, hồ sơ `e2e` đóng băng + `demo`); component dùng chung (PageHeader, DataTable, confirmAction, FetchStateNotice/WriteLockedNotice, ApexChart); vá antd static API cho React 19; Dockerfile + docker-compose theo mẫu IELTS |
| Admin (W1-E, W1-D, W1-C, W2-C, W2-D) | dashboard, analytics, học viên của lớp (nguồn `/api/lms`), quản lý giảng viên, khoá học trực tuyến + leads (ADMIN only), tài liệu học tập (byte qua repo-storage), giáo trình (đọc thật `/api/lms/syllabuses`) + module theo buổi, kho lưu trữ, sao kê, phân công công việc, gói thành viên |
| Giảng viên (W1-A, W1-B, W1-C) | danh sách nộp bài, chấm bài (từng câu/câu hỏi, gửi kết quả), chi tiết bài học, phân tích học tập + chi tiết (nhận xét, AI chỉ tư vấn), phân công công việc |
| Kho nội dung (W2-T, W2-E, W2-B) | nền cây Package → Folder → Study set → mục (URL state, CRUD/publish, quyền ticket): thẻ ghi nhớ/bộ từ vựng/bộ thẻ, Hán tự (5 route), phát âm (2), bài tập + trình soạn câu hỏi 6 loại, ngữ pháp; từ điển (màn riêng, tìm/phân trang máy chủ) |
| Hợp đồng gửi backend | 17 tài liệu `docs/api-requirements/` (mới ở M5: admin-overview, instructor-grading, learning-analysis, teacher-management, syllabus-modules, work-tickets, payment, online-course, lesson-materials, hsk-storage, content-tree, dictionary; cập nhật: class-management mục 0, notifications mục 0) |
| Sửa lỗ hổng kế thừa từ HSK cũ (ở hợp đồng + frontend) | `classId` bắt buộc; học viên định danh bằng `userId` thay email trên URL (U1–U3); `/leads` chỉ ADMIN (U5); không `200 []` khi từ chối; không fallback dữ liệu giả (gói thành viên, lưu chi tiết bài học "thành công giả", số 0 khi lời gọi phụ lỗi); bỏ N+1 ở client |

## 3. Không làm / không mở rộng (đúng ràng buộc)

Không sửa `LMS_IELTS/frontend|backend`, `LMS_Frontend`, `LMS_Backend`, `Authentication`, CSDL, production; không push/merge/deploy; không gọi endpoint U1–U6; không nới guard production (`next.config.ts`), không fallback mock trong `src/`; không ánh xạ/mở rộng role (Teacher-manager/Collaborator vẫn UNKNOWN ⇒ 404; `Yêu cầu hỗ trợ` chờ D-UI-1); công tắc gửi thông báo và mọi công tắc ghi mặc định ĐÓNG; giữ 22 `overrides` + webpack; Playwright `retries: 0`; B0 vẫn OPEN; M2 REAL AUTH VERIFICATION PENDING.

## 4. Kiểm thử (lần chạy cuối trên bản bàn giao)

| Tầng | Lệnh | Kết quả |
|---|---|---|
| Kiểu + lint | `npm run typecheck`, `npm run lint` | **sạch** (tsc 0 lỗi; eslint 0 lỗi, 1 cảnh báo sẵn có ở `tests/online-course-leads.test.tsx`) |
| Vitest | `npm test` | **87 file / 1.358 ca**: lần chạy đầy đủ sau khi gộp 10 gói = 1.355 đạt, 3 ca `tests/content-hanzi.test.tsx` hết 30s do tải khi chạy song song (chạy riêng vài giây) → nâng timeout 90s cho 3 file nội dung nặng (`1515d2d`), chạy lại 3 file: 50/50 đạt. Thời lượng cả bộ ~5 phút |
| Playwright (mock cách ly: configured + unconfigured + visual) | `npm run e2e:build && npm run test:e2e` | **344 ca**. Lần chạy 1 trên bản gộp đủ 10 gói: 326 đạt / 18 lỗi, 3 nguyên nhân đều ở phía kiểm thử, không phải ứng dụng: (a) 8 ca `class-management.spec` — helper `stubSession` còn chặn đường dẫn cũ `/api/notification/unread-count` (client mới gọi `/notifications/unread-count`) nên sidebar chạm mock không cookie → 401 → bị đá ra login; (b) 7 ca `notifications-page.spec` + `admin-notifications.spec` — spec cũ giả định backend lọc `readStatus/fromDate/page` phía server, hợp đồng thật của repo-notification không lọc (client lấy mọi trang rồi lọc); (c) 1 ca `instructor-lesson-list.spec` — marker màn Chi tiết bài học thiếu trạng thái "Buổi này chưa có bài tập"; 2 ảnh sidebar teacher desktop (bell-open, toast) đổi vì khung Giảng viên nay đo trên trang thật. Đã sửa spec/ảnh chuẩn (`07b5058`, `6a840ad`, `89d3581`); chạy lại 4 spec liên quan: 86/86 đạt. Lần chạy 2 toàn bộ (tối 27/10) bị **gián đoạn vì máy ngủ ~3 giờ** (reporter chẩn đoán ghi nhận đóng băng 10.789s; ca đang chạy gặp `net::ERR_NETWORK_IO_SUSPENDED`): 221 đạt / 0 lỗi thật / 123 chưa chạy. **Lần chạy cuối (sáng 28/10, bản `a3ac74f`): 344/344 đạt, 25,4 phút, 0 đóng băng, 0 ca nghi ngờ** (configured 3100 + unconfigured 3101 + visual; ảnh chuẩn Windows) |

Lưu ý: "PASS" ở Playwright/Vitest nghĩa là frontend xử lý đúng **hợp đồng mà mock mô phỏng** (DTO đọc từ source backend chung hoặc hợp đồng đề xuất) — **không** chứng minh Auth thật hay backend thật hoạt động. Ảnh chuẩn placeholder (`placeholder-{admin,teacher}-*.png`) đổi có chủ đích vì route placeholder đổi (`/admin/profile`, `/learning-path/manage`).

## 5. Quyết định / việc cần từ chủ dự án và backend

| Mã | Việc | Ai |
|---|---|---|
| D-API-1 | Cấp môi trường dev/staging + tài khoản ADMIN/TEACHER/MENTOR để xác minh Auth, `/api/lms`, `/api/notification`, `/api/storage` (AVAILABLE → INTEGRATED); checklist `docs/DEPLOY.md` mục 4 | backend/Auth |
| D-API-2 | Endpoint giảng viên theo B0 (lớp được phân công từ principal, buổi, bài nộp, chấm, phân tích; `classId` bắt buộc; không `200 []`) | backend |
| D-API-3 | repo-notification: lọc server, `POST /notifications/read/all`, `targetUrl`; REST chiến dịch Admin | backend |
| D-API-4 | Dịch vụ HSK theo 12 hợp đồng đề xuất (hoặc chốt đường dẫn/hình dạng khác — frontend đổi client) | backend |
| D-API-5 | `/api/lms/classes`: trường còn thiếu hoặc endpoint thống kê lớp; phân trang/lọc server | backend |
| D-UI-1 | `Yêu cầu hỗ trợ` cho vai trò nào | chủ dự án |
| D-UI-2 | Chấp nhận UI chuẩn hoá (dashboard, modal antd) | chủ dự án |
| D-UI-3 | Chấp nhận phạm vi rút gọn (mục 1, Kết luận 1) hoặc đặt hàng chuyển tiếp | chủ dự án |

## 6. Đường lên production (sau khi xem trước ổn)

1. Backend/Auth cấp môi trường (D-API-1) → đặt `NEXT_PUBLIC_AUTH_*`, `/api/lms`, `/api/notification`, `/api/storage`; **để trống** HSK/QUIZ/TICKET và mọi `NEXT_PUBLIC_WRITE_*`.
2. `docker compose build && up` theo `docs/DEPLOY.md`; chạy checklist mục 4 của DEPLOY.md với tài khoản thật; ghi kết quả vào `FEATURE-STATUS.md` (AVAILABLE → API INTEGRATED từng dòng).
3. Khi backend triển khai từng hợp đồng: đặt base path tương ứng → kiểm tra màn đọc → mở công tắc ghi → build lại.

## 7. Rủi ro còn mở

- Hình dạng thật của phản hồi backend chung (envelope, lỗi 403 code 233, giới hạn `size`) chưa được quan sát trên môi trường thật — client đọc từ source, không từ traffic.
- Mô hình quyền giảng viên (B0) chưa chốt: nếu backend chọn hướng khác (vd. teacher qua ERP), các client `quizClient` cần viết lại phần định danh lớp/buổi.
- Teacher-manager/Collaborator: HSK cũ có nhiều route cho họ; frontend mới không phục vụ cho tới khi có quyết định + xác minh role với Auth thật.
- Ảnh chuẩn visual chỉ tái lập trên Windows + Chromium + Internet (Google Fonts).

## 8. Lịch sử commit M5 (nhánh `main`, `git log --oneline`)

Nền tảng: `b843291` docs B0 → `7efee8c` mock module → `652bc2b` nền tảng M5 (demo mode, write gate, lmsClient) → `4ce5cfa` notification theo contract thật + hskClient + Docker → `355bd36` ticket-access → `f8f0c90`.
Gói màn: `264ce19` W1-E → `fd52a19` W1-A → `5ffc720` W1-B → `2bd3a63` W1-D → `6c4ce66` W2-D → `f16e208` W2-T → `ba66ca4` W2-C → `e01594b` W1-C → `6de5723` W2-E → `0720f72` W2-B.
Tích hợp/kiểm thử/tài liệu: `9f07cdb`, `e70fc0c` (e2e spec), `dde37d7` (unit test), `7928ce2`, `7af9c36` (DEPLOY), `fe68655`, `56ff2af`, `e6295ae` (FEATURE-STATUS), `c1c95e8`, `fe40ecf` (README), `14cde24` (TESTING) và các commit sau khi chạy kiểm thử cuối (xem log).
