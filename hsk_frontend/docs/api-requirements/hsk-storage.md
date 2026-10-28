# Yêu cầu API — Kho lưu trữ đa phương tiện (`/instructor/manage-storage`)

Trạng thái: **UI_PARTIAL (phụ đề karaoke không chuyển) · API MISSING (WAITING FOR BACKEND)**. Hợp đồng dưới đây là **ĐỀ XUẤT**, kế thừa đường dẫn
`/storage/packages|folders|study-sets|videos` của `packageService/folderService/studySetService/videoService` (HSK cũ). Đây là **kho RIÊNG của HSK**
(cây Gói → Thư mục → Bộ học → Video), KHÁC repo-storage của backend chung (chỉ lưu tệp). Frontend gọi qua `hskClient` (`src/lib/api/hsk-storage-client.ts`,
base `NEXT_PUBLIC_HSK_API_BASE_PATH`); byte video đi qua repo-storage (`storage-client.ts`). Mock: `scripts/mock/handlers/hsk-storage.mjs` + `storage.mjs`.

## 1. Đối chiếu backend chung (LMS_IELTS/backend)

| Nguồn | Có gì | Kết luận |
|---|---|---|
| repo-storage (Go) | presign/upload/confirm/tải tệp; **không có listing, không có cây gói/thư mục/bộ học, không xử lý video (HLS/thumbnail)** | dùng cho byte video; phần cây và metadata video => MISSING |

## 2. Quyền (đúng quy tắc `use-ticket-access` của HSK cũ, `src/lib/tickets/ticket-access.ts`)

| Thao tác | Ai | Frontend | Backend phải enforce |
|---|---|---|---|
| Xem cây + video | ADMIN, TEACHER, MENTOR (HSK cũ còn TEACHER_MANAGER, COLLABORATOR) | route registry | 401/403 |
| Thêm/Sửa/Xoá gói, thư mục, bộ học; tải/xoá video | ADMIN (và TEACHER_MANAGER) luôn; TEACHER/MENTOR chỉ khi có **ticket module `STORAGE` trạng thái OPEN/DONE giao cho chính mình** | `useContentAccess("STORAGE").canManage` && công tắc `NEXT_PUBLIC_WRITE_STORAGE`; không có quyền => Alert "Chế độ Xem duy nhất", ẩn nút ghi; dịch vụ ticket chưa cấu hình/lỗi => coi là không có quyền (fail-closed) | kiểm tra ticket phía máy chủ; 403 |
| Publish/Unpublish gói | chỉ ADMIN (TEACHER_MANAGER) | `canPublish` | 403 |

Mock mô phỏng đúng: giảng viên demo không có ticket STORAGE => 403 khi ghi (giao diện chỉ xem).

## 3. Endpoint (gốc `NEXT_PUBLIC_HSK_API_BASE_PATH`)

| # | Method + đường dẫn | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `GET /storage/packages?type=VIDEO_COURSE` | Mức 1 "Kho lưu trữ Media" | `StoragePackage[]`; màn chỉ tải `VIDEO_COURSE` như bản cũ |
| 2 | `POST /storage/packages` `{name, description?, type}` / `PUT /storage/packages/{id}` / `DELETE /storage/packages/{id}` | Tạo/Sửa/Xoá gói | DELETE **xoá kéo theo** thư mục, bộ học, video bên trong (giao diện cảnh báo) |
| 3 | `POST /storage/packages/{id}/publish` · `/unpublish` | Menu Publish / Unpublish (về Draft) | trả gói với `publishStatus` |
| 4 | `GET /storage/folders?packageId=` | Mức 2 | 400 thiếu `packageId` |
| 5 | `POST /storage/folders` `{name, packageId, description?, isPrivate}` / `PUT /storage/folders/{id}` `{name, description?, isPrivate?}` / `DELETE` | Tạo/Sửa/Xoá thư mục | DELETE kéo theo bộ học + video |
| 6 | `GET /storage/study-sets?folderId=` | Mức 3 "Nhóm tài nguyên" | `videoCount?` để hiển thị |
| 7 | `POST /storage/study-sets` `{title, folderId, description?, isPrivate}` / `PUT /storage/study-sets/{id}` `{title, description?, isPrivate?}` / `DELETE` | Tạo/Sửa/Xoá bộ học | bản cũ tạo bằng `title` nhưng đọc về `name` — đề nghị chốt một tên |
| 8 | `GET /storage/videos?studySetId=` | Mức 4 "Kho Video Media"; **hỏi lại mỗi 5 giây tối đa 3 phút** sau khi tải lên cho tới khi hết video PENDING/PROCESSING | `StorageVideo[]` |
| 9 | `POST /storage/videos` `{studySetId, fileId, title, description?}` | **Hợp đồng đề xuất mới**: đăng ký video từ `fileId` đã tải lên repo-storage | thay `POST /storage/upload` multipart của bản cũ; trả video `status: PROCESSING` (kho tự mã hoá/HLS/thumbnail) ; 400 `fileId` không tồn tại |
| 10 | `DELETE /storage/videos/{id}` | Xoá video (soft delete như bản cũ) | |
| 11 | `GET /storage/videos/{id}/details` | Modal chi tiết video | `StorageVideoDetails` (+ `subtitles[]` chỉ để hiển thị số lượng) |

