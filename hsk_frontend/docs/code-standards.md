# Code standards — LMS_HSK/frontend

Quy ước thực tế của frontend HSK. Cấu trúc và cách làm bám theo `LMS_IELTS/frontend` (đã đối chiếu với code, không chỉ tài liệu của họ);
khác IELTS ở giao diện (SCSS/Bootstrap/antd của HSK) và ở các điểm ghi trong mục 9. Mọi đường dẫn dưới đây đều tồn tại.

## 1. Cấu trúc thư mục

```
src/
  app/            Chỉ routing, layout và quy ước Next.js. Page mỏng, không chứa logic/JSX nghiệp vụ.
  components/
    auth/         AuthInitializer, RequireAuth, ReduxProvider, auth-panels (trạng thái đang kiểm tra/lỗi/không đủ quyền)
    management/   Shell, sidebar, menu và các màn hình quản lý Admin/Teacher. Mỗi màn hình một thư mục con
                  (class-management/ ...); thành phần dùng lại giữa các màn hình đặt ngay trong management/
    shared/       UI dùng lại thật sự (asset-image, back-to-top). Chỉ thêm khi đã lặp ở ≥ 2 nơi
  lib/
    api/          Mỗi backend service một client + một file hàm theo miền: quiz-client.ts + quiz-grading-client.ts
                  (+ api-client.ts dùng chung, auth-client.ts cho Authentication)
    auth/         auth-redirect (chuyển sang Authentication_Frontend), roles, token-store (token chỉ trong bộ nhớ), redirect-guard (chống lặp redirect)
    <miền>/       Hàm thuần của miền (vd lib/class-management/class-display.ts). Không import React/Next, không gọi API
  redux/          store.ts (makeStore), hooks.ts, slices/ — CHỈ cho auth
  types/          DTO theo miền (vd grading.ts). Kiểu response nằm ở đây, không rải trong component
  styles/         SCSS/CSS của HSK cũ (scss/, css/, fonts/), index.scss, page-styles.ts
tests/            Vitest + Testing Library, fixtures/ cho dữ liệu test
scripts/          Công cụ chạy tay (mock-server.mjs). Không import từ src/
docs/             Tài liệu; api-requirements/ là hợp đồng gửi người phụ trách backend
```

Không có `features/`, `core/`, `routes/`, `store/`, `hooks/`. Hook chỉ tách ra `src/hooks/` khi có hook dùng chung giữa ≥ 2 miền;
hook của một màn hình đặt cạnh component (`use-admin-classes.ts`).

## 2. Thêm một màn hình quản lý mới (checklist)

1. **Route**: `src/app/(management)/<đúng URL của HSK cũ>/page.tsx` (nhóm route không xuất hiện trong URL). Page chỉ render component nội dung.
   Quyền theo TỪNG route (M3B.1): layout nhóm route `app/(management)/layout.tsx` → `ManagementRouteGate` (`AuthInitializer` + `RequireAuth allowedRoles` + `ManagementShell` theo role) đọc `lib/management/route-registry.ts`;
   không còn layout theo tiền tố `/admin`, `/instructor`. Mọi trang quản lý nằm trong nhóm này; thêm màn = `page.tsx` ở đúng URL cũ + thêm vào `MIGRATED_ROUTES` (test đối chiếu với `src/app/**/page.tsx`)..
   URL dùng chung nhiều vai trò (vd `/flashcard/manage`) không cần layout riêng: role của từng route nằm trong registry (lấy từ `PrivateRoute` của `router.link.tsx` cũ).
2. **Nội dung**: `components/management/<tên>/<tên>-page-content.tsx` (container: gọi hook, điều hướng) và `<tên>-view.tsx`
   (giao diện thuần nhận state qua props, test được bằng fixture). Không đưa lời gọi API vào view.
3. **Dữ liệu**: hook `use-<tên>.ts` cạnh component; hàm gọi API ở `lib/api/<miền>-client.ts` dùng `<service>Client` (xem mục 4);
   DTO ở `types/<miền>.ts`; logic thuần ở `lib/<miền>/`.
