# M3B.4 — Màn "Quản lý thông báo" của Admin (`/admin/settings/notifications`)

Trạng thái: **UI COMPLETE · API WAITING FOR BACKEND · TESTED trên MOCK**. Không chức năng nào ở mức `API INTEGRATED`. **M2 REAL AUTH VERIFICATION vẫn PENDING.**
Nguồn so sánh: `LMS_Frontend` @ `72292b7` (chỉ đọc). Phạm vi: chỉ `LMS_HSK/frontend`. Checkpoint M3B.3: commit `f371410`, tag `m3b3-checkpoint`.

## 1. Khảo sát màn cũ

| Hạng mục | Kết quả |
|---|---|
| Route / component | `/admin/settings/notifications` (PrivateRoute `ADMIN`) → `AdminNotification` (wrapper 9 dòng) → `InstructorNotification` dùng chung với Teacher; nhánh `canSendNotification = isAdmin || isTeacherManager` thêm tiêu đề "Quản lý thông báo", hai nút ở đầu danh sách và form gửi |
| Thành phần con | `ManualNotificationComposer` (189 dòng), `RecipientSelectorModal` (265), `CampaignPreviewModal` (66), `CampaignHistoryModal` (171), `NotificationListContent` (dùng chung, đã chuyển ở M3B.3) |
| CSS | Không có CSS riêng: class Bootstrap/template. `animate__*` có trong class nhưng **animate.css không được nạp ở bản cũ** (không có animation) |
| State/hook | `useNotificationList` (chung), state cục bộ trong từng modal; modal là `div.modal.show.d-block` thuần (không JS Bootstrap), nhúng trong thẻ form / `.col-lg-9` |
| Form + validation | Tiêu đề + nội dung + ≥ 1 người nhận; kiểm tra khi bấm "Xem trước & Gửi" (toast `Vui lòng nhập đầy đủ tiêu đề, nội dung và chọn ít nhất 1 người nhận.`); không giới hạn độ dài |
| Thao tác ghi | `POST /notification/admin/campaigns/send-now` `{title, message, userIds}`; thành công: toast, xoá form, đóng form, tải lại danh sách |
| Thao tác đọc | `GET /notification/admin/campaigns?page&size` (lịch sử, size 10); `GET /id/admin/users?page&size&search&role` (**dịch vụ định danh**, size 10; "Chọn tất cả …" gọi `size=1` rồi `size=<tổng>`) |
| Chọn người nhận | `Map<id, tên>` (giữ thứ tự chọn); chọn từng người, "Chọn tất cả trang này", "Chọn tất cả {vai trò}", chip tối đa 30 + "… và N người khác", bỏ chọn từng chip, "Xóa tất cả"; tìm kiếm chỉ áp dụng khi bấm "Tìm kiếm", đổi vai trò gọi ngay |
| Loading / empty / error | Spinner trong bảng, "Không tìm thấy người dùng", "Chưa có thông báo nào được gửi."; **lỗi chỉ toast rồi hiện trạng thái rỗng** |
| Quyền | ADMIN. Nhánh Teacher-manager cùng component nhưng route riêng `/teacher-manager/settings/notifications` (UNKNOWN, không cấp) |
| Dùng chung với màn Teacher (M3B.3) | `NotificationListView` + `useNotificationPage` + `notification-client` + chuông + Toaster — tái dùng nguyên, **không sửa màn Teacher** |

Hai quan sát về bản cũ: (1) `moment` dùng cho ngày lịch sử → mới dùng `dayjs` cùng mẫu `DD/MM/YYYY HH:mm`; (2) danh sách người dùng gọi qua `/id/admin/users` — thuộc dịch vụ khác dịch vụ thông báo nên mới có biến cấu hình riêng (xem mục 5).

## 2. Cấu trúc màn mới

