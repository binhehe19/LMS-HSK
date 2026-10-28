# Xem trước cục bộ với dữ liệu giả lập (MOCK / NOT INTEGRATED)

Dùng để **xem toàn bộ khu quản lý Admin/Giảng viên trên máy mình** khi backend chung chưa có endpoint cho phần lớn nghiệp vụ HSK (xem `docs/FEATURE-STATUS.md`).
Đây **không phải** môi trường production và **không phải** bản build riêng: ứng dụng được build production **bình thường** (không có mock trong code, guard của
`next.config.ts` không bị nới), chỉ thêm cờ `NEXT_PUBLIC_DEMO_MODE=1` để hiện thanh vàng "XEM TRƯỚC CỤC BỘ" và mở các thao tác ghi với máy chủ giả lập.
"Giả" nằm ở hai tiến trình ngoài ứng dụng: máy chủ giả lập (`scripts/mock-server.mjs`, hồ sơ dữ liệu `demo`) và gateway cách ly (`scripts/e2e-gateway.mjs`).

## Chạy

```
npm ci                 # lần đầu
npm run preview:local  # build production vào .next-preview (~3 phút) rồi chạy mock + next start + gateway
```

Mở **http://localhost:3100/demo** → chọn tài khoản giả lập:

| Tài khoản | Vai trò | Vào đâu | Dữ liệu |
|---|---|---|---|
| Quản trị viên | `ROLE_ADMIN` | `/admin/dashboard` | toàn bộ 12 lớp, 40 học viên, 4 giảng viên, thông báo/chiến dịch/ticket của quản trị |
| Giảng viên | `ROLE_TEACHER` | `/instructor/welcome` | 4 lớp được phân công (H4006, GT2-003 đang học; H5004 đã kết thúc; H3002 sắp mở), buổi học, bài nộp chờ chấm |
| Trợ giảng | `ROLE_MENTOR` | `/instructor/welcome` | 2 lớp (H4006, GT2-003) cùng giảng viên demo |
| Học viên | `ROLE_USER` | `/instructor/welcome` → "Không có quyền truy cập" | — |

- Dừng: `Ctrl+C` (tắt cả ba tiến trình).
- Dùng lại bản build sẵn có (không build lại): `npm run preview:local -- --no-build`. Chỉ build: `npm run preview:build`.
- Đổi cổng: `npm run preview:local -- --port 3100 --app 3300 --mock 3390`.
- **Reset dữ liệu giả lập** về trạng thái ban đầu: nút "Reset dữ liệu giả lập" trên thanh vàng, hoặc mở `http://localhost:3100/__auth/mock-reset`.
- Đổi vai trò: nút "Đổi vai trò" trên thanh vàng (về `/demo`).

Xem trước nhanh bằng `next dev` (không cần build, có HMR) vẫn như trước: `npm run mock:server` (cổng 3190) rồi `npm run dev` với các biến trỏ `http://localhost:3190/...`
(xem `.env.example`); khi đó không có thanh vàng vì không đặt cờ demo, và thao tác ghi bị khoá (đúng như bản thật).

## Điều gì là thật, điều gì là giả

| Thành phần | Ở chế độ xem trước | Ở bản thật (production) |
|---|---|---|
| Ứng dụng Next.js | bản build production thật | giống hệt, trừ cờ `NEXT_PUBLIC_DEMO_MODE` không đặt |
| Authentication | giả lập (`/__auth/*` → mock), phiên cookie giả | Authentication_Frontend/Backend chung (`NEXT_PUBLIC_AUTH_*`) |
| `/api/lms`, `/api/notification`, `/api/storage` | mock mô phỏng **đúng hình dạng DTO** của backend chung | backend chung LMS_IELTS |
| `/api/hsk`, `/api/quiz`, `/api/tickets` (hợp đồng đề xuất) | mock | **chưa có** → để trống biến → màn hình hiện WAITING FOR BACKEND |
| Thao tác ghi (chấm bài, nhận xét, CRUD giảng viên/nội dung…) | mở (write gate theo cờ demo), thay đổi dữ liệu trong bộ nhớ của mock | khoá cho tới khi backend xác nhận hợp đồng và đặt `NEXT_PUBLIC_WRITE_*=enabled` |

## An toàn

- Bản build xem trước chỉ hoạt động khi trang được phục vụ từ host loopback hoặc mạng riêng (`lib/demo/demo-mode.ts`); trên host khác `AuthInitializer` từ chối chạy.
- Mock và gateway chỉ bind `127.0.0.1`; không gọi ra ngoài; không ghi đĩa; không có dữ liệu cá nhân thật (email `@demo.invalid`).
- `next.config.ts` vẫn từ chối build production có URL mock/`*_API_PROXY_TARGET`; `scripts/preview-local.mjs` chỉ dùng đường dẫn cùng origin.