```ts
StoragePackage { id; name; description?; type; publishStatus?: "DRAFT"|"PUBLISHED"; createdAt; updatedAt }
StorageFolder { id; name; description?; packageId; isPrivate; createdAt; updatedAt }
StorageStudySet { id; name; description?; folderId; isPrivate; videoCount?; createdAt; updatedAt }
StorageVideo { id; code; name; description?; fileId?; size?; mimetype?; duration?; status: "PENDING"|"PROCESSING"|"COMPLETED"|"FAILED";
               studySetId; thumbnailUrl?; createdAt; updatedAt }
```

## 4. Phát video và phụ đề — KHÔNG chuyển / khác bản cũ

- Bản cũ phát HLS `/api/storage/videos/{code}/playlist` bằng `hls.js` + phụ đề karaoke (`/storage/subtitles/video/{code}/karaoke/excel`,
  `/storage/subtitles/{id}/activate`, `/storage/subtitles/template/karaoke`, `/storage/subtitles/video/{id}/active`). App mới **không thêm thư viện** và
  **không chuyển phụ đề**: modal chi tiết phát **tệp gốc** từ repo-storage bằng `<video src="{STORAGE}/file/{fileId}">` khi có `fileId` và dịch vụ đã
  cấu hình; ngược lại hiện ghi chú "chưa có nguồn phát". Cần quyết định: backend trả `playbackUrl` (HLS) trong `StorageVideo` để frontend dùng
  `<video>` native/HLS sau; phụ đề cần hợp đồng và gói việc riêng.
- Ảnh thu nhỏ: `thumbnailUrl` tuyệt đối hoặc tương đối; rỗng => ảnh dự phòng `/assets/hocba/hocbadentrang.png` (bản cũ dùng LOGOHBMascot.png 5MB — không sao chép).

## 5. Tải video (repo-storage, backend chung)

`uploadFile(file, onProgress)`: presign → PUT (tiến độ hiển thị trong modal) → confirm → `fileId` → endpoint #9. Kiểm tra phía client như bản cũ:
`video/*`, tối đa 1GB. Chưa cấu hình `NEXT_PUBLIC_STORAGE_API_BASE_PATH` => modal báo "Kho lưu trữ chưa được cấu hình", ô tệp khoá.
Khác bản cũ có chủ đích: bản cũ đóng modal ngay và tải "fire and forget" (toast); app mới giữ modal với tiến độ và chỉ đóng khi video đã được đăng ký.

Điểm cần backend xác nhận: (a) giới hạn kích thước presign cho video lớn (1GB) và thời hạn `expiresIn`; (b) kho HSK nhận `fileId` repo-storage và tự
lấy byte để xử lý, hay cần URL/`presignedUrl` đọc; (c) thời gian xử lý điển hình (frontend hỏi lại 5 giây/3 phút như bản cũ); (d) `code` video sinh
ở đâu; (e) xoá gói/thư mục có xoá byte ở repo-storage không.

## 6. Hành vi giao diện (đã kiểm thử với mock)

| Tình huống | Frontend |
|---|---|
| `NEXT_PUBLIC_HSK_API_BASE_PATH` trống | WAITING FOR BACKEND ở mức đang xem; không toast |
| Không có quyền theo ticket | Alert "Chế độ Xem duy nhất"; không nút Tạo/menu Sửa-Xoá/Tải lên/Xoá video; vẫn xem được |
| Có quyền nhưng công tắc `NEXT_PUBLIC_WRITE_STORAGE` ≠ `enabled` | Nút ghi hiện nhưng **khoá** + WriteLockedNotice; client chặn request ghi |
| Lỗi tải | FetchStateNotice có "Thử lại" (bản cũ: console.error + danh sách rỗng) |
| Xoá mục đang đứng trong | Quay về mức cha, tải lại danh sách cha |
