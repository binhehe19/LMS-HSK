# Yêu cầu API — Kho nội dung HSK dạng cây (Package → Folder → Study set → mục) — nền dùng chung + module Thẻ ghi nhớ / Từ vựng (W2-T, M5)

Trạng thái: **UI_PARTIAL · API MISSING (hợp đồng ĐỀ XUẤT)**. Backend chung `LMS_IELTS/backend` không có kho nội dung HSK (hanzi/pinyin/thẻ). Mọi
đường dẫn dưới đây RÚT GỌN từ 5 service của HSK cũ (`core/services/flashcard.service.ts`, `hanzi.service.ts`, `quiz.service.ts`, `grammar.service.ts`,
`pronunciation.service.ts`) để **một client generic** (`src/lib/api/content-tree-client.ts`) dùng được cho mọi module; người phụ trách backend quyết định
đường dẫn cuối. Frontend chỉ kiểm thử với mock cách ly (`scripts/mock/handlers/content-tree.mjs`).

## 1. Cấu hình phía frontend

| Biến | Ý nghĩa | Trống thì |
|---|---|---|
| `NEXT_PUBLIC_HSK_API_BASE_PATH` | Gốc các dịch vụ HSK (hsk-client); tiền tố module nối sau: `/flashcard`, `/writing`, `/quiz`, `/grammar`, `/pronunciation` | Màn hiện "WAITING FOR BACKEND", không gọi mạng |
| `NEXT_PUBLIC_WRITE_CONTENT` | Công tắc an toàn cho THAO TÁC GHI (tạo/sửa/xoá/publish). Chỉ `enabled` mới mở; chế độ demo mở sẵn | Nút ghi ẩn + `WriteLockedNotice`; client tự chặn (`assertWriteEnabled("content")`): **không request ghi nào được tạo** |
| `NEXT_PUBLIC_STORAGE_API_BASE_PATH` | repo-storage (ảnh/âm thanh của thẻ: presign → PUT → confirm, `lib/api/storage-client.ts`) | Ô tải tệp khoá, báo "Kho lưu trữ chưa được cấu hình"; vẫn lưu được thẻ không kèm tệp |
| `NEXT_PUBLIC_TICKET_API_BASE_PATH` | Ticket phân công: quyền Thêm/Sửa/Xoá của giảng viên (`useContentAccess`) | Giảng viên = chỉ xem (fail-closed); Admin không ảnh hưởng |

Quyền giao diện (quy tắc HSK cũ, `lib/tickets/ticket-access.ts`): Admin/Teacher-manager luôn Thêm/Sửa/Xoá + Publish/Unpublish; Teacher/Mentor cần ticket
OPEN/DONE đúng module (FLASHCARD cho cả Thẻ ghi nhớ và Bộ từ vựng) và KHÔNG publish. **Backend phải kiểm tra lại quyền ở mọi API** (frontend chỉ là rào giao diện).

## 2. Hợp đồng generic (áp dụng cho mọi `{prefix}`)

Bọc `{success, data}` hoặc JSON trần đều đọc được (api-client bóc envelope). Thời gian ISO-8601. Mọi id là chuỗi (`[A-Za-z0-9_.:-]`, ≤128).

### 2.1 Gói (package)

| # | Method + đường dẫn | Dùng cho | Body / Phản hồi |
|---|---|---|---|
| 1 | `GET {prefix}/packages` | Cấp gói (tab theo loại + tìm phía client) | `ContentPackage[]` |
| 2 | `GET {prefix}/packages/{id}` | (dự phòng) | `ContentPackage` |
| 3 | `POST {prefix}/packages` | Tạo gói | `{name, type, description?}` → `ContentPackage` (publishStatus mặc định `DRAFT`) |
| 4 | `PUT {prefix}/packages/{id}` | Sửa gói (loại không đổi được trên UI nhưng vẫn gửi) | `{name, type, description?}` → `ContentPackage` |
| 5 | `DELETE {prefix}/packages/{id}` | Xoá gói **kèm toàn bộ thư mục/bộ/mục bên trong** (hộp xác nhận nói rõ) | 200/204 |
| 6 | `POST {prefix}/packages/{id}/publish` · `POST {prefix}/packages/{id}/unpublish` | Chỉ Admin/Teacher-manager | → `ContentPackage`; 409 nếu đã ở trạng thái đích |

