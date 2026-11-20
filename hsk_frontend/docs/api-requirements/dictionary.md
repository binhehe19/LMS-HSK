# Yêu cầu API — màn `/vocabulary/manage` (Từ điển — quản lý từ vựng tiếng Trung) (W2-B, M5)

Trạng thái: **UI_PARTIAL · API MISSING (hợp đồng ĐỀ XUẤT)**. Backend chung `LMS_IELTS/backend` không có từ điển Hán ngữ (`/learning-resources/dictionary/*`
của IELTS chỉ đọc, DTO VOCABULARY không có hanzi/pinyin/bộ thủ). Hợp đồng dưới đây **giữ nguyên đường dẫn và DTO của dịch vụ từ điển HSK cũ**
(`LMS_Frontend/src/core/services/vocabulary.service.ts`, `core/types/vocabulary.type.ts` — "matches backend DTOs exactly" của LMS_Backend dictionary)
để người phụ trách backend đối chiếu; frontend chỉ kiểm thử với mock cách ly `scripts/mock/handlers/dictionary.mjs`. Màn này KHÔNG theo cây
Package → Folder → Study set (khác các module content-tree.md): tìm kiếm + phân trang phía máy chủ.

## 1. Cấu hình phía frontend

| Biến | Ý nghĩa | Trống thì |
|---|---|---|
| `NEXT_PUBLIC_HSK_API_BASE_PATH` | Gốc dịch vụ HSK (`lib/api/hsk-client.ts`); tiền tố `/dictionary/vocabularies` nối sau | Màn hiện "WAITING FOR BACKEND", không gọi mạng |
| `NEXT_PUBLIC_WRITE_CONTENT` | Công tắc an toàn cho THAO TÁC GHI (tạo/sửa/xoá). Mặc định MỞ (đã nối repo-lms); chỉ `disabled` mới đóng | Nút ghi ẩn + `WriteLockedNotice`; client tự chặn (`assertWriteEnabled("content")`): **không request ghi nào được tạo** |
| `NEXT_PUBLIC_TICKET_API_BASE_PATH` | Ticket phân công: quyền Thêm/Sửa/Xoá của giảng viên (`useContentAccess("DICTIONARY")`) | Giảng viên = chỉ xem (fail-closed); Admin không ảnh hưởng |

Quyền giao diện (quy tắc HSK cũ `useTicketAccess(TicketModule.DICTIONARY)`): Admin/Teacher-manager luôn ghi; Teacher/Mentor cần ticket DICTIONARY OPEN/DONE
được giao cho mình. **Backend phải kiểm tra lại quyền ở mọi API.** Bọc `{success, data}` hoặc JSON trần đều đọc được (api-client bóc envelope).

## 2. Endpoint (gốc = `NEXT_PUBLIC_HSK_API_BASE_PATH`, tiền tố `/dictionary/vocabularies`)

| # | Method + đường dẫn | Dùng cho | Request | Response 200 (`data`) |
|---|---|---|---|---|
| 1 | `GET /dictionary/vocabularies/search?keySearch=&page=0&size=10[&hskLevel=][&isSingleVocab=][&wordType=][&radical=]` | Bảng + bộ lọc + phân trang (bộ lọc nằm trong URL màn: `?keySearch=&hskLevel=&isSingleVocab=&wordType=&radical=&page=` với `page` 1-based, gửi lên trừ 1) | `keySearch` luôn gửi (rỗng = tất cả, như bản cũ); các tham số khác chỉ gửi khi có | `VocabularyPage` (page từ 0) — `items` **phải là mảng** (khác = lỗi hợp đồng, hiện lỗi) |
| 2 | `GET /dictionary/vocabularies/{id}` | Mở form **Sửa** (bản cũ gọi `getById` trước khi mở vì danh sách là bản rút gọn) | — | `Vocabulary` đầy đủ `pinyins[].meanings[]` |
| 3 | `POST /dictionary/vocabularies` | "Thêm từ mới" → Tạo mới | `VocabularyInput` | `Vocabulary` |
| 4 | `PUT /dictionary/vocabularies/{id}` | Lưu thay đổi (thay toàn bộ, kể cả `pinyins`) | `VocabularyInput` | `Vocabulary` |
| 5 | `DELETE /dictionary/vocabularies/{id}` | Xoá (sau `confirmAction`) | — | 200/204 |

```ts
interface VocabularyExample { zh?: string; pinyin?: string; vi?: string; en?: string }   // một câu ví dụ; ô trống không gửi
interface VocabularyMeaning { id?: number; meaning: string; exampleWordType? /* loại từ của nghĩa */; examples?: VocabularyExample[] /* một nghĩa có nhiều ví dụ */; definitionCn? }
interface VocabularyPinyin  { id?: number; pinyin: string; audioUrl?: string; sinoVietnamese?; wordTypes?: string /* "Động từ,Danh từ" */; isPrimary?: boolean; measureWord?: string /* "个 [gè], 本 [běn]" */;
                              compounds?: string /* JSON [{hanzi, sinoVietnamese?}] */; synonyms?: string /* JSON [{hanzi, pinyin?}] */; antonyms?: string /* JSON */; notes?; meanings: VocabularyMeaning[] }
interface Vocabulary        { id: number; hanzi: string; hskLevel?: number; imageUrl?; etymologyStory?; radical?;
                              isSingleVocab: boolean; notes?; status?: "draft"|"published"; pinyins?: VocabularyPinyin[]; createdAt?; updatedAt? }
type  VocabularyInput     = Omit<Vocabulary, "id"|"createdAt"|"updatedAt"> & { pinyins: VocabularyPinyin[] }   // CreateVocabularyRequest = UpdateVocabularyRequest của bản cũ
interface VocabularyPage    { items: Vocabulary[]; totalElements: number; totalPages: number; page: number; size: number }
```