4. **CSS riêng của trang**: đặt cạnh component (`<tên>.css`) và thêm import vào `styles/page-styles.ts` theo thứ tự import của
   `LMS_Frontend/src/routes/router.link.tsx` (xem mục 6). Không import CSS này từ component.
5. **Menu**: sửa dữ liệu trong `components/management/admin-nav.ts` (hoặc file nav của vai trò tương ứng) và cập nhật golden test.
6. **Trạng thái**: màn hình có đủ loading / empty / error / `not-integrated` (xem mục 5). Không dữ liệu giả làm fallback.
7. **Test**: view (fixture), hook (`vi.mock` client), client (URL, credentials, lỗi). Chạy `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
8. **Tài liệu**: nếu API chưa có, thêm `docs/api-requirements/<tên>.md` và cập nhật `docs/FEATURE-STATUS.md`.

## 3. Quy ước đặt tên

- File kebab-case; component và type PascalCase, tên khớp ý nghĩa file (`management-sidebar.tsx` → `ManagementSidebar`).
- **Named export** cho mọi component/hàm; chỉ `page.tsx`, `layout.tsx` và reducer của slice dùng `export default`.
- Hậu tố: `*-page-content` (container), `*-view` (giao diện thuần), `use-*` (hook), `*-client` (gọi API), `*-nav` (cấu hình menu).
- Comment tiếng Việt, chỉ giải thích **vì sao** (ràng buộc ẩn, khác biệt có chủ đích với HSK cũ/IELTS). Không mô tả code đang làm gì.
- Không để export không ai dùng. Không tạo abstraction "phòng khi cần" (YAGNI trước DRY).

## 4. API

- Mọi lời gọi đi qua `createApiClient(getBaseUrl)` (`lib/api/api-client.ts`); không tự `fetch`/`axios` rải rác.
- **Mỗi backend service một client** (`lib/api/quiz-client.ts`) và một biến base path riêng `NEXT_PUBLIC_<SVC>_API_BASE_PATH`
  (đường dẫn cùng origin như `/api/quiz` hoặc URL tuyệt đối). Thêm service = thêm file client + biến + một dòng trong `API_SERVICES` ở `next.config.ts`.
- Dev: `<SVC>_API_PROXY_TARGET` (không có `NEXT_PUBLIC_`) bật `rewrites` cùng origin trong `next dev`, giống IELTS. Production: gateway/Traefik định tuyến.
- Biến base path **trống = service chưa cấu hình** → `ApiNotConfiguredError` → màn hình hiện `WAITING FOR BACKEND`
  (khác với `ApiError` = đã gọi nhưng thất bại). Không có giá trị mặc định trỏ hệ thống thật.
- `createApiClient.get/post/put/delete` là `async`: thiếu cấu hình hay lỗi phải là promise bị reject, **không** ném đồng bộ ra khỏi effect.
- Phiên dựa vào cookie (`credentials: "include"`); nếu tab giữ token trong bộ nhớ thì gắn thêm `Authorization: Bearer`. 401 → refresh MỘT lần dùng chung (`lib/api/auth-session.ts`) rồi thử lại ĐÚNG MỘT lần; refresh bị 400/401/403 = hết phiên (thông báo cho `AuthInitializer`), mạng/5xx = không phải hết phiên (lỗi 503, không đổi trạng thái). Không ghi token/header/body vào log.
- Hàm client trả đúng kiểu DTO (`types/`); việc kiểm tra hình dạng dữ liệu bất thường (vd không phải mảng) làm ở hook, hiển thị thành trạng thái lỗi.
- Backend chưa có endpoint: vẫn hoàn thiện UI, ghi header comment `WAITING FOR BACKEND` ở client và hợp đồng ở `docs/api-requirements/`.

## 5. Trạng thái màn hình

`loading` (giữ giao diện cũ, ví dụ Spin + số 0), `ok`, `empty` (thông báo cũ của trang), `error` (thông báo + nút Thử lại),
`not-integrated` (WAITING FOR BACKEND, không nút Thử lại). Fixture/mock **chỉ** trong `tests/` và `scripts/`; không bao giờ là fallback tự động.

## 6. Styles

- Giữ SCSS/Bootstrap/antd/icon của HSK cũ; không dùng Tailwind/shadcn.
- Thứ tự nạp CSS ở `app/layout.tsx` phải giữ: `iconsax → page-styles → bootstrap → index.scss → tabler → fontawesome`. CSS của từng trang
  nạp **trước** Bootstrap như bản cũ, nếu đổi thứ tự thì hiển thị đổi (liên kết mã lớp, nút Xuất Excel). Mọi thay đổi style phải kiểm tra bằng so ảnh với HSK cũ.
- Font Inter/Nunito nạp bằng `<link>` trong layout (bundler của Next làm rơi `@import url()` thứ nhất trong SCSS).
- Sao chép SCSS từ HSK cũ nguyên văn; chỉ sửa khi bắt buộc để build và ghi chú `[M1]` tại chỗ sửa (xem `docs/FEATURE-STATUS.md`).
- Chỉ sao chép asset thật sự được màn hình dùng (không sao chép cả thư mục `public/assets`).

## 7. Auth và phân quyền

- Dùng Authentication chung (xem `docs/AUTH-INTEGRATION.md`). Không tạo trang đăng nhập/quên mật khẩu.
- `ReduxProvider` ở root layout; `AuthInitializer` + `RequireAuth` ở layout của nhóm route cần đăng nhập (không ở root để route công khai/lỗi không bị chặn).
- **Không có đường tắt bỏ qua kiểm tra ở môi trường nào** (IELTS bỏ qua khi `NODE_ENV=development` — không sao chép).
- Role so khớp nguyên văn (`lib/auth/roles.ts`); không ánh xạ/gộp role (Auth chung có `ROLE_MANAGER` và `ROLE_TEACHER_MANAGER` là hai role riêng). `/admin/*` = `ROLE_ADMIN`; `/instructor/*` = `ROLE_TEACHER`|`ROLE_MENTOR` theo bằng chứng `router.link.tsx` cũ.
- Token chỉ trong bộ nhớ (`token-store.ts`), không bao giờ vào web storage/log. Callback hash chỉ nhận token đúng hình dạng JWT và luôn được dọn khỏi URL.
- Chống lặp: mỗi tab tự chuyển sang Auth tối đa một lần/2 phút (`redirect-guard.ts`); lần sau hiện `redirect-loop` để người dùng bấm.
- Mock không được lọt production: guard ở `next.config.ts` + guard lúc chạy ở `AuthInitializer` (host không phải loopback) + mock server tách riêng; xem `docs/AUTH-INTEGRATION.md` mục 6.
- Guard ở frontend chỉ là rào giao diện; backend phải kiểm tra quyền ở mọi API.
- Trạng thái `status` của slice auth: `loading | authenticated | unauthenticated | signed-out | error`. Lỗi mạng/5xx không được coi là đã đăng nhập và không đá người dùng ra trang đăng nhập.

## 8. Test

- Vitest + Testing Library + jsdom (`npm test`), thư mục `tests/`, tên theo thành phần (`use-admin-classes.test.tsx`).
- Phiên giả lập cách ly bằng `vi.mock("@/lib/api/auth-client")`; client API test bằng `vi.stubGlobal("fetch")`. Test không gọi mạng thật.
- Auth: `vi.mock("@/lib/api/auth-client")` cho guard/layout; `vi.stubGlobal("fetch")` cho refresh/api-client; ma trận role chạy trên layout THẬT (`app/(management)/layout.tsx`, `tests/management-route-gate.test.tsx`). Kiểm thử trình duyệt (Playwright, `e2e/`) và ảnh chuẩn: `docs/TESTING.md`.
- Menu có **golden test** (`tests/fixtures/admin-nav.golden.json`, `instructor-nav.golden.json`, sinh từ code HSK cũ): đổi menu phải đổi golden có chủ đích.
- Mục menu trỏ tới route chưa có trang phải vẫn hiện (như HSK cũ) và được đánh dấu NOT MIGRATED qua `lib/management/route-registry.ts`: NOT_MIGRATED → trang "đang chuyển đổi" ở đúng URL; UNKNOWN/OUT_OF_SCOPE → 404 (UNKNOWN khi HSK cũ không có PrivateRoute hoặc chỉ dành cho role chưa xác minh); không ẩn mục, không dẫn tới màn hình không tương đương. Không suy ra quyền từ việc thiếu PrivateRoute.
- **Bundler = webpack** (`next dev --webpack`, `next build --webpack`): Turbopack (lightningcss) làm rơi rule của SCSS cũ (`.shadow-sm !important`) nên không dùng cho app này cho tới khi có cách bảo đảm CSS giữ nguyên; `e2e/specs/css-fidelity.spec.ts` chặn tái phát (xem `docs/M3B2-WELCOME.md` mục 8).
- Thư viện ảnh hưởng hiển thị (`bootstrap`, `@tabler/icons-webfont`, `@ant-design/icons`, `antd`) **ghim đúng phiên bản của HSK cũ**; nâng cấp phải so ảnh lại.
- Dịch vụ backend mới = thêm `lib/api/<svc>-client.ts` + biến `NEXT_PUBLIC_<SVC>_API_BASE_PATH` + đăng ký ở `endpoint-safety.ts` (`mockLikeConfigNames`) và `next.config.ts` (`API_SERVICES`, guard proxy).
- Kiểm thử trình duyệt/so ảnh dùng công cụ ngoài repo trên máy chủ giả lập (`npm run mock:server`); xem README.

## 9. Khác biệt có chủ đích so với IELTS

| Điểm | IELTS | HSK | Lý do |
|---|---|---|---|
| UI | Tailwind + shadcn | SCSS + Bootstrap + antd | Giữ nguyên giao diện HSK |
| Test | node:test cho logic/client | Vitest + Testing Library, có test guard/component | HSK cần test guard auth và giao diện |
| Auth guard | Bỏ qua kiểm tra ở dev | Không bỏ qua | An toàn; test được |
| Vị trí guard | `RequireAuth` ở root | Ở layout nhóm route | Route công khai/lỗi không bị chặn |
| Slice auth | `{user,isAuthenticated,loading}` | `{status,user,errorMessage}` (có `redirect-loop`, `error`, `signed-out`) | Phân biệt lỗi mạng/lặp redirect với chưa đăng nhập |
| Token | localStorage + Bearer | Chỉ trong bộ nhớ (+ cookie HttpOnly do Auth set) | Không lưu token vào web storage; production là cookie-only |
| Refresh | trong `auth-client`, api-client import ngược (vòng import) | `auth-session.ts` tách riêng, single-flight, 1 lần thử lại | Không vòng import, không refresh song song, không lặp |
| Base path API | Một `/api/lms` | Mỗi service một biến | Backend HSK nhiều service, đường dẫn chưa chốt |
| Trạng thái chưa cấu hình | Không có | `ApiNotConfiguredError` → WAITING FOR BACKEND | Yêu cầu phân biệt với lỗi API |
| Sidebar trong trang | Shell/layout có sidebar | `ManagementPageFrame` đặt sidebar trong từng trang (khu vực lấy từ `ManagementShell`) | Giữ đúng DOM `.content > .container > .row` của HSK cũ (CSS `.content` đổi theo trang) |
| Ảnh | `next/image` | `AssetImage` (`<img>`) | Không đổi kích thước/hiển thị |
| CSS trang | Cạnh component hoặc Tailwind | Cạnh component nhưng nạp qua `styles/page-styles.ts` | Giữ thứ tự cascade của bản cũ |

## 10. Những điều IELTS làm nhưng HSK không nên sao chép

- Tài liệu hướng dẫn dùng `useList`/`DataTable`/`PageHeader`/`StatCard` nhưng code thực tế dùng `SmartDataTable`/`AdminPageHeader`/`MetricStatCard` (hai thế hệ song song).
- Component import ngược từ `app/` hoặc `lib/` import `components/`; component import trực tiếp `lib/auth/auth-storage`.
- Kiểu dùng chung (`PageResponse`) định nghĩa trong file client của miền khác.