```ts
ContentPackage { id; name; description?; type: string /* FREE | LEARNING_PATH | LEARNING | VIDEO_COURSE (flashcard) */; publishStatus?: "DRAFT"|"PUBLISHED"; folderCount?; createdAt?; updatedAt? }
```

### 2.2 Thư mục (folder) — khác HSK cũ: gắn gói ngay khi tạo (`packageId` trong body) thay cho 2 bước "POST /folders" rồi "POST /packages/{id}/folders/{folderId}"

| # | Method + đường dẫn | Body / Phản hồi |
|---|---|---|
| 7 | `GET {prefix}/folders?packageId=` (bắt buộc) | `ContentFolder[]` (HSK cũ: `GET /folders/package/{packageId}` hoặc `GET /packages/{id}` trả kèm `folders`) |
| 8 | `GET {prefix}/folders/{id}` | `ContentFolder` (trang sửa bộ dùng để hiện tên thư mục) |
| 9 | `POST {prefix}/folders` | `{packageId, name, description?, isPrivate?}` → `ContentFolder` |
| 10 | `PUT {prefix}/folders/{id}` | `{packageId, name, description?, isPrivate?}` → `ContentFolder` |
| 11 | `DELETE {prefix}/folders/{id}` | Xoá kèm bộ/mục bên trong |

```ts
ContentFolder { id; packageId; name; description?; isPrivate?; studySetCount?; createdAt?; updatedAt? }
```

### 2.3 Bộ (study set) — khác HSK cũ: `folderId` trong body thay cho "POST /folders/{folderId}/study-sets/{studySetId}"

| # | Method + đường dẫn | Body / Phản hồi |
|---|---|---|
| 12 | `GET {prefix}/study-sets?folderId=` (bắt buộc) | `ContentStudySet[]` (HSK cũ: `GET /study-sets/folder/{folderId}`) |
| 13 | `GET {prefix}/study-sets/{id}` | `ContentStudySet` (trang `/sets/:id/edit`) |
| 14 | `POST {prefix}/study-sets` | `{folderId, title, description?, isPrivate?, skill?}` → `ContentStudySet` |
| 15 | `PUT {prefix}/study-sets/{id}` | cùng body → `ContentStudySet` |
| 16 | `DELETE {prefix}/study-sets/{id}` | Xoá kèm mục |

```ts
ContentStudySet { id; folderId; title; description?; isPrivate?; skill?: string /* chỉ module hasSkill (quiz) */; itemCount?; createdAt?; updatedAt? }
```

### 2.4 Mục nội dung (`{itemsPath}` theo module, xem mục 3)

| # | Method + đường dẫn | Body / Phản hồi |
|---|---|---|
| 17 | `GET {prefix}/{itemsPath}?studySetId=` (bắt buộc) | `TItem[]` theo `index` tăng dần (HSK cũ: `GET /cards/study-set?studySetId=`) |
| 18 | `POST {prefix}/{itemsPath}` | `{studySetId, index?, ...trường riêng}` → `TItem` |
| 19 | `POST {prefix}/{itemsPath}/bulk` | `{studySetId, items: Input[]}` → `TItem[]` (thứ tự = thứ tự mảng; HSK cũ: `/cards/bulk` với khoá `cards`) |
| 20 | `PUT {prefix}/{itemsPath}/{id}` | `{index?, ...trường riêng}` → `TItem` (thay toàn bộ trường nội dung) |
| 21 | `DELETE {prefix}/{itemsPath}/{id}` | 200/204 |
| 22 | `GET {prefix}/{itemsPath}/search?q=&page=0&size=20` | Tìm toàn cây (tab "Quản lý từ vựng"): `ContentPage<TItem & {studySetTitle, folderId, folderName, packageId, packageName, packageType}>`, sắp theo gói › thư mục › bộ › index (HSK cũ: `/cards/search`) |

