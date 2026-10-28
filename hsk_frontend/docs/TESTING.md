# Kiểm thử

Ba tầng, đều chạy từ repository (không cần thư mục tạm của phiên làm việc nào):

| Tầng | Công cụ | Lệnh | Thời gian | Cần |
|---|---|---|---|---|
| Kiểu + lint | `tsc`, ESLint | `npm run typecheck`, `npm run lint` | ~20 giây | Node ≥ 20.9 |
| Đơn vị / component | Vitest + Testing Library (jsdom) | `npm test` | ~40 giây | không (có vài ca chạy `next build` thật để kiểm tra guard production) |
| Trình duyệt | Playwright (Chromium) + máy chủ giả lập + gateway cách ly | `npm run e2e:build` rồi `npm run test:e2e` | ~6 phút build (2 biến thể, sau M5), ~25 phút chạy (344 ca; lần đầu sau M5 ~35 phút vì có ca timeout) | trình duyệt Playwright; Internet cho visual |

`npm run test:all` chạy lần lượt tất cả (typecheck → lint → vitest → e2e:build → test:e2e).

**MOCK / NOT INTEGRATED.** Mọi kiểm thử trình duyệt chạy với `scripts/mock-server.mjs` đóng vai Authentication và backend; **không phải hệ thống thật**.
"PASS" ở đây nghĩa là frontend xử lý đúng hợp đồng mà mock mô phỏng (đọc từ code Auth/HSK cũ), **không** chứng minh Auth thật hay backend thật hoạt động
(M2 vẫn ở trạng thái REAL AUTH VERIFICATION PENDING).

## Chạy trên máy mới

```
git clone … && cd frontend
npm ci
npm run e2e:install        # tải Chromium của Playwright vào cache người dùng (~120 MB, KHÔNG nằm trong repo)
npm run e2e:build          # build production 2 biến thể vào .next-e2e và .next-e2e-unconfigured, rồi quét artifact không chứa địa chỉ mock
npm run test:e2e           # tự khởi động mock server + (next start + gateway) ×2, chạy configured + unconfigured + visual
npm run test:e2e:dev       # (tùy chọn) kiểm thử `next dev` + proxy cùng origin, cổng 3102
```

Cổng 3100/3101 (gateway), 3200/3201 (app), 3190 (mock), 3102 (dev) phải trống, hoặc đã có đúng server cần dùng (Playwright dùng lại server đang chạy khi không đặt `CI`).
`.next-e2e*`, `test-results/`, `playwright-report/` bị `.gitignore`; không commit trình duyệt, cache, token hay dữ liệu thật.

### Chạy trong CI (M3B.2)

Chạy được, **không cần nới guard production**: `npm ci` → `npx playwright install --with-deps chromium` → `npm run e2e:build` → `npm run test:e2e`. Chưa có pipeline CI trong repo (ngoài phạm vi);
phần này chỉ bảo đảm bộ kiểm thử không bị chặn bởi cơ chế an toàn. Lý do và bằng chứng an toàn ở mục dưới.

## Kiểm thử E2E cách ly (không làm yếu cơ chế chặn mock ở production)

Guard của `next.config.ts` từ chối build/chạy production có URL mock/local (`localhost`, `127.x`, `*.invalid`, `*.test`, `*_API_PROXY_TARGET`); ngoại lệ `HSK_ALLOW_MOCK_ENDPOINTS=1` bị từ chối khi có `CI` hoặc khi nằm trong `.env*`.
Trước M3B.2 bản build e2e dựa vào ngoại lệ đó nên không chạy được ở CI. **Giờ bản build e2e là một bản build production bình thường, không cần ngoại lệ nào, và guard không bị sửa:**

```
trình duyệt ──▶ gateway cách ly (scripts/e2e-gateway.mjs, 127.0.0.1:3100)  ──/api/*, /mock-login, /__auth/*──▶ mock server (127.0.0.1:3190)
                                                                            └─ còn lại ────────────────────▶ next start (127.0.0.1:3200)
```

- App được build với cấu hình **đường dẫn cùng origin** như khi triển khai sau gateway thật: `NEXT_PUBLIC_AUTH_API_BASE_URL=/api/auth`, `NEXT_PUBLIC_QUIZ_API_BASE_PATH=/api/quiz`, `/api/notification`, `/api/tickets`,
  `NEXT_PUBLIC_AUTH_FRONTEND_URL=/__auth` (xem `e2e/variants.json`). Không có URL mock nào trong cấu hình hay artifact; "giả" nằm ở hai tiến trình của harness.