```
app/(management)/admin/settings/notifications/page.tsx     page mỏng
components/management/notifications/
  admin-notifications-page-content.tsx   container: danh sách (tái dùng) + 2 nút + form + modal lịch sử
  manual-notification-composer.tsx       form gửi (DOM như bản cũ) + chip người nhận
  recipient-selector-modal.tsx           modal chọn người nhận (view)
  campaign-preview-modal.tsx             modal xác nhận gửi (view thuần)
  campaign-history-modal.tsx             modal lịch sử + chi tiết (view)
  use-campaign-composer.ts               logic form: validate, chọn người, xem trước, gửi, chống gửi trùng
  use-recipient-selector.ts              tìm kiếm/lọc/phân trang người dùng, "chọn tất cả …"
  use-campaign-history.ts                tải lịch sử theo trang, chọn chiến dịch
  use-keyed-fetch.ts                     tải theo khoá (trang + bộ lọc), phân loại loading/ok/waiting/error, giữ dữ liệu gần nhất
lib/notifications/{campaign-form,recipient-selection,pagination}.ts   logic thuần (có test)
lib/api/notification-client.ts           + fetchCampaigns, sendCampaign (CampaignSendDisabledError)
lib/api/admin-user-client.ts             MỚI, chỉ ĐỌC danh sách người dùng (dịch vụ định danh)
lib/api/campaign-send-gate.ts            công tắc an toàn cho thao tác gửi
types/{notification,admin-user}.ts       + Campaign*, SendCampaignRequest, AdminUser*
```

Không thêm Redux slice. Một client mới (`admin-user-client`) là cần thiết vì danh sách người dùng thuộc dịch vụ khác với dịch vụ thông báo (khác base path, khác quyền); không có "hệ thống thông báo thứ hai".

## 3. Thành phần tái dùng từ M3B.3

`NotificationListView` (tiêu đề, bộ lọc, ngày, danh sách, phân trang, `headerActions`), `useNotificationPage` (tải/lọc/đọc/đọc tất cả/điều hướng), `notification-client` (cùng client + base path), `pickNotificationTarget`, `ManagementShell`/`ManagementPageFrame`/`ManagementSidebar` (khu vực Admin), `Toaster`, chuông thông báo. Màn Admin chỉ thêm `headerActions` + form + modal.

## 4. Chức năng

| Chức năng | Trạng thái |
|---|---|
| Danh sách thông báo của Admin (lọc, ngày, phân trang, đọc, đọc tất cả) | UI COMPLETE (tái dùng); API WAITING FOR BACKEND |
| Lịch sử chiến dịch (danh sách, phân trang, chi tiết, trạng thái màu) | UI COMPLETE; API (đọc) WAITING FOR BACKEND |
| Form gửi, validation, xem trước, xác nhận | UI COMPLETE; **thao tác gửi bị khoá mặc định** (công tắc an toàn) — WAITING FOR BACKEND |
| Chọn người nhận (tìm, lọc vai trò, phân trang, chọn tất cả trang/theo bộ lọc, chip, bỏ chọn, xoá tất cả) | UI COMPLETE; API (đọc) WAITING FOR BACKEND |
| Chống gửi trùng trong giao diện | DONE (khoá đồng bộ bằng ref + nút khoá + trạng thái "Đang gửi..."); chống trùng phía backend: cần xác nhận |

### Kiểm soát thao tác ghi (mục 8 của yêu cầu)

Ba lớp độc lập (chi tiết `docs/api-requirements/notifications.md` mục 5.1): (1) `NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND=enabled` mới mở gửi — mặc định đóng, nút "Xem trước & Gửi" khoá + khối "WAITING FOR BACKEND"; (2) hook không có đường vào `sendCampaign` khi đóng; (3) `sendCampaign` tự ném `CampaignSendDisabledError` **trước khi tạo request**. Test chứng minh `fetch` không được gọi khi đóng (`tests/notification-libs.test.ts`, `tests/admin-notifications.test.tsx`, e2e `unconfigured.spec.ts`). Không bao giờ hiện "Đã gửi thành công" giả; không dữ liệu fallback. Bản build e2e (mock cách ly) mới bật công tắc.

## 5. Khác biệt có chủ đích so với HSK cũ

