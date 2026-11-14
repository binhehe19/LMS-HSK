# Triển khai frontend quản lý LMS HSK (Next.js) sau gateway của backend chung

Tài liệu cho người đưa bản build lên môi trường thật (dev/staging/production). Đường đi đã thống nhất với chủ dự án:
**xem trước trên máy mình** (`docs/PREVIEW-LOCAL.md`) → ổn → **build production** theo tài liệu này. Bản build production **không chứa mock**
(`next.config.ts` từ chối build khi cấu hình trỏ `localhost`/`.invalid`/`.test` hoặc có `*_API_PROXY_TARGET`; `tests/production-guard.test.ts` kiểm tra điều đó).

## 1. Mô hình

```
trình duyệt ──▶ Traefik (docker/infra của LMS_IELTS) ──┬── /api/lms, /api/notification, /api/storage ──▶ backend chung (priority cao hơn)
                                                       └── còn lại (Host = HSK_DOMAIN, priority 1) ──▶ lms-hsk-frontend (Next.js standalone, cổng 3000)
Authentication: đăng nhập qua oauth2-proxy (/oauth2/start, /oauth2/sign_out) cùng origin theo luồng IdP của IELTS — xem docs/AUTH-INTEGRATION.md.
  ⚠ Sơ đồ trên là mô hình hiện tại của compose; luồng IdP cần thêm gateway oauth2-proxy cho HSK_DOMAIN đứng trước FE (chưa dựng, AUTH-INTEGRATION.md mục 5).
```

Cùng mẫu `LMS_IELTS/frontend/Dockerfile` + `docker-compose.yml`: build multi-stage (`npm ci` → `next build --webpack` → `output: standalone`), chạy bằng user `node`, `TZ=Asia/Bangkok`.
Khác với IELTS: dùng **webpack** (Turbopack làm rơi `.shadow-sm` của SCSS HSK cũ — `docs/M3B2-WELCOME.md` mục 8) và có thêm các base path cho dịch vụ HSK theo hợp đồng đề xuất.

## 2. Biến môi trường (nhúng lúc build — đổi giá trị thì phải build lại)

| Biến | Bắt buộc | Giá trị khuyến nghị | Ghi chú |
|---|---|---|---|
| `NEXT_PUBLIC_AUTH_FRONTEND_URL` | **có** | URL Authentication_Frontend | đăng xuất (IdP kết thúc phiên chung) và liên kết trang tài khoản; `next dev` dùng để đăng nhập |
| `NEXT_PUBLIC_AUTH_API_BASE_URL` | **có** | `https://<host>/api/auth` | chỉ `next dev` dùng (đích proxy `/api/auth/*`); trình duyệt luôn gọi `/api/auth/users/me` cùng origin qua gateway |
| `NEXT_PUBLIC_LMS_API_BASE_PATH` | nên | `/api/lms` | repo-lms (Java): lớp/học viên/giáo trình chỉ đọc (proxy ERP) — các màn Admin đã nối |
| `NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH` | nên | `/api/notification` | repo-notification (Go) — chuông, Thông báo của tôi, danh sách thông báo Admin |
| `NEXT_PUBLIC_STORAGE_API_BASE_PATH` | nên | `/api/storage` | repo-storage (Go) — presign/upload/confirm (tải tệp trong tài liệu học tập / kho lưu trữ) |
| `NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH` | không | *(trống)* | bộ chọn người nhận thông báo (đọc); dịch vụ định danh chưa có endpoint ⇒ trống |
| `NEXT_PUBLIC_HSK_API_BASE_PATH` | không | *(trống)* | hợp đồng ĐỀ XUẤT HSK (`docs/api-requirements/*.md`): giảng viên, thanh toán/sao kê/gói, khoá học trực tuyến, kho nội dung, dashboard… **Chỉ đặt khi backend đã triển khai** |
| `NEXT_PUBLIC_QUIZ_API_BASE_PATH` | không | *(trống)* | hợp đồng ĐỀ XUẤT luồng giảng viên/chấm bài (B0 OPEN) |
| `NEXT_PUBLIC_TICKET_API_BASE_PATH` | không | *(trống)* | dịch vụ ticket (toast chào mừng, phân công công việc) — chưa có |
| `NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND`, `NEXT_PUBLIC_WRITE_*` | không | *(trống = ĐÓNG)* | công tắc THAO TÁC GHI chưa có hợp đồng xác nhận; `enabled` chỉ khi backend xác nhận (mục 5) |
| `NEXT_PUBLIC_DEMO_MODE` | **không bao giờ** | *(trống)* | chỉ `npm run preview:local` đặt; Dockerfile ép trống |

Base path để **trống** ⇒ màn hình dùng dịch vụ đó hiện **WAITING FOR BACKEND**, không tạo request, không có dữ liệu giả (không có fallback mock trong code).
Đường dẫn tương đối (`/api/...`) đi qua Traefik cùng origin; URL tuyệt đối cũng được (CORS do backend quyết định).

## 3. Lệnh

```
cp .env.example .env            # điền HSK_DOMAIN, TRAEFIK_NETWORK, NEXT_PUBLIC_AUTH_API_BASE_URL, NEXT_PUBLIC_AUTH_FRONTEND_URL
docker compose build            # build arg = các NEXT_PUBLIC_* ở trên
docker compose up -d
docker compose logs -f hsk-frontend
```