- `buildAuthFrontendUrl` hỗ trợ đường dẫn cùng origin (ghép với `window.location.origin`; null khi render phía server, và sidebar dùng `useAuthFrontendUrl` để không lệch hydration). Cấu hình tuyệt đối vẫn hoạt động như trước.
- Cách ly mạng: gateway chỉ bind `127.0.0.1` và upstream cứng là `127.0.0.1` (không nhận host tùy ý nên không thể trỏ tới Auth/backend thật); mỗi test có fixture chặn **mọi** request ra ngoài loopback
  (trừ Google Fonts, tài nguyên chữ) và **làm test thất bại** nếu có.
- Bằng chứng guard còn nguyên (chạy trong `npm test`, `tests/production-guard.test.ts`): `next build` thật bị từ chối với URL Auth/Quiz/thông báo/ticket trỏ `localhost`/`127.0.0.1`/`.invalid`, với `*_PROXY_TARGET`, và
  với `HSK_ALLOW_MOCK_ENDPOINTS=1` kèm `CI=true`. `scripts/e2e-build.mjs` từ chối cấu hình trông giống mock, gỡ cờ ngoại lệ khỏi môi trường của tiến trình con, và quét `static` + `server` của artifact để chắc chắn không có địa chỉ mock.
- Giới hạn: chế độ `next dev` (`test:e2e:dev`) vẫn dùng URL mock tuyệt đối (guard chỉ áp dụng cho production), nên chỉ chạy cục bộ, không đưa vào CI.

## Cấu trúc

```
playwright.config.ts          projects: configured (3100) · unconfigured (3101) · visual (3100); workers=1 (mock có trạng thái)
playwright.dev.config.ts      project dev-proxy (next dev, 3102)
e2e/
  specs/                      auth · management-shell · notifications · navigation · instructor-welcome · class-management · unconfigured · visual · dev-proxy
  support/                    mock.ts (điều khiển mock, URL được phép), test.ts (fixture `app`, reset mock, chặn ra ngoài loopback), stub.ts (chặn API)
  fixtures/classes.ts         dữ liệu tĩnh CHỈ cho test (không bao giờ là dự phòng của app)
  variants.json               cấu hình hai biến thể build (nguồn duy nhất cho e2e-build và playwright.config)
  __screenshots__/<platform>/ ảnh chuẩn (chỉ có win32)
scripts/mock-server.mjs       điểm vào máy chủ giả lập → scripts/mock/server.mjs (HANDLERS theo thứ tự) + core.mjs (send/ok/fail/state/registerResettable)
scripts/mock/data/            hồ sơ dữ liệu: legacy.mjs = `MOCK_PROFILE=e2e` (mặc định, ĐÓNG BĂNG cho Playwright) · demo.mjs = `MOCK_PROFILE=demo` (xem trước cục bộ) · grading-model.mjs (kho chấm bài dùng chung)
scripts/mock/handlers/        một module mỗi dịch vụ: auth, control, lms, storage, notification, tickets, quiz-grading, learning-analysis, admin-overview, teachers, syllabus-modules,
                              content-tree (5 tiền tố nội dung), dictionary, online-course, lesson-materials, hsk-storage, work-tickets, payment, admin-users
scripts/e2e-gateway.mjs       gateway cách ly
scripts/e2e-build.mjs         build 2 biến thể + quét artifact
tests/                        Vitest (+ tests/support, tests/fixtures)
```

Quy tắc với mock (M5): mỗi handler đăng ký `registerResettable` để `/__auth/mock-reset` đưa dữ liệu về ban đầu; thao tác ghi phải đổi dữ liệu trong bộ nhớ; quyền (401/403/404/409/400) giống hợp đồng đề xuất;
hồ sơ `e2e` không được đổi khi thêm màn mới (spec cũ đóng băng số liệu), dữ liệu đẹp/nhất quán chỉ thêm vào hồ sơ `demo`.

Fixture và cấu hình mock nằm ngoài `src/` và không được import từ code app (trừ việc `navigation.spec.ts` cố ý import cấu hình menu và route-registry của app để kiểm tra
cấu hình và hành vi thực tế khớp nhau).

