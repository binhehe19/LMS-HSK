# Tích hợp Authentication chung — luồng IdP (oauth2-proxy)

Frontend HSK đăng nhập theo **cùng luồng IdP với LMS_IELTS/frontend**: gateway oauth2-proxy đứng trước app, giữ phiên bằng cookie cùng origin
và gắn `Authorization: Bearer` cho service phía sau. FE **không giữ token**, không có trang đăng nhập/đăng ký, không tự làm mới phiên.
Thay cho cơ chế cũ (token trong URL hash/bộ nhớ, `POST /refresh` do FE gọi, `POST /logout`).

> **Trạng thái kiểm chứng:** đã có unit test (Vitest) và production build. **Chưa kiểm chứng với gateway và IdP thật**: gateway oauth2-proxy
> cho `HSK_DOMAIN` và redirect URI của nó ở IdP chưa được dựng (xem mục 5).

## 1. Luồng

| Bước | Production (sau gateway) | `next dev` (không có gateway) |
|---|---|---|
| Kiểm tra phiên | `GET /api/auth/users/me` cùng origin; gateway chuyển tới IdP kèm token của phiên | giống nhau; `next.config.ts` chuyển `/api/auth/*` tới `NEXT_PUBLIC_AUTH_API_BASE_URL`, FE gắn Bearer từ `localStorage` |
| Chưa đăng nhập (401/403) | `/oauth2/start?rd=<đường dẫn + query hiện tại>` → IdP → quay lại đúng trang | `<AUTH_FRONTEND_URL>/login?continue=<origin>/dev-auth/callback?rd=…`; `/dev-auth/callback` nhận token ở hash, lưu `localStorage`, về `rd` |
| API nghiệp vụ trả 401 | báo "hết phiên" → `RequireAuth` đưa đi đăng nhập lại (có chống lặp) | thử `POST /api/auth/refresh` (header `X-Refresh-Token`) một lần, vẫn 401 thì như bên trái |
| Đăng xuất (sidebar) | `/oauth2/sign_out?rd=<AUTH_FRONTEND_URL>/api/auth/logout/idp?client_id=lms&post_logout_redirect_uri=<origin>/` | xóa token local, `POST /api/auth/logout`, về `/` |
| Trang khác của Auth (hồ sơ…) | mở thẳng ở host của IdP (`buildAuthFrontendUrl`) | như bên trái |

Chống lặp vẫn giữ: mỗi tab chỉ tự chuyển đi đăng nhập một lần trong 2 phút (`redirect-guard.ts`); quay về mà chưa có phiên → trạng thái `redirect-loop`
(hướng dẫn + nút "Đăng nhập lại"). Lỗi mạng / 5xx khi hỏi `/users/me` → `error` (thông báo + Thử lại), **không** coi là chưa đăng nhập.

## 2. Mã nguồn

| File | Việc |
|---|---|
| `lib/auth/dev-token-session.ts` | chỉ `next dev`: lưu token, gắn Bearer, refresh một lần (khóa giữa các tab), đăng xuất local. Copy nguyên từ LMS_IELTS; production biên dịch `isDevIdpLogin()` thành `false` |
| `lib/auth/auth-redirect.ts` | `redirectToAuthFrontend` (đăng nhập), `redirectToSignOut`, `buildAuthFrontendUrl` |
| `app/dev-auth/callback/page.tsx`, `components/auth/dev-auth-callback.tsx` | nhận token khi `next dev`; production trả 404 |
| `lib/api/api-client.ts` | gửi cookie (`credentials: "include"`), Bearer chỉ ở dev; 401 → `notifySessionExpired()` |
| `lib/api/auth-client.ts` | chỉ `getCurrentUser()` (`GET /api/auth/users/me`) |
| `lib/api/auth-session.ts` | danh sách người nghe "hết phiên" (không còn refresh) |
| `components/auth/{auth-initializer,require-auth}.tsx` | khởi tạo phiên và chặn route theo role (không đổi vai trò) |