```ts
ContentItemBase { id; studySetId; index?; createdAt?; updatedAt? }      // module thêm trường riêng
ContentPage<T> { items: T[]; totalElements; totalPages; page /* từ 0 */; size }
```

### 2.5 Mã lỗi mong đợi

401 chưa đăng nhập (frontend refresh phiên một lần rồi thử lại); 403 không có quyền (ticket/role — hiển thị "Bạn không có quyền thực hiện thao tác này.");
404 không có; 400 body thiếu trường bắt buộc; 409 publish/unpublish trùng trạng thái. Thông điệp lỗi trong `errorMessage`/`message` (văn bản ngắn, không HTML).

## 3. Bảng module (một nền, cấu hình theo module)

| Module (`ContentModule` ticket) | `{prefix}` | `{itemsPath}` | Trường riêng của mục (đề xuất) | Ghi chú |
|---|---|---|---|---|
| FLASHCARD — Thẻ ghi nhớ (`/flashcard/*`) và Bộ từ vựng (`/vocab-set/manage`) | `/flashcard` | `cards` | `term*, pinyin?, wordType?, meaning*, example?, exampleMeaning?, imageFileId?, audioFileId?` | **W2-T (gói này)**. Hai màn dùng CÙNG dữ liệu như HSK cũ (manage-vocabulary-set là bản sao đổi chữ). Có `/cards/search` |
| WRITING — Hán tự (`/hanzi/*`) | `/writing` | `words` | `hanzi*, pinyin*, meaning*, strokeCount? (int 1–64), radical?, sinoVn?, example?, exampleMeaning?` | **W2-E**. UI bắt buộc chữ Hán + pinyin + nghĩa (quy tắc "ký tự đủ thông tin" của create-set-page cũ; mock chỉ đòi `hanzi` — backend quyết định). Đối chiếu cũ: `word→hanzi`, `wordIndex/cardIndex→index`; bỏ `characters, imageWord, imageOrigin, audio, examplePinyin, hskLevel, wordType, status`. Bản cũ còn `GET /writing/packages/types` (UI mới dùng 4 loại cố định), `PATCH /folders/{id}/privacy`, `/study-sets/{id}/progress`, `/words/{id}/status`, subjects/slots — không dùng ở màn quản lý |
| QUIZ — Bài tập (`/quiz/*`) | `/quiz` | `quizzes` | `title*, description?, instruction?, skill?, difficulty?, durationMinutes?, passingScore?, shuffleQuestions?, audioFileId?, passageText?, passageImageFileId?, questionCount (server tính)`; bộ có `skill` (PRACTICE/LISTENING/READING/WRITING/SPEAKING/PHONETICS/TRANSLATION/GRAMMAR_3_0) | **W2-B**. Câu hỏi (cấp 5, `src/lib/api/quiz-question-client.ts`): `GET {prefix}/quizzes/{id}`, `GET|POST {prefix}/questions/{quizId}`, `PUT|DELETE {prefix}/questions/{id}`; body theo `type`: MULTIPLE_CHOICE `options[{text,isCorrect}]` (1 đúng) · TRUE_FALSE `correctAnswer` · FILL_IN_BLANK `fillBlankMode (TYPE|SELECT) + blanks[{index,answer,acceptable[]}] + choices?` · MATCHING_PAIRS `pairs[{left,right}]` · SHORT_ANSWER/AUDIO_RESPONSE `gradingMode + referenceAnswer?` (chấm tay); media `imageFileId?/audioFileId?` (repo-storage). Kiểu: `src/types/content-quiz.ts`. Chưa chuyển: SENTENCE_BUILDER, chấm AI (`aiGradingSubtype/hskLevel`), import Excel |
| GRAMMAR — Ngữ pháp | `/grammar` | `grammar-points` | `title*, category?, generalDefinition?, structure?, explanation?, note?, exampleSentenceZh?, exampleSentencePinyin?, exampleSentenceVi?, hskLevel?: "1".."9", linkedQuizStudySetId?` (tên trường DTO backend ngữ pháp cũ; mock seed theo đó) | **W2-B**. Bản cũ bỏ cấp thư mục (tự tạo ngầm thư mục trùng tên gói) — nền mới đủ 4 cấp. Chưa chuyển: import Excel `/grammar/grammar-points/import` |
| PRONUNCIATION — Phát âm | `/pronunciation` | `pronunciation-items` | `text*, pinyin?, tip?, audioFileId?, imageFileId?` (hình miệng) | **W2-E**. Đối chiếu cũ: `symbol→text`, `pronunciationGuide→tip`, `mouthImageUrl→imageFileId`, `audioUrl→audioFileId`, `contentIndex→index`. **Hỏi backend**: có giữ `type` (SHENGMU/YUNMU), `hanzi`, `exampleWord/examplePinyin/exampleMeaning` không — nếu giữ, frontend thêm 2–3 trường tuỳ chọn vào form. Bản cũ còn `GET /pronunciation-items?keyword=` và `/paged` (thay bằng `/search` generic), `pronunciation-progress/*` (phía học viên, không thuộc màn quản lý) |