Không dùng Docker: `npm ci && npm run build && npm start` (cổng 3100, `PORT` đổi được); hoặc chạy `node .next/standalone/server.js` sau khi copy `.next/static` và `public` như Dockerfile.
Lưu ý: vì `next.config.ts` đặt `output: "standalone"` (cho Docker), `next start` in cảnh báo `"next start" does not work with "output: standalone"` — trên Next 16.3.5 nó vẫn phục vụ bình thường (bộ Playwright và `npm run preview:local` đều chạy qua `next start`); bản chạy lâu dài nên dùng `server.js` của standalone như container.

## 4. Kiểm tra sau khi lên

1. `https://<HSK_DOMAIN>/admin/dashboard` khi chưa đăng nhập ⇒ chuyển `/oauth2/start?rd=…` rồi sang IdP đúng **một lần** (không vòng lặp).
2. Đăng nhập tài khoản `ROLE_ADMIN` ⇒ về đúng URL, sidebar Admin 22 mục, `/admin/class-management` tải danh sách lớp từ `/api/lms/classes` (PageResponse snake_case).
3. Tài khoản `ROLE_TEACHER`/`ROLE_MENTOR` ⇒ `/instructor/welcome`; các màn giảng viên hiện **WAITING FOR BACKEND** cho tới khi `NEXT_PUBLIC_QUIZ_API_BASE_PATH` có backend thật (B0).
4. Role khác (Teacher-manager, Collaborator, học viên) ⇒ "Không có quyền truy cập", không lộ menu; URL không trong registry ⇒ 404.
5. Chuông thông báo: `GET /api/notification/notifications/unread-count` trả số; lỗi ⇒ không huy hiệu giả (`data-unread-status="error"`).
6. Tài khoản chưa xác minh email: backend chung (`EmailVerifiedFilter`) trả 403 code `233` ⇒ giao diện hiện **khối lỗi API chung** (+ "Thử lại"), không lặp refresh; **chưa có thông điệp riêng** cho mã 233 (ghi ở `docs/TECH-BACKLOG.md`).

Những điều **chưa từng được xác minh trên môi trường thật** (chưa có môi trường/tài khoản): Auth thật (M2 REAL AUTH VERIFICATION PENDING), các endpoint `/api/lms` (client viết theo DTO của source backend, có test hợp đồng trên mock), repo-notification/storage. Xem `docs/FEATURE-STATUS.md` cột "API".

## 5. Mở từng thao tác ghi (sau khi backend xác nhận hợp đồng)

Mỗi nhóm thao tác ghi có một công tắc riêng, mặc định ĐÓNG — trừ kho nội dung (`content`), đã nối repo-lms thật nên mặc định MỞ (giao diện hiện "chưa tích hợp", `assertWriteEnabled` ném lỗi trước khi tạo request — `src/lib/api/write-gate.ts`):

| Công tắc | Màn | Hợp đồng |
|---|---|---|
| `NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND=enabled` | gửi chiến dịch thông báo (Admin) | `docs/api-requirements/notifications.md` mục 5 |
| `NEXT_PUBLIC_WRITE_QUIZ_GRADING=enabled` | chấm bài, lưu, gửi kết quả | `docs/api-requirements/instructor-grading.md` |
| `NEXT_PUBLIC_WRITE_TEACHER_NOTE=enabled` | nhận xét trong phân tích học tập | `docs/api-requirements/learning-analysis.md` |
| `NEXT_PUBLIC_WRITE_LESSON_DETAIL=enabled` | sửa chi tiết bài học | `docs/api-requirements/instructor-grading.md` |
| *(không cần đặt, mặc định mở)*; `NEXT_PUBLIC_WRITE_CONTENT=disabled` để tạm khoá | CRUD kho nội dung (thẻ, từ vựng, hán tự, phát âm, bài tập, ngữ pháp, từ điển) | `docs/api-requirements/content-tree.md` |
| `NEXT_PUBLIC_WRITE_LESSON_MATERIALS=enabled` | tài liệu học tập | `docs/api-requirements/lesson-materials.md` |

Thứ tự an toàn: đặt base path của dịch vụ (đọc) → kiểm tra màn đọc đúng trên staging → mới đặt công tắc ghi → build lại.

## 6. Không được làm

- Không đặt `NEXT_PUBLIC_DEMO_MODE`, `HSK_ALLOW_MOCK_ENDPOINTS` hay URL mock trong `.env*`/CI của bản thật (build sẽ bị từ chối; `AuthInitializer` cũng từ chối chạy cấu hình mock ngoài loopback).
- Không nới guard của `next.config.ts` để "build cho nhanh".
- Không ánh xạ/gộp role ở frontend (Teacher-manager/Collaborator vẫn UNKNOWN ⇒ 404 cho tới khi có quyết định + xác minh với Auth thật).
- Không bật `NEXT_PUBLIC_WRITE_*` khi backend chưa có endpoint: giao diện sẽ gọi và nhận lỗi thật thay vì "thành công giả" — nhưng vẫn là request vô ích.
