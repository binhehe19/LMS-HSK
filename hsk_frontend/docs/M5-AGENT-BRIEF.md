# M5 — Hướng dẫn cho gói việc chuyển màn (đọc trước khi code)

Áp dụng cho mọi gói việc M5 (xem `docs/M5-FULL-DEMO-PLAN.md`). Quy ước gốc: `docs/code-standards.md` (bắt buộc đọc). Tài liệu này chỉ nêu phần **bổ sung cho M5** và ranh giới để nhiều gói làm song song không đụng nhau.

## 1. Mục tiêu và nguyên tắc

- Đây là **bản chạy thật** (production build), chủ dự án xem trên local trước rồi mới đưa lên production. Không có mock trong `src/`. Dữ liệu giả chỉ nằm ở `scripts/mock/` (máy chủ giả lập) và `tests/`, `e2e/`.
- Nguồn tham chiếu nghiệp vụ/giao diện: **HSK cũ** `D:\PRJ-2026\LMS\LMS_Frontend\src` (chỉ đọc). Giữ nguyên nghiệp vụ, trường dữ liệu, bộ lọc, hành động, thuật ngữ tiếng Việt. Giữ DOM/class CSS khi hợp lý để CSS cũ áp dụng (SCSS toàn cục đã có trong `src/styles`).
- Khác HSK cũ có chủ đích được phép (ghi rõ trong comment đầu file view và trong báo cáo của bạn): modal react-bootstrap → antd `Modal`/`confirmAction`; `window.confirm` → `confirmAction`; mọi lỗi API hiện trạng thái thay vì che bằng danh sách rỗng; không có "thành công giả".
- Không mở rộng quyền: không sửa `route-registry.ts`, `roles.ts`, `UI_ROLE_DECISIONS`, menu. Route UNKNOWN giữ 404.
- Backend chung `LMS_IELTS/backend` (chỉ đọc): nếu có endpoint thật phù hợp → dùng `lmsClient` (`src/lib/api/lms-client.ts`, DTO ở `src/types/lms.ts`); nếu không → viết client theo hợp đồng đề xuất (kế thừa đường dẫn HSK cũ) qua client của service tương ứng, ghi header comment `WAITING FOR BACKEND` và tạo `docs/api-requirements/<màn>.md`.

## 2. Những file KHÔNG được sửa (điều phối sẽ sửa khi tích hợp)

`src/lib/management/route-registry.ts` (MIGRATED_ROUTES), `src/styles/page-styles.ts`, `src/components/management/admin-nav.ts`, `instructor-nav.ts`, `tests/fixtures/*nav.golden.json`, `tests/route-registry.test.ts`, `scripts/mock/server.mjs`, `scripts/mock/core.mjs`, `scripts/mock/data/*.mjs`, `docs/ROUTE-STATUS.md`, `docs/FEATURE-STATUS.md`, `package.json`, `next.config.ts`, `.env.example`, `e2e/variants.json`, bất kỳ file của gói việc khác.
Cuối báo cáo, liệt kê chính xác: (a) các route cần thêm vào `MIGRATED_ROUTES`, (b) các file CSS cần import trong `page-styles.ts` (theo thứ tự), (c) module handler mock cần nối vào `HANDLERS`, (d) biến môi trường mới (nếu có — hạn chế).

## 3. Cấu trúc một màn (đúng checklist mục 2 của code-standards)

```
src/app/(management)/<đúng URL HSK cũ>/page.tsx            page mỏng: export default function → <XPageContent/>
src/components/management/<tên-màn>/<tên-màn>-page-content.tsx   container: đọc query (useSearchParams), gọi hook, điều hướng
src/components/management/<tên-màn>/<tên-màn>-view.tsx           giao diện thuần (props), không gọi API; bọc trong <ManagementPageFrame>
src/components/management/<tên-màn>/use-<tên>.ts               hook tải dữ liệu: dùng useKeyedFetch (notifications/use-keyed-fetch.ts) hoặc useState+effect có cờ cancelled
src/components/management/<tên-màn>/<tên-màn>.css|.scss        CSS riêng (sao chép từ HSK cũ), KHÔNG import từ component — báo điều phối thêm vào page-styles.ts
src/lib/api/<miền>-client.ts                                  hàm gọi API (createApiClient của service), thao tác GHI đi qua assertWriteEnabled(feature, demoActive)
src/types/<miền>.ts                                            DTO
src/lib/<miền>/*.ts                                            hàm thuần (lọc, định dạng, tính toán) — test được không cần React
tests/<tên-màn>*.test.ts(x)                                    vitest: hàm thuần + hook (vi.mock client) + view (fixture) + client (vi.stubGlobal fetch)
docs/api-requirements/<tên-màn>.md                             hợp đồng gửi backend (nếu endpoint chưa có)
```