| # | Bản cũ | Bản mới | Phân loại |
|---|---|---|---|
| 1 | Lỗi/chưa cấu hình ở lịch sử/người dùng: toast rồi hiện "chưa có thông báo…"/"không tìm thấy" | Toast (khi lỗi) + khối cảnh báo có "Thử lại"; chưa cấu hình: "WAITING FOR BACKEND" | Trạng thái mới do API chưa sẵn sàng |
| 2 | Luôn có thể gửi | Gửi bị khoá khi công tắc đóng + khối cảnh báo trong form | Kiểm soát thao tác ghi (yêu cầu mục 8) |
| 3 | Tiêu đề/nội dung chỉ khoảng trắng lọt validation | Coi là trống; gửi bản đã cắt khoảng trắng hai đầu | Sửa lỗi nhỏ của validation |
| 4 | Bấm "Xác nhận & Gửi" nhiều lần nhanh có thể gửi nhiều lần (nút chỉ khoá sau khi React vẽ lại) | Khoá đồng bộ bằng ref | Chống gửi trùng (yêu cầu mục 11) |
| 5 | "Chọn tất cả …": nếu máy chủ giới hạn kích thước trang, vẫn báo "Đã chọn tất cả N" dù chỉ lấy một phần | Thêm phần lấy được và báo lỗi "Chỉ lấy được X/N …" | Tránh gửi thiếu người mà tưởng đủ |
| 6 | Phân trang danh sách thông báo không hoạt động (page luôn về 0) | Hoạt động đúng; giữ bộ lọc khi chuyển trang; đổi bộ lọc về trang đầu; trang không còn hợp lệ nhảy về trang cuối | **INTENTIONAL BUG FIX** (chủ dự án duyệt) |
| 7 | Trang hiện tại có thể vượt tổng sau khi dữ liệu giảm (modal người dùng/lịch sử): bảng trống | Tự nhảy về trang cuối còn dữ liệu | Xử lý trang không hợp lệ (yêu cầu mục 2) |
| 8 | `useEffect` tìm người dùng có thể gọi API hai lần khi đang ở trang > 0 và bấm "Tìm kiếm" | Một lần | Giảm lời gọi thừa |
| 9 | `<label>` không gắn với ô nhập, nút đóng không có tên, hộp thoại không có role | `htmlFor`/`id`, `aria-label`, `role="dialog"` `aria-modal` | Khả năng truy cập; không đổi hiển thị |
| 10 | `moment` | `dayjs` (cùng mẫu định dạng) | Giữ nguyên hiển thị |

## 6. Quyền

Chỉ `ROLE_ADMIN` (PrivateRoute HSK cũ ∩ role hỗ trợ). Teacher, Mentor, Teacher-manager, Collaborator, Manager, User, không role → trang "không có quyền", không sidebar/nội dung, **không có request** tới chiến dịch/người dùng (e2e). Chưa đăng nhập → Auth đúng một lần, không gọi API. `/teacher-manager/settings/notifications` vẫn UNKNOWN (404). Màn Teacher vẫn TEACHER+MENTOR. Không sửa Authentication hay role mapping; không mở rộng quyền để tái dùng component.

## 7. Registry sau M3B.4

148 route khu quản lý = **4 MIGRATED** (`/admin/class-management`, `/admin/settings/notifications`, `/instructor/welcome`, `/instructor/instructor-notifications`) + **71 NOT_MIGRATED** + **49 UNKNOWN** (17 không PrivateRoute + 32 chỉ role chưa xác minh + 0 chỉ đăng nhập; không đổi) + **24 OUT_OF_SCOPE**. Chỉ route Admin thông báo đổi trạng thái (NOT_MIGRATED → MIGRATED). `docs/ROUTE-STATUS.md` sinh lại.

## 8. Rà soát `overrides` của dependency (yêu cầu mục 3)

22 gói gián tiếp được ghim trong `package.json` về đúng phiên bản của `package-lock.json` HSK cũ (xem M3B.3).

| Nhóm | Gói (phiên bản ghim) | Lý do | Bằng chứng |
|---|---|---|---|
| **A. Định vị popup (CẦN, đã chứng minh)** | `@rc-component/trigger` 2.2.6 | rc-trigger tính vị trí popup của DatePicker/Select/Dropdown. Bản 2.3.1 làm `left` của popup lịch lệch 1px so với HSK cũ | **Thí nghiệm riêng**: giữ nguyên mọi override khác, chỉ bỏ ghim `trigger` (cài 2.3.1 cho mọi nơi dùng): popup `left` = **793** (cũ **794**); có ghim: 794. Đo bằng `picker-probe` (cùng hình học `RangePicker`, chỉ khác `left` của dropdown) |
| B. Thành phần cùng họ rc-* của lịch/chọn | `rc-picker` 4.9.0, `rc-util` 5.44.3, `rc-overflow` 1.3.2, `rc-virtual-list` 3.17.0, `rc-select` 14.16.4, `rc-input` 1.7.2, `rc-menu` 9.16.0 | Cùng phiên bản với bản cũ để hành vi/hình học của Select, Menu, DatePicker không trôi | **Chưa chứng minh riêng từng gói** là cần cho CSS/layout; ghim phòng ngừa theo lockfile cũ |
| C. Bảng/tab/slider/rate/segmented/image/notification/form | `rc-table` 7.50.1, `rc-tabs` 15.5.0, `rc-slider` 11.1.8, `rc-rate` 2.13.0, `rc-segmented` 2.7.0, `rc-image` 7.11.0, `rc-notification` 5.6.2, `rc-field-form` 2.7.0, `@rc-component/{async-validator 5.0.4, mini-decimal 1.1.0, qrcode 1.0.0}` | Màn Admin sẽ dùng antd Table/Tabs/Form khi chuyển tiếp | **Chưa chứng minh**; phòng ngừa |
| D. Kiểu/biểu tượng/màu | `@ant-design/cssinjs` 1.22.1, `@ant-design/colors` 7.2.0, `@ant-design/icons-svg` 4.4.2 | `cssinjs` 2.x/1.24 sinh CSS-in-JS khác (token, thứ tự style); `colors`/`icons-svg` quyết định bảng màu và icon của antd | **Chưa chứng minh riêng**; cssinjs là rủi ro cao nhất nếu đổi (ảnh hưởng mọi thành phần antd) |