## Kiểm kê kịch bản của các milestone trước (trước đây nằm ở scratchpad ngoài repo)

| Kịch bản cũ | Nội dung | Nay |
|---|---|---|
| `m2-auth.mjs` (34 kiểm tra) | luồng Auth cookie/hash, refresh, lỗi, đăng xuất, ma trận role | `e2e/specs/auth.spec.ts` |
| `m2-runtime-guard.mjs` | cấu hình mock bị chặn khi host không phải loopback | **không còn ở e2e** (bản build e2e không chứa cấu hình mock nên lớp chặn này không có gì để kích hoạt); `tests/endpoint-safety.test.ts` bao phủ `isMockConfigOnRealHost` |
| `m3a-browser.mjs` (51 + 4) | khung quản lý, role, chuông, toast, responsive, logout, chưa cấu hình | `management-shell.spec.ts`, `notifications.spec.ts`, `unconfigured.spec.ts` |
| `interact.mjs` (33) | phần song song với HSK cũ: lọc/phân trang; guard; trạng thái dữ liệu | `class-management.spec.ts`: giá trị kỳ vọng của lọc/phân trang **đóng băng** từ lần so khớp M1.5; kiểm tra guard/dữ liệu giữ nguyên. Phần chạy HSK cũ song song **không** chuyển vào repo |
| `q1-same-origin.mjs` | `next dev` + proxy cùng origin | `dev-proxy.spec.ts` + `playwright.dev.config.ts` |
| `q1-not-configured.mjs` | quiz chưa cấu hình ⇒ WAITING FOR BACKEND | **không chuyển**: sẽ cần build thứ ba; vitest (`use-admin-classes.test.tsx`, `api-client`) bao phủ `ApiNotConfiguredError` |
| `m3a-compare.mjs`, `compare.mjs`, `welcome-compare.mjs`, `pix/diff/...` | so ảnh **với HSK cũ** (Vite) | **không chuyển** (cần chạy HSK cũ). Thay bằng ảnh chuẩn trong repo. Kết quả đối chiếu ghi ở `docs/M3A-LAYOUT.md`, `docs/M3B1-NAVIGATION.md`, `docs/M3B2-WELCOME.md` |
| (mới, M3B.1) | điều hướng, 404, quyền route dùng chung, active/submenu, tải lại, vòng lặp redirect | `navigation.spec.ts` |
| (mới, M3B.2) | màn Tổng quan giảng viên; cách ly mạng; guard production | `instructor-welcome.spec.ts`, fixture cách ly trong `support/test.ts`, `tests/production-guard.test.ts` |
| (mới, M4B) | màn Danh sách bài học: luồng list-class → list-lesson (đúng classId/courseId, không lẫn lớp, reload URL), query thiếu/sai KHÔNG gọi API, `?page=` trong URL (ghi bằng replace, reload, back về đúng trang), tìm kiếm, sắp theo buổi, định dạng tiêu đề, ba nút điều hướng sang placeholder, quyền, loading/rỗng/lỗi/403/sai định dạng, responsive | `instructor-lesson-list.spec.ts`, `visual.spec.ts`; vitest `lesson-list-model.test.ts`, `instructor-lesson-list.test.tsx`; so ảnh với HSK cũ bằng công cụ ngoài repo (`docs/M4B-LIST-LESSON.md`). Spec cũ dùng `/instructor/list-class/list-lesson` làm placeholder đã chuyển sang `/instructor/list-class/submissions` |
| (mới, M4A) | màn Quản lý lớp học của Giảng viên: quyền TEACHER/MENTOR, lọc khoá/lớp/thời gian (đồng hồ đóng băng), phân trang, liên kết mã lớp → placeholder list-lesson, loading/rỗng/lỗi/sai định dạng, responsive | `instructor-class-list.spec.ts`, `visual.spec.ts`; vitest `class-list-filters.test.ts`, `instructor-class-list.test.tsx`; so ảnh với HSK cũ bằng công cụ ngoài repo (`docs/M4A-LIST-CLASS.md`). Các spec cũ dùng `/instructor/list-class` làm trang placeholder đã chuyển sang `/instructor/list-class/list-lesson` (route NOT_MIGRATED của Giảng viên) |
| (mới, M3B.4) | màn Admin Quản lý thông báo: quyền ADMIN, form + validation, chọn người nhận (tìm/lọc/phân trang/chọn tất cả), xem trước, gửi GIẢ LẬP thành công/lỗi, chống gửi trùng, lịch sử (danh sách/chi tiết/phân trang/rỗng/lỗi), phân trang đúng trang, responsive, bản chưa cấu hình (không đường nào tới request gửi) | `admin-notifications.spec.ts`, `unconfigured.spec.ts`, `visual.spec.ts`; so ảnh với HSK cũ bằng công cụ ngoài repo (`docs/M3B4-ADMIN-NOTIFICATIONS.md`) |
| (mới, M3B.3) | màn Thông báo của tôi: quyền TEACHER/MENTOR, lọc trạng thái/ngày, phân trang, đọc/đánh dấu/điều hướng/quay lại, chuông → danh sách, loading/rỗng/lỗi/chưa cấu hình, responsive, không gọi API khi chưa đăng nhập | `notifications-page.spec.ts`, `unconfigured.spec.ts`, `visual.spec.ts`; so ảnh với HSK cũ bằng công cụ ngoài repo (`docs/M3B3-NOTIFICATIONS.md`) |
| (M5) | Sau M5 **mọi mục menu đều là trang thật**, nên các spec từng dùng `/instructor/list-class/submissions`, `/hanzi/manage`, `/admin/dashboard` làm trang "đang chuyển đổi" đổi sang route HSK cũ hợp lệ chưa chuyển không có mục menu: `/admin/profile` (Admin), `/learning-path/manage` (Giảng viên), `/kanji-origin/manage` (dùng chung); khung Giảng viên đo trên `/instructor/list-class`. `navigation.spec.ts` có `waitForServed()` quyết định theo registry (MIGRATED ⇒ trang thật, không placeholder/404; NOT_MIGRATED ⇒ placeholder) nên không phải sửa spec mỗi khi chuyển thêm màn. Màn M5 có vitest riêng (hợp đồng client, hook, view); trình duyệt chỉ kiểm tra điều hướng tới trang thật (dấu hiệu `data-testid` của màn) — chưa có spec Playwright riêng cho từng màn M5 | `navigation.spec.ts`, `management-shell.spec.ts`, `notifications.spec.ts`, `unconfigured.spec.ts`, `visual.spec.ts` (ảnh placeholder đổi có chủ đích), `class-management.spec.ts`, `instructor-welcome.spec.ts`, `instructor-lesson-list.spec.ts`, `auth.spec.ts` |

