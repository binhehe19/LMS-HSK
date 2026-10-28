# Yêu cầu API — Quản lý tài liệu học tập (`/learning-path/lesson-materials/manage`)

Trạng thái: **UI_COMPLETE · API PARTIAL (WAITING FOR BACKEND)**. Hợp đồng dưới đây là **ĐỀ XUẤT**, kế thừa đường dẫn `/lesson-materials/*` của
`LMS_Frontend/src/core/services/lesson-materials.service.ts` (HSK cũ). Frontend gọi qua `hskClient` (`src/lib/api/lesson-materials-client.ts`, base
`NEXT_PUBLIC_HSK_API_BASE_PATH`); **byte tệp đi qua repo-storage của backend chung** (`src/lib/api/storage-client.ts`, base `NEXT_PUBLIC_STORAGE_API_BASE_PATH`).
Mock: `scripts/mock/handlers/lesson-materials.mjs` + `scripts/mock/handlers/storage.mjs`.

## 1. Đối chiếu backend chung (LMS_IELTS/backend)

| Nguồn | Có gì | Kết luận |
|---|---|---|
| repo-storage (Go) | `POST /file/presign` → `PUT presignedUrl` → `POST /file/{id}/confirm`; `GET /file/{id}?disposition=` | **DÙNG THẬT** cho tải/mở tệp (thay `POST /storage/upload` multipart của HSK cũ). Frontend chỉ gửi `fileId` cho dịch vụ tài liệu |
| repo-lms content-packages MATERIAL/SLIDE | gói nội dung | **gần nhưng chưa map**: không có "bộ tài liệu" (group), trạng thái DRAFT/PUBLISHED/ARCHIVED, phân loại LESSON/COURSE, loại SLIDE/GRAMMAR/GRAMMAR_3_0/TEXTBOOK => PARTIAL, giữ hợp đồng đề xuất |

## 2. Quyền

HSK cũ: PrivateRoute ADMIN, TEACHER_MANAGER; dịch vụ "manager-only". App mới: **chỉ `ROLE_ADMIN`** (Teacher-manager chưa được phục vụ). 401/403 do backend
enforce; mock trả đúng.

## 3. Endpoint (gốc `NEXT_PUBLIC_HSK_API_BASE_PATH`, bọc `{success, data}` hoặc JSON trần đều đọc được)

### 3.1 Bộ tài liệu (group)

| # | Method + đường dẫn | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `GET /lesson-materials/groups?status=ACTIVE\|ARCHIVED&search=` | Cột trái (danh sách bộ, có tìm kiếm) | tham số rỗng không gửi; `data` là **mảng** `LessonMaterialGroup[]` |
| 2 | `POST /lesson-materials/groups` `{name, description?}` | Thêm bộ; "+ Tạo bộ mới" trong form thêm tài liệu | 400 thiếu tên; **409** + `errorCode: LESSON_MATERIAL_GROUP_DUPLICATE_NAME` khi trùng tên (frontend còn kiểm trùng phía client không phân biệt hoa thường) |
| 3 | `PATCH /lesson-materials/groups/{id}` `{name?, description?, status?, displayOrder?}` | Sửa bộ; **khôi phục** (`status: "ACTIVE"`) | 404; 409 trùng tên |
| 4 | `DELETE /lesson-materials/groups/{id}` | "Lưu trữ" bộ | **không xoá**: `status → ARCHIVED`, trả bộ đã cập nhật (như bản cũ `archiveGroup`) |
| 5 | `GET /lesson-materials/groups/{id}/materials` | Cột phải khi chọn bộ | `{ group, materialsByType: Partial<Record<Type, LessonMaterial[]>> }` |

### 3.2 Tài liệu (material)