Điểm nền ghi nhận cho gói sau (W2-E): `ContentModuleConfig` chưa có `bulkHint/bulkPlaceholder` nên ô Nhập nhanh cố định "chữ Hán, nghĩa, pinyin" (Hán tự nhập theo thứ tự `chữ Hán, nghĩa, pinyin[, số nét, bộ thủ, Hán Việt]`); `readTreeLocation` bỏ `?type=` (HSK cũ dùng để khoá tab loại gói ở hanzi/pronunciation — nay chọn tab bằng UI).

Import Excel của gói (`POST {prefix}/packages/import-excel?typeName=`) **chưa chuyển**: nút "Nhập Excel" hiện toast "chưa chuyển sang bản mới"; không thêm thư viện xlsx.

### Thẻ ghi nhớ — đối chiếu tên trường với HSK cũ

| HSK cũ (`Card`) | Đề xuất M5 | Lý do |
|---|---|---|
| `definition` | `meaning` | Theo brief W2-T (nghĩa tiếng Việt) |
| `exampleSentence` / `exampleMeaning` | `example` / `exampleMeaning` | — |
| `imageOrigin` / `imageWord` (URL tự do) | `imageFileId` | Ảnh là tệp của repo-storage backend chung; URL xem = `GET {STORAGE}/file/{id}?disposition=inline` |
| `audio` (URL) | `audioFileId` | như trên |
| `cardIndex` | `index` | dùng chung mọi module |
| `examplePinyin`, `customFields`, `sinoVn`, `hskLevel`, `characters`, `status` | **bỏ** | Không có trong hợp đồng đề xuất; nếu backend cần giữ, thêm trường tuỳ chọn (frontend bỏ qua trường lạ) |

## 4. Điểm cần backend xác nhận

1. Đường dẫn thật và việc gộp 2 bước "tạo rồi gắn cha" thành 1 (`packageId`/`folderId` trong body). Nếu giữ mô hình cũ (thư mục/bộ dùng chung nhiều cha), cần `POST {prefix}/packages/{id}/folders/{folderId}` và `POST {prefix}/folders/{id}/study-sets/{setId}` — frontend sẽ thêm 2 lời gọi.
2. Xoá cha có xoá đệ quy không (UI nói "Tất cả ... bên trong sẽ bị xoá" như bản cũ)? Hay trả 409 khi còn con?
3. Publish chỉ Admin/Teacher-manager? Mentor có được ghi (bản cũ: Mentor/Teacher/Collaborator theo ticket)?
4. `index` có do backend chuẩn hoá lại sau khi xoá mục ở giữa không? (frontend gửi `index` = vị trí mới khi sửa bộ ở `/sets/:id/edit`).
5. `GET /{itemsPath}/search`: tìm trên trường nào (frontend gợi ý: mọi trường chuỗi), có phân biệt hoa/thường, phân trang `page` từ 0 (như `PagedResult` cũ)?
6. Giới hạn kích thước ảnh/âm thanh của repo-storage (frontend chặn 5MB ảnh, 10MB âm thanh như bản cũ).