## Hồi quy giao diện (visual)

`e2e/specs/visual.spec.ts` so ảnh phần tử/trang với `e2e/__screenshots__/<platform>/*.png` (Playwright `toHaveScreenshot`, ngưỡng 0.1, ≤ 50 pixel lệch): sidebar Admin/Giảng viên
(mặc định, có huy hiệu, `99+`, dropdown chuông mở, toast, thu gọn) × desktop/tablet/mobile, màn lớp học toàn trang × 3 khung, trang placeholder × 2 vai trò × 3 khung, màn Tổng quan giảng viên (có dữ liệu × 3 khung, rỗng, lỗi), màn Thông báo của tôi (3 khung, rỗng, lỗi, có phân trang). Mock server hỗ trợ `notifTotal`, `notifStepMin`, `notifTarget` để dựng danh sách/lọc/phân trang.
Đồng hồ trình duyệt và thời điểm của mock được đóng băng (2026-10-23 09:00 +07) để "x phút trước" và trạng thái lớp không trôi theo ngày.

**Ảnh chuẩn là ảnh của chính app ở trạng thái đã duyệt, không phải ảnh HSK cũ.** Việc khớp HSK cũ từng pixel (sidebar, chuông, dropdown, toast, `/admin/class-management`, màn Tổng quan) đã được kiểm tra
bằng công cụ ngoài repo (chạy HSK cũ cạnh app mới); trang placeholder là màn mới nên không có bản cũ để so.