| # | Method + đường dẫn | Dùng cho | Ghi chú |
|---|---|---|---|
| 6 | `GET /lesson-materials/materials?keyword&category&type&status&groupId&page=0&size=200&sort=createdAt,desc` | Đếm Slides/Ngữ pháp trên card bộ và ngăn "Chưa phân loại" (một lần `size=200` như bản cũ) | Spring Page `{content, totalElements, totalPages, size, number}` |
| 7 | `POST /lesson-materials/materials` `{title, description?, category, type, fileId, groupId?}` | "Thêm tài liệu" sau khi `uploadFile` xong | tạo ở `DRAFT`; backend lấy `filename/mimeType/sizeBytes` từ `fileId` (repo-storage); 400 `fileId` không tồn tại / loại không khớp danh mục (TEXTBOOK ⇔ COURSE); 404 bộ không có; 409 bộ đã lưu trữ |
| 8 | `POST /lesson-materials/materials/bulk` `{items: CreateLessonMaterialRequest[]}` | "Thêm nhiều tài liệu" (tối đa 20; frontend tải tệp **tuần tự** rồi gọi một lần cho các tệp thành công) | `{created, errors: {index, title, errorCode, message}[] \| null, totalRequested, totalCreated, totalFailed}`; lỗi tải tệp phía frontend được ghép thêm với `errorCode: UPLOAD_FAILED` |
| 9 | `PATCH /lesson-materials/materials/{id}/status` `{status}` | Xuất bản / Chuyển về nháp / Lưu trữ / Khôi phục nháp | chuyển hợp lệ: DRAFT→PUBLISHED\|ARCHIVED, PUBLISHED→DRAFT\|ARCHIVED, ARCHIVED→DRAFT; sai => **409** + `LESSON_MATERIAL_INVALID_STATUS_TRANSITION` (frontend toast riêng và tải lại) |

```ts
LessonMaterialGroup { id; name; description?; displayOrder?; status: "ACTIVE"|"ARCHIVED"; slideCount?; grammarCount?; createdAt?; updatedAt? }
LessonMaterial { id; title; description?; type: "SLIDE"|"GRAMMAR"|"GRAMMAR_3_0"|"TEXTBOOK"; category: "LESSON"|"COURSE";
                 status: "DRAFT"|"PUBLISHED"|"ARCHIVED"; groupId?; fileId; filename?; mimeType?; sizeBytes?; createdAt?; updatedAt? }
```

Không chuyển (màn quản lý cũ không có giao diện): gắn tài liệu vào buổi/khoá (`/attachments`, `/course-attachments`, `/schedules/{id}/materials`,
`/courses/{id}/*`). Cần hợp đồng riêng khi có màn tương ứng.

## 4. Tải tệp (repo-storage, backend chung — AVAILABLE, chưa xác minh môi trường thật)

Luồng `uploadFile` của `storage-client.ts`: `POST {STORAGE}/file/presign {filename, mimeType, sizeBytes}` → `PUT presignedUrl` (byte thô, không
Authorization) → `POST {STORAGE}/file/{id}/confirm` → `FileMeta {fileId, filename, mimeType, sizeBytes}`. Cột "Tệp" mở `GET {STORAGE}/file/{id}?disposition=inline`.
Chưa cấu hình `NEXT_PUBLIC_STORAGE_API_BASE_PATH` => modal báo "Kho lưu trữ chưa được cấu hình", ô tệp và nút Thêm bị khoá (không gọi mạng).

Điểm cần backend xác nhận: (a) dịch vụ tài liệu tra được metadata tệp từ `fileId` của repo-storage (hay frontend phải gửi kèm `filename/mimeType/sizeBytes`
từ `confirm`?); (b) `GET /file/{id}` có yêu cầu đăng nhập không — cột "Tệp" dùng `<a href>` (cookie cùng origin); (c) giới hạn kích thước/loại tệp (frontend
chỉ lọc `.pdf,.ppt,.pptx,.jpg,.jpeg,.png,.webp` như bản cũ); (d) ai có quyền xem tệp của tài liệu ARCHIVED.

## 5. Hành vi giao diện (đã kiểm thử với mock)

| Tình huống | Frontend |
|---|---|
| `NEXT_PUBLIC_HSK_API_BASE_PATH` trống | Khối WAITING FOR BACKEND thay hai cột; không toast |
| Công tắc `NEXT_PUBLIC_WRITE_LESSON_MATERIALS` ≠ `enabled` (không demo) | Thêm bộ/Thêm tài liệu/Thêm nhiều/Sửa/Lưu trữ/đổi trạng thái bị khoá + WriteLockedNotice; client chặn mọi request ghi |
| Trùng tên bộ (client) | Toast "Tên bộ tài liệu đã tồn tại…" (bộ lưu trữ: "…trong mục lưu trữ. Vui lòng khôi phục bộ đó…"), không gọi API |
| Tạo tài liệu lỗi sau khi tải tệp xong | Toast lỗi; lần bấm sau **tải lại tệp** (bản cũ giữ "mã tệp đã tải lên" — không chuyển) |
| Sau mọi ghi thành công | Tải lại danh sách bộ + tài liệu + bộ đang xem từ máy chủ |