## 5. Hành vi giao diện khi API chưa sẵn sàng (đã kiểm thử với mock)

| Tình huống | Frontend |
|---|---|
| `NEXT_PUBLIC_HSK_API_BASE_PATH` trống | Mỗi cấp hiện khối "WAITING FOR BACKEND" trong vùng danh sách; không gọi mạng, không toast, không dữ liệu giả |
| API lỗi (mạng/5xx/403) | Khối lỗi với thông điệp + "Thử lại" (bản cũ: danh sách rỗng, che lỗi) |
| Công tắc ghi đóng | Mọi nút Thêm/Sửa/Xoá/Publish ẩn; `WriteLockedNotice`; client chặn — không "thành công giả" |
| Giảng viên không có ticket FLASHCARD (hoặc ticket service lỗi/chưa cấu hình) | Alert "Chế độ Xem duy nhất" (chữ của bản cũ); chỉ xem |
| Id trong URL không còn (gói đã xoá) | Khối "Không tìm thấy ... trong danh sách" + "Quay lại" |
| Thao tác ghi thành công | Toast như bản cũ ("Tạo package thành công!", `Package "X" đã được publish`...) rồi tải lại danh sách từ máy chủ |

## 6. Thêm một module mới trên nền này (hướng dẫn ngắn cho gói sau)

1. **Config**: tạo `src/components/management/content-<module>/<module>-config.tsx` xuất một `ContentModuleConfig<TItem>` (kiểu ở `src/types/content.ts`): `module` (ticket), `key`, `apiPrefix`, `itemsPath`, `title`, `icon`, `pageClassName`, `labels`, `packagesHeader`, `packageTypes` (dùng `DEFAULT_PACKAGE_TYPES` hoặc danh sách riêng), `hasSkill`/`skills` (quiz), `supportsImport`, `itemSearchTab` (nếu có endpoint `/search`), `itemColumns`, `ItemForm`, `emptyItemInput`/`itemToInput`/`validateItemInput`/`normalizeItemInput`/`itemSummary`, tuỳ chọn `ItemPreview`, `parseBulkText`, `setEditorRoutes`. Mẫu: `content-flashcard/flashcard-config.tsx` (+ biến thể `VOCAB_SET_CONFIG` chỉ đổi nhãn).
2. **Kiểu mục**: `src/types/content-<module>.ts` — `interface X extends ContentItemBase { ...trường riêng }`.
3. **Form mục**: component nhận `ContentItemFormProps<TItem>` (`value`, `onChange`, `disabled`, `idPrefix`); ảnh/âm thanh dùng `ContentFileField`. Hàm thuần (validate/normalize/parse) đặt ở `src/lib/content/<module>-item.ts` để test không cần React.
4. **Trang**: `<đúng URL HSK cũ>/page.tsx` mỏng, bọc `<Suspense>` và render `<ContentTreeManager config={X_CONFIG} />` (hoặc `<ContentSetEditor>` cho trang tạo/sửa bộ kèm mục). Báo điều phối thêm route vào `MIGRATED_ROUTES`.
5. **Mock**: `scripts/mock/handlers/content-tree.mjs` đã phục vụ 5 tiền tố; chỉ cần sửa bảng `MODULES` (trường bắt buộc) và seed `*_DEMO` nếu đổi trường.
6. **Test**: dùng lại mẫu `tests/content-tree-manager.test.tsx` (router giả có trạng thái + `vi.mock("@/lib/api/content-tree-client")`), đổi config/fixture.
Không cần sửa `content-tree-client.ts`, `use-content-tree.ts`, các view hay SCSS (chỉ thêm `.manage-<module>-page` nếu CSS cũ của module có class riêng).
