# Tích hợp Authentication chung — M2

Nguyên tắc: dùng Authentication chung (Authentication_Frontend + Authentication_Backend) như IELTS. Không tạo trang đăng nhập/đăng ký,
không sửa Auth, không đổi giao thức, không bật expose-tokens. Frontend HSK chỉ là *client*.

> **Trạng thái kiểm chứng: toàn bộ kiểm thử M2 chạy trên MÁY CHỦ GIẢ LẬP (mock) và unit test. CHƯA có kiểm chứng với Authentication thật** —
> chưa có môi trường dev/staging đã xác minh an toàn và tài khoản kiểm thử (xem mục 7). Không được hiểu rằng Auth thật đã hoạt động.

## 1. Hợp đồng Auth đã xác minh bằng cách đọc code (không gọi mạng)

| Điểm | Bằng chứng | Hệ quả cho frontend |
|---|---|---|
| Cookie `access_token`/`refresh_token`: HttpOnly, Path=/, Domain=`ROOT_DOMAIN`, SameSite/Secure theo env | `AuthCookieService.java`, `application-*.yml` (`app.security.cookies.*`) | Cookie chỉ đi kèm khi frontend ở host thuộc `ROOT_DOMAIN`; trên `localhost` thì không |
| Token trong body chỉ khi **không phải profile `prod`** (`!environment.acceptsProfiles("prod")`) | `AuthController.isExposeTokensEnabled()`, `AuthSessionResponse` (`@JsonInclude(NON_NULL)`) | Prod = cookie-only; dev/staging = có token ở body (và Auth_Frontend đưa nó vào hash) |
| Callback: Auth_Frontend chỉ gắn `#access_token&refresh_token` nếu body có token; redirect hợp lệ = localhost (mọi cổng) hoặc https dưới `BASE_DOMAIN` | `Authentication_Frontend/src/core/utils/post-login-redirect.ts` | Không được giả định hash luôn có; `redirect` = URL hiện tại của HSK |
| Auth_Frontend không có bước tự đưa người dùng đang có phiên quay về | `features/auth/login/login.tsx` (không có kiểm tra phiên khi mount) | Vòng lặp chỉ xảy ra sau một lần đăng nhập mà HSK vẫn không thiết lập được phiên → cần chống lặp |
| `GET /users/me` → `ProfileResponse` (`id, userCode, email, fullName, avatarUrl, roles: Set<String>, emailVerified…`; **không có `status`**) | `ProfileController`, `ProfileResponse.java` | Kiểu `AuthUser` khớp; role là chuỗi nguyên văn |
| `POST /refresh`: body `{refreshToken}` tùy chọn, nếu không có dùng cookie; thiếu cả hai → **400** (E243); sai/hết hạn → **401** (E248); thành công luôn rotate cookie | `AuthController.refresh`, `AuthCookieService.resolveRefreshToken`, `ErrorCode` | 400/401/403 = phiên đã hết; mạng/5xx = không rõ |
| `POST /logout`: body `{refreshToken}` tùy chọn hoặc cookie; luôn xóa cookie, idempotent | `AuthController.logout` | Gọi một lần, lỗi không chặn việc rời phiên |
| Bearer (header) được ưu tiên, rồi cookie `access_token` | `BearerTokenAuthenticationFilter` (cả backend HSK lẫn IELTS) | Khi chuyển sang cookie phải bỏ Bearer cũ, tránh gửi token đã cũ |
| CORS gateway Auth: dev/local cho `http://localhost:*`, `127.0.0.1:*`; **prod chỉ `https://<ROOT_DOMAIN>` và `https://*.<ROOT_DOMAIN>`** | `repo-api-gateway/.../application-{dev,local,prod}.yml` | Local chỉ chạy được với Auth profile non-prod; prod bắt buộc host con của `ROOT_DOMAIN` |
| Role thực tế của Auth chung: `ROLE_ADMIN, ROLE_USER, ROLE_TEACHER, ROLE_TEACHER_MANAGER, ROLE_COLLABORATOR, ROLE_MANAGER, ROLE_MENTOR, ROLE_MENTOR_LEAD, ROLE_CLASS_MANAGER…` | `RoleName.java` (Authentication_Backend) | `ROLE_MANAGER` và `ROLE_TEACHER_MANAGER` là **hai role riêng**: không ánh xạ |