- Tham số URL: giữ **nguyên hợp đồng query của HSK cũ** (`?classId=&courseId=&scheduleId=&title=&userId=…`). Kiểm tra an toàn trước khi gọi API (xem `src/lib/lesson-list/lesson-list-params.ts`: `checkClassId`, `parsePage`).
- Trạng thái màn: `loading` / `ok` / `empty` / `error` (có Thử lại) / `waiting` (WAITING FOR BACKEND). Dùng `FetchStateNotice` (`src/components/shared/fetch-state-notice.tsx`) cho waiting/error, `WriteLockedNotice` cho nút ghi bị khoá.
- Thao tác GHI: trong component lấy `const { enabled, demo } = useWriteGate("<feature>")` (`src/hooks/use-write-gate.ts`); nút ghi `disabled={!enabled}` + `WriteLockedNotice` khi `!enabled`; hàm client nhận `demoActive` và gọi `assertWriteEnabled` (xem `src/lib/api/quiz-grading-client.ts`). Feature hợp lệ: `src/lib/api/write-gate.ts`.
- Component dùng chung sẵn có: `ManagementPageFrame`, `PageHeader` (`components/shared/page-header.tsx`), `DataTable` (antd, `components/shared/data-table.tsx`), `confirmAction`, `ApexChart` (`components/shared/apex-chart.tsx`, nạp động), `AssetImage`.
- **Quyền sửa nội dung theo ticket** (màn nội dung HSK: flashcard/quiz/hanzi/grammar/dictionary/pronunciation/storage/online-course/syllabus): `useContentAccess(module)` (`src/hooks/use-content-access.ts`) trả `{canManage, canPublish, status}` theo đúng quy tắc HSK cũ (`src/lib/tickets/ticket-access.ts`): Admin luôn có; giảng viên cần ticket OPEN/DONE đúng module; `status === "unavailable"` hoặc `!canManage` => Alert "Chế độ Xem duy nhất" (antd Alert) và ẩn/khoá nút Thêm/Sửa/Xoá; Publish/Unpublish chỉ khi `canPublish`. Kết hợp với write gate: nút ghi chỉ hoạt động khi `canManage && useWriteGate("content").enabled`.
- **Tải tệp lên** (ảnh/âm thanh/tài liệu): `uploadFile(file, onProgress)` và `fileUrl(fileId)` trong `src/lib/api/storage-client.ts` (backend chung repo-storage, presign → PUT → confirm); chưa cấu hình => ApiNotConfiguredError, giao diện hiện "Kho lưu trữ chưa được cấu hình". Mock: handler của gói nào cần upload thì mô phỏng `/api/storage/file/presign` + `PUT` + `/confirm` + `GET /file/{id}` (chỉ một gói làm — Kho lưu trữ/Tài liệu — gói khác dùng chung; báo điều phối). antd 5.23 + Bootstrap 5.3 + iconsax (`isax isax-*`). Không thêm thư viện mới (không Tailwind/shadcn/react-bootstrap/xlsx/MUI). Excel import/export: làm nút + ghi "chưa chuyển" trong báo cáo, hoặc CSV đơn giản phía client.
- Toast: `toast` của `sonner`. Ngày: `dayjs` (đã có). Không `moment`.
- Lint: `npm run lint` phải sạch (eslint-config-next 16: không setState đồng bộ trong effect — dùng `useKeyedFetch`/`useSyncExternalStore`/suy ra từ state). Không `any`. Named export (trừ page.tsx).

## 4. Máy chủ giả lập (bắt buộc để xem trước và kiểm thử trình duyệt)

- Mỗi gói thêm **một file** `scripts/mock/handlers/<miền>.mjs` xuất `handle(ctx)` (trả `true` nếu đã xử lý), theo mẫu `scripts/mock/handlers/lms.mjs` và `quiz-grading.mjs`. `ctx = { req, res, url, method, session(), require(roles) }`; helper từ `../core.mjs`: `send, ok, fail, readBody, paginate, count, nowMs, state, sendError, registerResettable`.
- Dữ liệu riêng của miền: giữ trong module handler (biến module), seed theo `state.data.profile` (`"e2e"` tối giản/ổn định cho test, `"demo"` đẹp/nhất quán); với profile demo có thể đọc `state.data.raw` (classes, teachers, students, courses, sessions, grading…) để nhất quán với lớp/học viên hiện có. Đăng ký `registerResettable(() => seed())` để `/mock-reset` đưa về ban đầu. Không dữ liệu cá nhân thật; email `@demo.invalid`/`@mock.invalid`.
- Quyền trong mock phải giống hợp đồng: 401 khi chưa đăng nhập, 403 sai role/sai lớp, 404 không có, 409 xung đột trạng thái, 400 body sai. Thao tác ghi phải THAY ĐỔI dữ liệu trong bộ nhớ (lần đọc sau thấy khác), không chỉ trả thành công.
- Tôn trọng `state.controls.api` (`ok|error|slow`) cho đọc chính (xem `respondWithApiState`/`withApiState`).
- Chạy thử: `MOCK_PROFILE=demo MOCK_PORT=3197 node scripts/mock-server.mjs` rồi curl (đăng nhập: `curl -c ck.txt "http://127.0.0.1:3197/mock-login?role=teacher&redirect=http://localhost:3100/x"`, rồi `curl -b ck.txt …`). Báo điều phối tên module để nối vào `HANDLERS`.

## 5. Kiểm thử và bàn giao của mỗi gói

1. `npm run typecheck` và `npm run lint` sạch **đối với file của bạn** (lỗi ở file gói khác ghi nhận, không sửa).
2. `npx vitest run tests/<file của bạn>` xanh. Không chạy `npm test` toàn bộ (lâu, có build thật).
3. Smoke mock bằng curl như mục 4.
4. KHÔNG chạy Playwright; KHÔNG commit; KHÔNG sửa file ngoài phạm vi; KHÔNG đổi file đã liệt kê ở mục 2.
5. Báo cáo cuối (ngắn, có cấu trúc): route đã chuyển + trạng thái UI (UI_COMPLETE/UI_PARTIAL + liệt kê phần chưa chuyển), API (MISSING/PARTIAL/AVAILABLE + endpoint đề xuất), file đã tạo, mục cần điều phối tích hợp (mục 2), khác biệt có chủ đích so với HSK cũ, vấn đề còn mở.
