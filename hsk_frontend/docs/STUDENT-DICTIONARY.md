# Từ điển học viên — `/vocabulary`, `/vocabulary/:id`

Chuyển màn Từ điển của HSK cũ (`https://lms-ai.hoc-ba.edu.vn/vocabulary`, `LMS_Frontend/src/features/learning-path/vocabulary`) sang hsk_frontend;
backend dùng chung repo-lms của LMS_IELTS (tài nguyên Kho `type=DICTIONARY`, cùng nguồn dữ liệu với màn quản trị `/vocabulary/manage`).

## Màn hình

| URL (giữ nguyên HSK cũ) | Nội dung |
| --- | --- |
| `/vocabulary` | Banner, ô tra cứu (Hán tự / pinyin có hoặc không dấu / nghĩa tiếng Việt), lọc cấp HSK, lọc bộ thủ (214 bộ, lọc nhanh theo số nét), lưới thẻ 10 từ/trang, phân trang. Bộ lọc/trang nằm trong query (`keySearch, hskLevel, radical, strokeFilter, page`) như bản cũ. |
| `/vocabulary/:id` | Chi tiết: phiên âm chính, nghĩa, Hán Việt, từ loại, phân tích thành phần (chữ thành phần có liên kết; từ đơn hiện bộ thủ), ảnh minh hoạ, ví dụ, "Từ đã xem"; popup Phát âm (ghi âm/nghe lại), Hội thoại, Luyện viết (hanzi-writer), Luyện tập. |

Header học viên: mục "Từ điển" trỏ `/vocabulary` (trước đây chỉ mở hộp "sẽ kết nối"). Guard: nhóm `(student)` — mọi người dùng đã đăng nhập (bản cũ: `PrivateRoute` không giới hạn role).

Khác bản cũ có chủ đích: ô tra cứu chờ 400ms sau lần gõ cuối (bản cũ gọi API mỗi phím); lỗi/chưa cấu hình API có trạng thái riêng + "Thử lại" (bản cũ hiện "Không tìm thấy"); cấp HSK hiện cố định 1–9 (bản cũ dò 9 lần search để ẩn cấp chưa có từ); đổi bộ lọc ghi URL một lần (bản cũ có lỗi URL lệch trạng thái); thẻ là liên kết thật; nút "ZH" vẫn chỉ là nhãn (bản cũ cũng không có chức năng); nút lưu từ vẫn chỉ là trạng thái tạm + toast (bản cũ không lưu); không có theo dõi analytics; ảnh Wikimedia chỉ hiển thị, không tải lên/ghi ngược. Không chuyển: `add-to-study-set-modal`, `character-popup` (bản cũ không dùng).

## API (repo-lms, qua `NEXT_PUBLIC_LMS_API_BASE_PATH` = `/api/lms`)

| Endpoint | Quyền | Ghi chú |
| --- | --- | --- |
| `GET /learning-resources/dictionary-hanzi/search?keySearch&hskLevel&radical&isSingleVocab&wordType&page&size` | đã đăng nhập | Endpoint **có sẵn** của màn quản lý, nay mở cho học viên: Admin thấy cả bản nháp, người khác chỉ thấy từ đã xuất bản. `radical` nhận ký tự (`口`) hoặc dạng DB cũ (`KHẨU 口`). Thứ tự = id (từ nhập từ hệ cũ có id mang thứ tự cũ; từ tạo mới là ULID theo thời điểm tạo). |
| `GET /learning-resources/dictionary-hanzi/words/{id}` | đã đăng nhập | **Endpoint mới duy nhất**: từ đã xuất bản + `components` (tra từng chữ của từ ghép theo `word_key`); 404 nếu chưa xuất bản. Lý do thêm: `GET /learning-resources/{id}` có sẵn chỉ cho Admin và trả cả lịch sử phiên bản. |
| `POST /learning-resources/bulk` (`type=DICTIONARY`) | ROLE_ADMIN | Endpoint **có sẵn** dùng để nhập từ hệ cũ (≤ 500 mục/lần). Chống trùng theo chữ Hán. |

Backend (chỉ thêm trường + sửa nhỏ trong file có sẵn, không thêm file/bảng):
- 5 cột lọc trên `learning_resources`: `dict_hsk_level, dict_single_vocab, dict_word_types, dict_radical, dict_order` (`ddl-auto: update` tự thêm, null với loại khác); tính lại cùng các cột tìm kiếm trong `LearningResourceService.applySearchColumns`.
- Trường `components` trong `DictionaryWordResponse`.
- `searchDictionaryHanzi` có sẵn: lọc + phân trang bằng SQL trên các cột trên (trước đây nạp toàn bộ từ điển rồi lọc bằng Java — không chạy nổi với ~112 nghìn từ).
- Từ khoá khớp "chứa" trên `search_title`/`search_text` (Hán tự, phiên âm bỏ dấu, nghĩa bỏ dấu); từ loại không còn nằm trong chuỗi tìm kiếm (lọc riêng bằng `wordType`), tránh gõ "từ" ra cả từ điển.
- Không thêm index (cấu trúc DB giữ nguyên). Đề xuất cho lead: index `(type, dict_order)` giúp danh sách nhanh hơn khi từ điển đủ ~112 nghìn từ.
- Từ điển tạo trước bản cập nhật chưa có giá trị 5 cột này cho tới khi được lưu lại một lần (vẫn hiện trong danh sách/tra cứu, chỉ chưa lọc được theo HSK/bộ thủ/từ loại).