Điều kiện tái lập: ảnh chuẩn tạo trên **Windows + Chromium của Playwright + Internet (Google Fonts Inter/Nunito)**. Trên nền tảng khác (hoặc khi không tải được Google Fonts) các test visual
**tự bỏ qua** với thông báo rõ ràng thay vì báo lỗi giả; chưa xác minh hành vi trên Linux/macOS. Muốn có ảnh chuẩn riêng cho máy bạn: `npm run test:e2e:update-snapshots`.
Khi thay đổi giao diện có chủ đích, cập nhật ảnh chuẩn và nêu rõ trong commit/báo cáo.

## Chuyện cần biết

- `next dev` đôi khi cho hai trạng thái vẽ khác nhau ở viền trong suốt của toast trên mobile; vì thế so ảnh luôn chạy trên bản **production** (`next start`).
- Trong một lần chạy visual hiếm hoi, một ca (sidebar Teacher mobile) quá thời gian 90 giây rồi các ca sau bị bỏ qua; chạy lại ba lần liên tiếp đều ổn định. Chưa tìm ra nguyên nhân (nghi do máy bận); nếu gặp lại hãy chạy lại và báo.
- Mock server có trạng thái (phiên, bộ đếm): các spec chạy tuần tự (`workers: 1`) và mỗi test tự `reset` mock.
- Cập nhật `docs/ROUTE-STATUS.md`: `UPDATE_ROUTE_DOCS=1 npm test` (file là hình chiếu của `route-registry`, test fail nếu lệch).
- Khảo sát lại route HSK cũ: `node scripts/survey-old-routes.mjs --old <đường dẫn LMS_Frontend>` (chỉ đọc; không chạy trong test).

## Timeout, chẩn đoán và dọn dẹp (M3B.4) — "Điều tra lần chạy 2,6 giờ"

Một lần chạy đầy đủ hiển thị 2,6 giờ trong khi tổng thời gian các test chỉ ~20 phút. **Nguyên nhân có bằng chứng: máy ngủ 2h15m** (nhật ký Windows `Power-Troubleshooter`: ngủ 05:04:32Z → thức 07:20:01Z, đúng 2 phút sau khi lần chạy bắt đầu); ca lỗi duy nhất là test thứ 30 hết timeout 90 giây vì timer chạy tiếp khi máy thức dậy, chạy lại riêng đạt. Chi tiết và bảng bằng chứng: `docs/M3B4-ADMIN-NOTIFICATIONS.md` mục 9.

Cơ chế hiện có:

| Lớp | Giá trị | Ghi chú |
|---|---|---|
| Timeout từng test | 90 giây (`expect` 15 giây) | Không tăng để che treo; `retries: 0` (không thử lại ngầm) |
| `globalTimeout` cả lần chạy | 60 phút | Đo thực tế ~20 phút (274 test); vượt giới hạn thì Playwright dừng và báo |
| Khởi động server (`webServer`) | 120 giây / 30 giây (gateway, mock), dev 180 giây | Playwright tự tắt server khi kết thúc; kiểm tra cổng 3100/3101/3102/3190/3200/3201 trống nếu nghi ngờ tiến trình mồ côi |
| `fetch` tới mock trong helper | 10 giây | Mock không phản hồi thì lỗi rõ ràng |
| Reporter chẩn đoán `e2e/support/run-diagnostics-reporter.ts` | nhịp 30 giây | In "NHẢY ĐỒNG HỒ" khi tiến trình bị đóng băng > 90 giây (máy ngủ/treo), "NGHI NGỜ ĐÓNG BĂNG" khi test kéo dài > 1,5× timeout, giờ bắt đầu thật của test lỗi, và tổng kết thời gian đóng băng |

Lưu ý ca chập chờn do tải máy (M4B): lỗi `net::ERR_NO_BUFFER_SPACE` (Windows hết bộ đệm socket sau nhiều kết nối) và các test phụ thuộc cửa sổ thời gian cố định (spinner của mock "slow", toast sonner vài giây). Quy ước: test về trạng thái đang tải phải giữ lời gọi bằng `page.route` có cổng (không dùng độ trễ cố định), kiểm tra toast ngay khi sự kiện xảy ra, và **không thêm retry** — chạy lại riêng ca lỗi để phân biệt lỗi môi trường với lỗi thật.

Nếu thấy dòng `[diag] NHẢY ĐỒNG HỒ`: kết quả của các test chạy lúc đó không đáng tin về timeout — chạy lại riêng các test lỗi. Khi chạy lâu ngoài giờ, đặt chế độ không ngủ của máy hoặc dùng `CI`.