Kiểm tra cây và tương thích:
- `npm ls` thoát 0; không có `invalid`/`missing`/`UNMET`. Chỉ 2 cảnh báo `extraneous` đã có sẵn của Next/sharp (không liên quan).
- **Mọi phiên bản ghim đều nằm trong dải semver mà `antd@5.23.0` khai báo** (`cssinjs ^1.22.0`, `@rc-component/trigger ^2.2.6`, `rc-picker ~4.9.0`, `rc-util ^5.44.3`, `colors ^7.2.0`) và thoả peer của `@ant-design/nextjs-registry@1.3.0` (`cssinjs >=1.0.0`). Nên override KHÔNG ép phiên bản ngoài dải; nó chỉ chọn đầu thấp của dải.
- Chỉ một bản `cssinjs` (1.22.1) còn lại trong cây.

Ảnh hưởng bảo trì/nâng cấp:
- Với `npm ci`, **`package-lock.json` đã quyết định cây** — `overrides` chủ yếu bảo vệ khi lock bị sinh lại/`npm update` (nếu không, `^`/`~` trôi lên bản mới và popup lệch 1px quay lại).
- Nâng `antd` lên bản mới: các dải khai báo thay đổi → phải xem lại overrides (có thể xung đột `EOVERRIDE`) và chạy lại `css-fidelity` + so ảnh popup.
- Cảnh báo bảo mật/bản vá của các gói bị ghim ở đầu thấp của dải sẽ không tự được nhận; cần chính sách xem xét định kỳ.
- **Quyết định: giữ nguyên cả 22** (không đánh đổi độ chính xác giao diện để giảm số lượng khi chưa có bằng chứng thay thế tương đương). Việc giảm bớt (nhóm B–D) cần thí nghiệm theo nhóm: bỏ nhóm, build, chạy `css-fidelity` + so ảnh popup/bảng với HSK cũ — chưa làm ở milestone này.

## 9. Điều tra lần chạy Playwright 2,6 giờ (yêu cầu mục 4)

**Kết luận có bằng chứng: máy ngủ ~2 giờ 15 phút trong lúc chạy; không phải test treo.**

| Bằng chứng | Kết quả |
|---|---|
| Nhật ký Windows `Microsoft-Windows-Power-Troubleshooter` (event 1) | `SleepTime = 2026-10-24T05:04:32Z` → `WakeTime = 07:20:01Z` = **2h15m29s** ngủ; lần chạy bắt đầu ~12:02 giờ địa phương (= 05:02Z), tức ngủ ngay 2 phút sau khi bắt đầu |
| Thời gian chạy thực tế | Tổng 2,6 giờ − 2,26 giờ ngủ ≈ **~20 phút**, phù hợp 12–15 phút của lần chạy sạch |
| Ca lỗi duy nhất (`class-management.spec.ts:101`, timeout 90s) | Là test thứ 30 trong thứ tự chạy (~4–5 giây/test ⇒ ≈ 2 phút sau khi bắt đầu, đúng lúc máy bắt đầu ngủ): timer 90 giây hết hạn ngay khi thức dậy → hết giờ giả. Chạy lại riêng spec: 11/11 đạt; bản sao sạch 232/232 |
| Tiến trình mồ côi sau khi chạy | Không có: cổng 3100/3101/3102/3190/3200/3201 trống, không còn `node`/server của test |
| Browser context/page | Do fixture của Playwright đóng sau mỗi test; test dùng `page.route` có cổng chờ (`gate`) — nếu test lỗi trước khi giải phóng, context bị đóng nên không treo |
| Retry | `retries: 0` — không có vòng thử lại ẩn |
| Request/promise có thể không kết thúc | `fetch` của helper `mock.ts` không có timeout (đã thêm 10 giây); `visual.spec` đã có 8 giây |