Khác biệt các frontend: HSK cũ chỉ cookie (không đọc JWT, `/refresh` lúc load); IELTS lưu token ở localStorage và gắn Bearer, `RequireAuth` bỏ qua kiểm tra ở dev.
Cách tích hợp chọn cho HSK mới hỗ trợ cả hai chế độ của Auth mà không thay đổi giao thức.

## 2. Luồng đã triển khai

1. Vào route bảo vệ (`/admin/*`, `/instructor/*`): `AuthInitializer` (layout của nhóm route, không ở root) chạy:
   a. nếu cấu hình đang trỏ mock/local mà trang phục vụ từ host không phải loopback → từ chối, không gọi mạng (xem mục 6);
   b. nhận `#access_token&refresh_token` ở URL nếu có (chỉ khi đúng hình dạng JWT; luôn dọn hash), giữ **trong bộ nhớ**;
   c. `GET /users/me` (cookie + Bearer nếu có). 401 → `POST /refresh` **một lần dùng chung** → thử lại **đúng một lần**.
2. Kết quả:
   - 200 → `authenticated` (xóa marker chống lặp); `RequireAuth` kiểm role rồi mới render nội dung.
   - 401/403 sau refresh, hoặc refresh bị 400/401/403 → `unauthenticated` → `RequireAuth` chuyển sang `Authentication_Frontend /login?redirect=<URL hiện tại>` (về đúng route + query ban đầu).
   - Mất mạng / 5xx / refresh 5xx / chưa cấu hình → `error` (thông báo + Thử lại). **Không** coi là chưa đăng nhập, không chuyển Auth.
3. Chống vòng lặp: mỗi tab chỉ tự chuyển sang Auth một lần trong 2 phút (`sessionStorage`); quay về mà vẫn chưa có phiên → trạng thái `redirect-loop` (hướng dẫn + nút "Đăng nhập lại" do người dùng bấm).
4. Phiên hết giữa chừng: bất kỳ API nào gặp 401 mà refresh bị từ chối → thông báo `session expired` → `unauthenticated`. Refresh lỗi tạm thời → lỗi 503 cho lời gọi, không đổi trạng thái phiên.
5. Đăng xuất (sidebar): `POST /logout` (kèm refresh token nếu có trong bộ nhớ, không refresh khi 401) → quên token → `signed-out` → `Authentication_Frontend /login` **không kèm redirect** (như HSK cũ).
6. Reload/tab mới: chế độ cookie giữ phiên; chế độ hash (token chỉ ở bộ nhớ) mất token và đi vòng qua Auth một lần.

## 3. Chính sách token

- **Không** lưu token vào localStorage/sessionStorage/cookie phía JS; chỉ biến trong bộ nhớ (`lib/auth/token-store.ts`). Có test xác nhận không ghi storage và không ghi log.
- Lý do: token chỉ tồn tại ở chế độ hash (dev/staging chạy khác miền gốc); production là cookie HttpOnly nên frontend không giữ token nào. Đánh đổi chấp nhận được: ở chế độ hash tải lại trang phải qua Auth một lần.
- Refresh: single-flight (một request dùng chung cho mọi lời gọi cùng lúc), mỗi lời gọi chỉ thử lại một lần; 400/401/403 → xóa token; mạng/5xx/429 → giữ token.
- Nếu muốn giữ phiên qua reload ở chế độ hash thì phải lưu token (quyết định bảo mật cần chủ dự án + bên Auth duyệt); M2 **không** tự làm.

## 4. File M2 (đều trong `LMS_HSK/frontend`)