Giữ riêng của HSK so với IELTS: `RequireAuth` **không** có đường tắt bỏ qua kiểm tra ở dev, và HSK không có trang công khai nào.

## 3. Hợp đồng đã dựa vào

- `GET /users/me` → `ProfileResponse` (`id, email, fullName, avatarUrl, roles, emailVerified…`); role là chuỗi nguyên văn (`ROLE_ADMIN`…). `ROLE_MANAGER` và `ROLE_TEACHER_MANAGER` là hai role riêng, không ánh xạ.
- Gateway chỉ chuyển tiếp tới IdP các đường `users/me`, `users/lookup`, `users/me/password` (xem `LMS_IELTS/backend/repo-gateway/oauth2-proxy.yml`).
- Client OAuth của gateway HSK **dùng chung client `lms`** (`client_id=lms`, secret `LMS_OAUTH_CLIENT_SECRET`).

## 4. Role và guard

- `/admin/*`: chỉ `ROLE_ADMIN`. `/instructor/*`: `ROLE_TEACHER` hoặc `ROLE_MENTOR`. Role khác bị chặn ở cả hai.
- Guard chỉ là rào giao diện; backend phải kiểm tra quyền ở mỗi API.

## 5. Việc còn lại ngoài `hsk_frontend` (chưa làm)

1. Dựng gateway oauth2-proxy cho `HSK_DOMAIN` (cùng mẫu `LMS_IELTS/backend/repo-gateway/oauth2-proxy.yml`: upstream `lms`/`storage`/`notification`/`idp-api` và `frontend: lms-hsk-frontend:3000`) và đưa Traefik của `HSK_DOMAIN` vào gateway thay vì thẳng vào FE.
2. Ở IdP, thêm vào client `lms`: redirect URI `https://<HSK_DOMAIN>/oauth2/callback` và post-logout redirect URI `https://<HSK_DOMAIN>/`.
3. Chạy local cần `NEXT_PUBLIC_AUTH_FRONTEND_URL` + `NEXT_PUBLIC_AUTH_API_BASE_URL` trỏ IdP dev và origin của app có trong `NEXT_PUBLIC_DEV_APP_ORIGINS` của IdP dev (như `run-hsk.bat`).

Checklist kiểm chứng thật: (1) vào `/admin/class-management` chưa đăng nhập → `/oauth2/start` rồi IdP, đúng **một** lần; (2) đăng nhập Admin → về đúng route; (3) tải lại và mở tab mới vẫn còn phiên;
(4) đăng xuất → phiên proxy và phiên IdP mất, về `/`; (5) Teacher vào `/admin` bị chặn, vào `/instructor/list-class` được; (6) không có redirect lặp.

## 6. Kiểm soát mock / production

1. **Build/start production** (`next.config.ts`): từ chối nếu `NEXT_PUBLIC_AUTH_FRONTEND_URL`, `NEXT_PUBLIC_AUTH_API_BASE_URL`, `NEXT_PUBLIC_QUIZ_API_BASE_PATH` trỏ localhost/loopback/`.invalid`/`.test`/`.localhost`, hoặc có `*_API_PROXY_TARGET`. Ngoại lệ `HSK_ALLOW_MOCK_ENDPOINTS=1` chỉ trên dòng lệnh, bị từ chối khi có `CI` hoặc nằm trong file `.env*`.
2. **Lúc chạy** (`AuthInitializer`): cấu hình mock trên host không phải loopback → báo lỗi, không gọi mạng.
3. **Mock server** (`scripts/mock-server.mjs`): tách riêng, chỉ bind `127.0.0.1`. Mock server mô phỏng luồng cũ (`/login`, `/refresh`) và **chưa được cập nhật** theo luồng IdP.

## 7. Giới hạn đã biết

- `next dev` chạy React Strict Mode nên effect gọi API hai lần (chỉ ở dev).
- Token dev nằm trong `localStorage` (giống IELTS) để mọi tab dùng chung một phiên; production không có token ở FE.
- `npm ci` hiện lỗi vì `package-lock.json` lệch `package.json` (có từ trước, không liên quan luồng đăng nhập).