Đã sửa/bổ sung (không tăng timeout từng test, không làm yếu test):
1. `globalTimeout: 60 phút` (đo thực tế ~20 phút với 274 test ≈ 3× dự phòng) — treo thật sẽ dừng và báo, thay vì chạy vô hạn. Timeout từng test giữ 90 giây (expect 15 giây).
2. Reporter chẩn đoán `e2e/support/run-diagnostics-reporter.ts`: nhịp 30 giây, nếu trễ > 90 giây in **"NHẢY ĐỒNG HỒ … máy ngủ/treo?"**; test kéo dài > 1,5× timeout in **"NGHI NGỜ ĐÓNG BĂNG"**; test lỗi/hết giờ in giờ bắt đầu thật, thời lượng, dự án, file:dòng; cuối run in tổng thời gian và thời gian đóng băng phát hiện được.
3. `fetch` tới mock server trong `e2e/support/mock.ts` có timeout 10 giây.

**Lần chạy thứ hai (bản sao sạch M3B.4) — reporter chẩn đoán đã chứng minh được giá trị:** 1 test hết giờ (`navigation.spec.ts:199`, 92s > 90s) nhưng dòng `[diag]` ghi **"đóng băng phát hiện 0s"** ⇒ KHÔNG phải máy ngủ. Nguyên nhân thật là lỗi test: ca kiểm tra "mục menu active + tải lại" cho `/admin/settings/notifications` chờ trang placeholder, trong khi route này vừa chuyển sang trang thật (MIGRATED) nên placeholder không bao giờ xuất hiện. Đã sửa (chờ `REAL_PAGE_MARKER` của route); test đạt. Bài học: mỗi lần chuyển route phải cập nhật cả `REAL_PAGE_MARKER` lẫn các ca chờ placeholder trong `navigation.spec.ts`.

Giới hạn: bộ phát hiện "nhảy đồng hồ" **chưa được thử với một lần ngủ thật** (chỉ chạy bình thường: 0 lần phát hiện, đúng); không thể mô phỏng giấc ngủ hệ điều hành trong test tự động. `globalTimeout` sẽ dừng lần chạy nếu máy ngủ > ~30 phút giữa chừng — đó là mong muốn (báo rõ thay vì lặng lẽ).

## 10. Kết quả kiểm thử

Bản sao sạch (sao chép cây làm việc sang thư mục mới, `npm ci`, không dùng node_modules/.next của cây chính), cổng rảnh:

| Bước | Kết quả |
|---|---|
| `npm ci` | OK |
| `npm run typecheck` | 0 lỗi |
| `npm run lint` | 0 lỗi/cảnh báo (cây chính). Ở bản sao sạch lần đầu thoát 1 chỉ vì **tệp thí nghiệm của chính tôi** còn sót trong thư mục tạm (`.next-exp`, `chk.cjs`, `fixtrig.cjs`); đã dọn và chạy lại: 0 lỗi. Nhân dịp này `eslint.config.mjs` ignore `.next*/**` (mọi `NEXT_DIST_DIR`) thay vì chỉ `.next` và `.next-e2e*` |
| `npm test` (Vitest) | **538/538** (M3B.3: 473; +65 gồm màn Admin, thư viện thông báo + công tắc gửi, regression phân trang, cấu hình guard production, registry/sidebar) |
| `npm run e2e:build` | OK, không có địa chỉ mock trong artifact |
| `npm run test:e2e` (Playwright, MOCK) | **274/274**, 17,7 phút (M3B.3: 232) — gồm 24 test màn Admin, 1 test chưa cấu hình của Admin, 17 ảnh visual mới |
| `npm run test:e2e:dev` | 1/1 |
| Reporter chẩn đoán | "đóng băng phát hiện 0s (0 lần), test nghi ngờ 0" cho cả hai lần chạy cuối |

Lần chạy sạch đầu tiên của M3B.4 có **1 test hết giờ** (`navigation.spec.ts:199`) — nguyên nhân là lỗi test do chuyển route (mục 9), đã sửa; lần chạy sau đạt 274/274. Chạy riêng trên cây chính trước đó: 24/24 spec Admin, 5/5 chưa cấu hình.

### So sánh với HSK cũ (Vite :3101 ↔ Next :3100 bản build e2e có bật gửi, Edge headless, mạng chặn, cùng dữ liệu giả: 25 người dùng, 12 chiến dịch, 4 thông báo)