`lib/auth/{token-store,redirect-guard}.ts` (mới) · `lib/api/{auth-session,endpoint-safety}.ts` (mới) · `lib/api/{api-client,auth-client}.ts` (sửa) ·
`components/auth/{auth-initializer,require-auth}.tsx` (sửa) · `redux/slices/auth-slice.ts` (thêm `redirect-loop`) · `app/instructor/{layout,list-class/page}.tsx` (khung Teacher tối thiểu ở M2; từ M3B.1 thay bằng nhóm route `(management)` + guard theo route, xem `M3B1-NAVIGATION.md`) ·
`next.config.ts` (guard production) · `scripts/mock-server.mjs` (mô phỏng hợp đồng Auth) · tests mới/cập nhật.

Kế thừa IELTS: `AuthInitializer`/`RequireAuth(allowedRoles)`/`ReduxProvider` ở `components/auth/`, `lib/api/auth-client.ts` (`getCurrentUser`, `logoutRemote`), `lib/auth/auth-redirect.ts`, slice `redux/slices/auth-slice.ts`, tên biến môi trường.
Khác có chủ đích: token chỉ trong bộ nhớ; không có đường tắt ở dev; chống lặp redirect; phân biệt lỗi mạng với chưa đăng nhập; refresh không gây vòng lặp import (`auth-session.ts` tách riêng); guard ở layout nhóm route.

## 5. Role và guard

- `/admin/*`: chỉ `ROLE_ADMIN` (như `router.link.tsx` cũ). `/instructor/*` (khung tối thiểu cho `list-class`): `ROLE_TEACHER` hoặc `ROLE_MENTOR` (hai role riêng theo `router.link.tsx`). Admin **không** vào được `/instructor`, Teacher/Mentor **không** vào được `/admin`.
- Không ánh xạ: `ROLE_MANAGER`, `ROLE_TEACHER_MANAGER`, `ROLE_COLLABORATOR`, `ROLE_USER`, không role → bị chặn ở cả hai. Nội dung nhạy cảm chỉ render sau khi phiên và role đã xác minh.
- Guard chỉ là rào giao diện; backend phải kiểm tra quyền ở mỗi API.
- Route Teacher khác (tickets cho COLLABORATOR, dashboard…) sẽ khai báo khi được chuyển và có bằng chứng quyền.

## 6. Kiểm soát mock / production (3 lớp độc lập)

1. **Build/start production** (`next.config.ts`): từ chối nếu `NEXT_PUBLIC_AUTH_FRONTEND_URL`, `NEXT_PUBLIC_AUTH_API_BASE_URL`, `NEXT_PUBLIC_QUIZ_API_BASE_PATH` trỏ localhost/loopback/`.invalid`/`.test`/`.localhost`, hoặc có `QUIZ_API_PROXY_TARGET`.
   Ngoại lệ `HSK_ALLOW_MOCK_ENDPOINTS=1` chỉ cho kiểm thử cục bộ và **bị từ chối** khi có biến `CI` hoặc khi cờ nằm trong bất kỳ file `.env*` (chỉ được đặt trên dòng lệnh); bật cờ in cảnh báo lớn.
2. **Lúc chạy** (`AuthInitializer`): nếu trang được phục vụ từ host KHÔNG phải loopback mà cấu hình đã nhúng vẫn trỏ mock → báo lỗi, không gọi mạng. Lớp này không phụ thuộc cờ nào: dù một bản build mock bị triển khai nhầm, nó không chạy được trên host thật.
3. **Mock server** (`scripts/mock-server.mjs`): tách riêng, không được import từ `src/`, chỉ bind `127.0.0.1`, token giả không ký, có biểu ngữ MOCK. Fixture chỉ ở `tests/` và `scripts/`.
Thiếu cấu hình → màn hình hiện trạng thái rõ ràng (`Chưa cấu hình...` / WAITING FOR BACKEND), không có dữ liệu giả thay thế.

## 7. Kết quả kiểm thử

Mọi mục dưới đây là **MOCK/unit** trừ khi ghi khác.