Frontend kiểm tra trước khi gửi (thông điệp của bản cũ): Hán tự bắt buộc; ≥ 1 pinyin, mỗi pinyin có phiên âm, **đúng một** pinyin `isPrimary`; mỗi pinyin ≥ 1 nghĩa không rỗng;
Số nét và thứ tự nét không lưu trong từ vựng (lấy từ dữ liệu Hanzi Writer lúc hiển thị). Trường rỗng **không gửi** (bị cắt khỏi JSON); `compounds/synonyms/antonyms` không gửi khi danh sách rỗng.

### Mã lỗi mong đợi

401 chưa đăng nhập (frontend refresh phiên một lần rồi thử lại); 403 không có quyền (ticket/role — "Bạn không có quyền thực hiện thao tác này."); 404 không có;
400 body thiếu trường bắt buộc; 409 trùng Hán tự (frontend hiện `errorMessage` của máy chủ). Thông điệp trong `errorMessage`/`message` (văn bản ngắn, không HTML).

## 3. Điểm cần backend xác nhận

1. Tên tham số lọc: frontend dùng đúng tên của `vocabulary.service.ts` cũ (`hskLevel`, `isSingleVocab`, `wordType`, `radical`); nếu backend dùng tên khác (vd `hsk`), đổi ở `lib/dictionary/vocabulary-model.ts#buildSearchQuery`.
2. `radical`: bản cũ chuyển ký tự bộ thủ → định dạng DB `"NHẤT 一"` qua bảng RADICAL_MAP (214 bộ); frontend mới gửi **ký tự người dùng nhập** — backend nên so khớp theo ký tự bộ thủ hoặc trả về định dạng mong đợi.
3. `keySearch` tìm trên trường nào (Hán tự, pinyin có/không dấu, Hán Việt, nghĩa)? Mock: tất cả, không phân biệt hoa/thường.
4. `PUT` thay toàn bộ `pinyins` (xoá pinyin/nghĩa không gửi) hay merge theo `id`? Frontend gửi toàn bộ danh sách hiện có trên form.
5. Có ràng buộc trùng `hanzi` không (mock: 409)? Từ đa âm được mô tả bằng nhiều `pinyins` trong một bản ghi.
6. `status` dùng `draft/published` (chữ thường như form cũ) — backend có enum khác không?

## 4. Chưa chuyển ở M5 (ghi rõ, không làm giả)

| Tính năng bản cũ | Trạng thái | Ghi chú |
|---|---|---|
| Import Excel bất đồng bộ (`POST /import` → jobId, `GET /import/status/{jobId}`; `import-vocabulary-modal.tsx`) | **Chưa chuyển** | Nút "Import từ Excel" hiện toast; mock trả 501 |
| "Tải Template" (link Google Sheets cố định) | Bỏ | Tài sản ngoài repo, đi kèm import |
| `RadicalFilterPanel` (bảng chọn 214 bộ thủ theo số nét) | Rút gọn | Ô nhập bộ thủ |
| Tải ảnh/ảnh động/ảnh chiết tự lên (MediaUploadService → URL) | Chưa chuyển | Form nhận URL; có thể nối `lib/api/storage-client.ts` khi backend chốt nơi lưu |
| `GET /suggestions`, `PATCH /{id}/sync-etymology`, `DELETE /all` | Không dùng ở màn quản lý | — |

## 5. Hành vi giao diện khi API chưa sẵn sàng (đã kiểm thử với mock)

| Tình huống | Frontend |
|---|---|
| `NEXT_PUBLIC_HSK_API_BASE_PATH` trống | Khối "WAITING FOR BACKEND" thay bảng; không gọi mạng, không toast |
| API lỗi (mạng/5xx/403) | Khối lỗi với thông điệp + "Thử lại" (bản cũ: alert đỏ + Thử lại) |
| Công tắc ghi đóng | Nút Thêm/Sửa/Xoá ẩn; `WriteLockedNotice`; client chặn |
| Giảng viên không có ticket DICTIONARY (hoặc ticket service lỗi/chưa cấu hình) | Alert "Chế độ Xem duy nhất"; chỉ xem |
| Trang > tổng trang | Danh sách rỗng "Không tìm thấy từ vựng nào" (frontend không tự sửa URL) |
| Thao tác ghi thành công | Toast như bản cũ ("Thêm mới thành công!", "Cập nhật thành công!", "Xóa từ vựng thành công") rồi tải lại trang hiện tại từ máy chủ; tạo mới khi đang ở trang > 1 => về trang 1 |