## Biến môi trường

Frontend (`.env.example`, mục "Màn Từ điển học viên"; nhúng lúc build): `NEXT_PUBLIC_TTS_VOICERSS_KEY` (trống = chỉ Web Speech; bản cũ ghi cứng khoá), `NEXT_PUBLIC_HANZI_WRITER_DATA_URLS` (trống = 2 nguồn jsdelivr như cũ), `NEXT_PUBLIC_DICTIONARY_WIKIMEDIA_FALLBACK` (`enabled` để bật ảnh chữ triện Wikimedia).
Backend: không có biến mới.

## Chuyển dữ liệu từ hệ cũ (111.662 từ)

`backend/scripts/import-hsk-dictionary.mjs` (Node ≥ 18, không phụ thuộc gói ngoài; cấu hình: `backend/scripts/import-hsk-dictionary.env.example`). Đọc API công khai của hệ cũ
`GET {HSK_DICT_SOURCE_API_BASE}/vocabularies/search` theo trang (sắp theo id), ghi qua `POST /learning-resources/bulk` có sẵn bằng token ROLE_ADMIN. Không cần quyền DB.

```
export HSK_DICT_SOURCE_API_BASE=https://lms-ai.hoc-ba.edu.vn/api/dictionary
node backend/scripts/import-hsk-dictionary.mjs --save-file hsk-dictionary.ndjson     # 1. tải toàn bộ về file (~560 trang × 200, nghỉ 200ms/trang)
export LMS_API_BASE=https://<domain>/api/lms LMS_ADMIN_TOKEN=<access token ROLE_ADMIN> HSK_DICT_MEDIA_BASE=https://lms-ai.hoc-ba.edu.vn
node backend/scripts/import-hsk-dictionary.mjs --from-file hsk-dictionary.ndjson --dry-run   # 2. kiểm tra
node backend/scripts/import-hsk-dictionary.mjs --from-file hsk-dictionary.ndjson             # 3. nhập (chạy lại an toàn: bỏ qua từ đã có; --overwrite để ghi phiên bản mới)
```

Chuẩn hoá khi nhập: bỏ phiên âm/nghĩa rỗng; đúng một phiên âm chính; URL media tương đối của hệ cũ (`/api/storage/files/…`) đổi thành tuyệt đối theo `HSK_DICT_MEDIA_BASE`;
sửa lỗi nhập liệu có quy luật "Chữ Hán: …" / pinyin nằm trong ô nghĩa Việt dạng "Pinyin: …" (~0,2% ví dụ). Từ không có phiên âm (vd `良好`, khoảng 1/20 ở mẫu thử, 0/600 ở mẫu khác) **không nhập được** vì validate có sẵn của repo-lms bắt buộc ít nhất một phiên âm — script bỏ qua và ghi vào tệp lỗi. Muốn nhập cần lead đồng ý nới validate cho từ điển Hán tự.
Mặc định mọi từ được xuất bản (màn cũ hiện mọi từ cho học viên); `--keep-drafts` giữ từ `status=draft` là bản nháp. Mục lỗi ghi ra `hsk-dictionary-import-failures-*.json`.

**Còn mở:** ảnh/âm thanh vẫn nằm ở storage của hệ cũ (URL tuyệt đối) — khi tắt hệ cũ cần sao chép media sang repo-storage và đổi URL.

## Kiểm thử

- Backend: `HanziDictionaryBackendTest` (8 ca, H2; nhập qua `bulkCreateLibraryResources`) + toàn bộ repo-lms (`mvn -o test`).
- Frontend: `tests/vocabulary-list-params`, `vocabulary-home`, `vocabulary-detail-model`, `vocabulary-detail-page`, `route-registry` xanh; typecheck, ESLint, `next build` sạch.
- Đầu-cuối (cục bộ, Postgres/Redis tạm, trước khi chuyển sang API có sẵn): nhập 621 từ thật từ API cũ; trang đầu khớp hệ cũ (一 七 三 上 下 不 个 九 书 买);
  trình duyệt trên bản build production: danh sách, lọc HSK/bộ thủ, tra cứu, chi tiết + phân tích thành phần, 4 popup, mobile không cuộn ngang.