| Nhóm | Kết quả |
|---|---|
| Unit/component (Vitest) | 158/158: token-store, auth-session (refresh/single-flight), api-client (Bearer, 1 lần retry, không lặp), redirect-guard + callback + hết phiên giữa chừng, ma trận role của hai layout thật, endpoint-safety, auth-client, sidebar/đăng xuất |
| Trình duyệt trên luồng thật với mock (`next dev`) | 34/34 |
| Cùng bộ trên **production build** | 34/34 |
| Guard production (6 ca: cấu hình mock, cờ + CI, cờ trong .env, cờ dòng lệnh, cấu hình thật, proxy dev) | đúng kỳ vọng |
| Guard lúc chạy trên host không phải loopback (trình duyệt) | bị chặn, không gọi mạng |
| Hồi quy M1/M1.5 (33 kịch bản, production build) | 33/33 |
| So ảnh `/admin/class-management` với baseline M1.5 | 0 pixel khác (24 ảnh), số đo giống hệt |
| **Auth thật (dev/staging)** | **KHÔNG kiểm chứng** — blocker bên dưới |

Bộ trình duyệt M2 bao gồm: chưa đăng nhập; callback cookie và hash; callback rác và token giả dạng JWT bị từ chối (không lặp); ma trận role (admin, teacher, mentor, teacher-manager, manager, collaborator, user, không role) trên `/admin` và `/instructor`;
refresh thành công (cookie và hash) và bị từ chối; refresh 500; `/users/me` 500 rồi phục hồi; mất mạng tới Auth; API nghiệp vụ 401 một lần và 401 + refresh bị từ chối; reload và tab mới; đăng xuất (cookie và hash); không có bypass ở `next dev`; không cảnh báo hydration.

## 8. Chưa kiểm chứng / cần bên Auth và Backend

Blocker để kiểm chứng Auth thật (chưa làm, không gọi mạng ra ngoài):
1. Cần **môi trường dev/staging Auth đã được xác nhận an toàn** (không dùng dữ liệu/tài khoản production), cùng **tài khoản kiểm thử** cho Admin, Teacher, Mentor và một user không quyền.
2. Để chạy từ `localhost`: Auth phải chạy profile **không phải `prod`** (để có token ở body/hash) và CORS dev cho `http://localhost:<port>` kèm credentials (đã có trong `application-dev/local.yml`).
3. Để chạy trên miền thật: frontend HSK phải ở host `https://*.<ROOT_DOMAIN>` (cookie + CORS prod); cần xác nhận domain cuối và `COOKIE_SAME_SITE`/`COOKIE_SECURE`.
4. Xác nhận role thực tế (Admin/Teacher/Mentor) trong `/users/me` của tài khoản kiểm thử và chính sách quyền Teacher (hiện chỉ có bằng chứng từ `router.link.tsx` cũ).
5. Phía backend nghiệp vụ: chấp nhận Bearer/cookie của Auth chung, CORS credentials cho origin HSK, và đường dẫn `/api/quiz` (xem `docs/api-requirements/class-management.md`). Quyền thật phải do backend kiểm tra.

Checklist kiểm chứng thật (khi có môi trường): (1) vào `/admin/class-management` chưa đăng nhập → thấy chuyển Auth kèm `redirect`; (2) đăng nhập tài khoản Admin test → về đúng route, thấy sidebar/tên người dùng; (3) tải lại + mở tab mới; (4) chờ/hết hạn access token → refresh tự động; (5) đăng xuất → cookie bị xóa; (6) tài khoản Teacher vào `/admin` bị chặn và vào `/instructor/list-class` được; (7) quan sát không có redirect lặp.

## 9. Giới hạn đã biết

- Chế độ hash: tải lại hoặc mở tab mới mất token trong bộ nhớ → đi vòng qua Auth (Auth_Frontend không có đăng nhập một chạm; người dùng có thể phải đăng nhập lại).
- `next dev` chạy React Strict Mode nên effect gọi API hai lần (chỉ ở dev); production không bị.
- Ở production cookie-only, lần tải đầu khi chưa có cookie hợp lệ sẽ có một lời gọi `/users/me` (401) và một lời gọi `/refresh` (400) trước khi chuyển Auth.
