# M1 — danh sách file đã tạo (để hoàn tác chính xác)

> **Lịch sử.** Danh sách này mô tả trạng thái khi kết thúc M1. Sau M1.5 nhiều đường dẫn đã được chuyển/gộp/xóa
> (`features/`, `core/`, `routes/`, `store/`, `tools/`... không còn); bảng ánh xạ đầy đủ và cách hoàn tác ở `docs/M1.5-REFACTOR.md`.

Mọi file nằm trong `LMS_HSK/frontend`. Thư mục này **rỗng** trước M1 (không có dữ liệu nào cần giữ), và M1 **không sửa**
bất kỳ file nào ngoài thư mục này (đã kiểm tra `git status` sạch ở `LMS_Frontend`, `LMS_Backend`, `LMS_IELTS`,
`Authentication_Frontend`, `Authentication_Backend`).

Hoàn tác = xóa đúng các mục dưới đây (không xóa cả thư mục `LMS_HSK/frontend` nếu sau này có file khác được thêm vào).

## Cấu hình / tài liệu
`package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`,
`.env.example`, `README.md`, `docs/AUTH-INTEGRATION.md`, `docs/FEATURE-STATUS.md`, `docs/M1-MANIFEST.md`,
`docs/api-requirements/class-management.md`, `tools/mock-server.mjs`

## Mã nguồn (`src/`)
- `app/layout.tsx`, `app/(management)/admin/layout.tsx`, `app/(management)/admin/class-management/page.tsx`
- `components/auth/{auth-initializer,auth-panels,require-auth,session-source-context}.tsx`
- `components/common/asset-image.tsx`, `components/layout/{back-to-top,management-shell}.tsx`, `components/providers/store-provider.tsx`
- `core/config/endpoints.ts`, `core/types/ticket-module.ts`
- `features/admin/class-management/{admin-class-management-page.tsx, admin-class-management-view.tsx, admin-class-management.css, class-management-helpers.ts, api/class-management-api.ts}`
- `features/management/admin-page-frame.tsx`, `features/management/sidebar/{admin-sidebar.tsx, admin-sidebar-menu.ts, instructor-sidebar-data.ts, use-sidebar-collapse.tsx}`
- `lib/api/{api-client,auth-client,lms-client}.ts`, `lib/api/contracts/class-management.ts`, `lib/auth/{auth-redirect,roles}.ts`
- `routes/management-routes.ts`, `store/{auth-slice,hooks,store}.ts`
- `styles/index.scss`, `styles/legacy-feature-css.ts`, `styles/scss/**` (sao chép từ `LMS_Frontend/src/style/scss`, đã sửa 2 file: xem `FEATURE-STATUS.md`),
  `styles/css/{iconsax,meanmenu}.css`, `styles/fonts/iconsax.{eot,svg,ttf,woff}`

## Tài sản (`public/assets/hocba/`)
`hocbadentrang.png`, `hocba2co.png`, `LOGO01.png` (sao chép từ `LMS_Frontend/public/assets/hocba`)

## Test (`tests/`)
`setup.ts`, `fixtures/classes.ts`, `roles.test.ts`, `require-auth.test.tsx`, `admin-sidebar-menu.test.ts`,
`class-management-api.test.ts`, `class-management-helpers.test.ts`, `class-management-view.test.tsx`

## Sinh tự động / cục bộ (không commit)
`node_modules/`, `.next/`, `tsconfig.tsbuildinfo`, `next-env.d.ts`, `.env.local` (giá trị host `.invalid` cho test cách ly),
`AGENTS.md` và `CLAUDE.md` (do `next dev` của Next 16 sinh; IELTS cũng có và commit chúng — giữ hay bỏ là tùy chủ dự án).

## Ngoài thư mục dự án (tạm, có thể xóa)
Công cụ kiểm thử trình duyệt (Playwright core, ảnh chụp, kịch bản) nằm trong thư mục scratchpad của phiên làm việc, không thuộc repo.