**31/31 ca khớp 0 pixel** (tất cả `maxDelta 0`; DOM, chữ, nội dung gửi đi và không cuộn ngang cũng trùng): danh sách + hai nút (3 khung, kèm cả `.content` có sidebar Admin), form trống (3), form đã điền + 2 người nhận (3), modal chọn người nhận (3 khung), lọc vai trò + tìm kiếm, trang 2 (desktop, mobile), rỗng, "chọn tất cả COLLABORATOR" (kèm toast), xác nhận gửi (3 khung), đang gửi (spinner), lịch sử (3 khung), chi tiết (desktop, mobile), lịch sử trang 2, lịch sử rỗng, toast validation, gửi thành công (toast, form đóng), gửi lỗi (toast, giữ form). Số yêu cầu gửi và thân yêu cầu giữa hai app **giống hệt**.

Những khác biệt phát hiện trong quá trình so sánh và cách xử lý (đều phân loại rõ):
1. **Lỗi migration — đã sửa**: nhãn "N chưa đọc" render hai text node (`{n} chưa đọc`) ⇒ chữ "ư" lệch dưới pixel ở khung mobile khi form mở (24 pixel); đổi thành một text node (như `t("…", {count})` cũ) ⇒ 0 pixel. Sửa cả ở màn Teacher (không đổi hiển thị ở các ca của M3B.3).
2. **Lỗi migration — đã sửa**: thanh phân trang của modal người dùng/lịch sử **biến mất** khi đang tải trang khác (bản cũ giữ `totalPages` trong state) ⇒ mất focus nút "Trang sau" và nhảy bố cục. Đã giữ `totalPages` gần nhất (`lastData`) + regression test.
3. **Nhiễu công cụ (không phải khác biệt của ứng dụng)**: gạch đỏ kiểm tra chính tả của Edge dưới ô nội dung xuất hiện thất thường (165/160 pixel, dải cao 4px) — tắt `spellcheck` của ô nhập trong phép so sánh ⇒ 0 pixel (trước đó đảo qua lại SAME/DIFF giữa các lần chạy).
4. **Phụ thuộc thời gian của fixture (không phải khác biệt của ứng dụng)**: ảnh modal "trang 2" lệch vị trí cuộn khi phản hồi giả lập trả về tức thì trong cùng một khung hình ở bản cũ (không có khung nào vẽ spinner nên `scrollTop` không bị đặt lại). Với cùng độ trễ phản hồi (cổng giữ phản hồi rồi giải phóng sau khi spinner hiện) ⇒ 0 pixel; bản thăm dò riêng cho thấy cùng chuỗi `scrollTop` ở hai app.
- Trạng thái chờ backend / lỗi (khối cảnh báo) và khoá gửi là khác biệt có chủ đích (mục 5) nên không đặt vào phép so ảnh.

Hồi quy ngoài phạm vi (nằm trong 274 test): màn lớp học Admin, Tổng quan giảng viên, Thông báo của tôi (Teacher), sidebar Admin/Giảng viên × 6 tình huống × 3 khung, chuông, toast ticket, placeholder, registry, `css-fidelity` (93 thành phần + 13 hover) — **không ảnh chuẩn nào phải cập nhật**. Ảnh chuẩn mới cho màn Admin: 17 ảnh (`e2e/__screenshots__/win32/admin-notifications-*.png`).

## 11. Giới hạn chưa xác minh

- Mọi dữ liệu và việc **gửi** là MOCK; **không gọi backend thật, không có thao tác ghi thật**; M2 REAL AUTH VERIFICATION vẫn PENDING.
- Hợp đồng 3 endpoint, quyền Admin, chống trùng phía backend, mã lỗi, giới hạn kích thước trang: chưa xác nhận (mục 5.3 của `docs/api-requirements/notifications.md`).
- Trạng thái "cấu hình dịch vụ nhưng công tắc gửi đóng" (kịch bản triển khai thật khi API chưa sẵn sàng) được chứng minh bằng Vitest (stub môi trường + `fetch` không được gọi) và e2e bản chưa cấu hình; **không có bản build e2e thứ ba** cho tổ hợp này.
- Ảnh chuẩn visual chỉ có trên Windows + Chromium + Internet.
- So ảnh với HSK cũ dùng dữ liệu giả giống nhau, không phải dữ liệu thật; trạng thái chờ backend/lỗi/khoá gửi là khác biệt có chủ đích nên không so ảnh.
