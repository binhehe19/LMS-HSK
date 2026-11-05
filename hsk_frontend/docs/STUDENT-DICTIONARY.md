# Từ điển học viên — `/vocabulary`, `/vocabulary/:id`

Chuyển màn Từ điển của HSK cũ (`https://lms-ai.hoc-ba.edu.vn/vocabulary`, `LMS_Frontend/src/features/learning-path/vocabulary`) sang hsk_frontend;
backend dùng chung repo-lms của LMS_IELTS (tài nguyên Kho `type=DICTIONARY`, cùng nguồn dữ liệu với màn quản trị `/vocabulary/manage`).

## Màn hình

| URL (giữ nguyên HSK cũ) | Nội dung |
| --- | --- |
| `/vocabulary` | Banner, ô tra cứu (Hán tự / pinyin có hoặc không dấu / nghĩa tiếng Việt), lọc cấp HSK, lọc bộ thủ (214 bộ, lọc nhanh theo số nét), lưới thẻ 10 từ/trang, phân trang. Bộ lọc/trang nằm trong query (`keySearch, hskLevel, radical, strokeFilter, page`) như bản cũ. |
| `/vocabulary/:id` | Chi tiết: phiên âm chính, nghĩa, Hán Việt, từ loại, phân tích thành phần (chữ thành phần có liên kết; từ đơn hiện bộ thủ), ảnh minh hoạ, ví dụ, "Từ đã xem"; popup Phát âm (ghi âm/nghe lại), Hội thoại, Luyện viết (hanzi-writer), Luyện tập. |

Header học viên: mục "Từ điển" trỏ `/vocabulary` (trước đây chỉ mở hộp "sẽ kết nối"). Guard: nhóm `(student)` — mọi người dùng đã đăng nhập (bản cũ: `PrivateRoute` không giới hạn role).

Khác bản cũ có chủ đích: ô tra cứu chờ 400ms sau lần gõ cuối (bản cũ gọi API mỗi phím); lỗi/chưa cấu hình API có trạng thái riêng + "Thử lại" (bản cũ hiện "Không tìm thấy"); cấp HSK lấy bằng 1 lời gọi (bản cũ dò 9 lần); đổi bộ lọc ghi URL một lần (bản cũ có lỗi URL lệch trạng thái); thẻ là liên kết thật; nút "ZH" vẫn chỉ là nhãn (bản cũ cũng không có chức năng); nút lưu từ vẫn chỉ là trạng thái tạm + toast (bản cũ không lưu); không có theo dõi analytics; ảnh Wikimedia chỉ hiển thị, không tải lên/ghi ngược. Không chuyển: `add-to-study-set-modal`, `character-popup` (bản cũ không dùng).

## API (repo-lms, qua `NEXT_PUBLIC_LMS_API_BASE_PATH` = `/api/lms`)

| Endpoint | Quyền | Ghi chú |
| --- | --- | --- |
| `GET /learning-resources/dictionary-hanzi/words?keySearch&hskLevel&radical&isSingleVocab&wordType&page&size` | đã đăng nhập | Chỉ từ đã xuất bản. `radical` nhận ký tự (`口`) hoặc dạng DB cũ (`KHẨU 口`). Thứ tự = id ở hệ cũ (`dict_order`), từ tạo mới xếp sau. PageResponse snake_case. |
| `GET /learning-resources/dictionary-hanzi/words/{id}` | đã đăng nhập | Từ đã xuất bản + `components` (tra từng chữ của từ ghép theo `word_key`); 404 nếu chưa xuất bản. |
| `GET /learning-resources/dictionary-hanzi/levels` | đã đăng nhập | `[{level, count}]` cấp có từ. |
| `GET /learning-resources/dictionary-hanzi/search` | ROLE_ADMIN | Màn quản trị (có bản nháp) — giữ hợp đồng cũ, nay lọc bằng SQL. |
| `POST /learning-resources/dictionary-hanzi/import` | ROLE_ADMIN | Nhập lô ≤ 500 từ từ hệ cũ; idempotent theo `legacyId`. |
| `POST /learning-resources/dictionary-hanzi/reindex` | ROLE_ADMIN | Lập chỉ mục bù cột lọc (cũng tự chạy khi khởi động). |

Backend: cột lọc riêng `dict_hsk_level, dict_single_vocab, dict_word_types, dict_radical, dict_order` trên `learning_resources` (tạo bởi `ddl-auto: update`, kèm index `(type, dict_order)`), làm mới cùng các cột tìm kiếm trong `LearningResourceService`; từ khoá khớp "chứa" trên `search_title`/`search_text` (Hán tự, phiên âm bỏ dấu, nghĩa bỏ dấu — như collation không phân biệt dấu của MySQL cũ). Đo trên ~112 nghìn từ (Postgres cục bộ): danh sách 0,15s, từ khoá 0,03–0,13s, lọc 0,11s, trang 11.000 ~0,3s.

## Biến môi trường

Frontend (`.env.example`, mục "Màn Từ điển học viên"; nhúng lúc build): `NEXT_PUBLIC_TTS_VOICERSS_KEY` (trống = chỉ Web Speech; bản cũ ghi cứng khoá), `NEXT_PUBLIC_HANZI_WRITER_DATA_URLS` (trống = 2 nguồn jsdelivr như cũ), `NEXT_PUBLIC_DICTIONARY_WIKIMEDIA_FALLBACK` (`enabled` để bật ảnh chữ triện Wikimedia).
Backend (`backend/.env.*.example`, `docker-compose.yml`): `HSK_DICTIONARY_REINDEX_ON_STARTUP` (mặc định `true`).

## Chuyển dữ liệu từ hệ cũ (111.662 từ)

`backend/scripts/import-hsk-dictionary.mjs` (Node ≥ 18, không phụ thuộc gói ngoài; cấu hình: `backend/scripts/import-hsk-dictionary.env.example`). Đọc API công khai của hệ cũ
`GET {HSK_DICT_SOURCE_API_BASE}/vocabularies/search` theo trang (sắp theo id), ghi qua endpoint import bằng token ROLE_ADMIN. Không cần quyền DB.

```
export HSK_DICT_SOURCE_API_BASE=https://lms-ai.hoc-ba.edu.vn/api/dictionary
node backend/scripts/import-hsk-dictionary.mjs --save-file hsk-dictionary.ndjson     # 1. tải toàn bộ về file (~560 trang × 200, nghỉ 200ms/trang)
export LMS_API_BASE=https://<domain>/api/lms LMS_ADMIN_TOKEN=<access token ROLE_ADMIN> HSK_DICT_MEDIA_BASE=https://lms-ai.hoc-ba.edu.vn
node backend/scripts/import-hsk-dictionary.mjs --from-file hsk-dictionary.ndjson --dry-run   # 2. kiểm tra
node backend/scripts/import-hsk-dictionary.mjs --from-file hsk-dictionary.ndjson             # 3. nhập (chạy lại an toàn)
```

Chuẩn hoá khi nhập: bỏ phiên âm/nghĩa rỗng; đúng một phiên âm chính; URL media tương đối của hệ cũ (`/api/storage/files/…`) đổi thành tuyệt đối theo `HSK_DICT_MEDIA_BASE`;
sửa lỗi nhập liệu có quy luật "Chữ Hán: …" / pinyin nằm trong ô nghĩa Việt dạng "Pinyin: …" (~0,2% ví dụ). Từ không có phiên âm (vd `良好`) vẫn được nhập như hệ cũ vẫn hiện.
Mặc định mọi từ được xuất bản (màn cũ hiện mọi từ cho học viên); `--keep-drafts` giữ từ `status=draft` là bản nháp. Mục lỗi ghi ra `hsk-dictionary-import-failures-*.json`.

**Còn mở:** ảnh/âm thanh vẫn nằm ở storage của hệ cũ (URL tuyệt đối) — khi tắt hệ cũ cần sao chép media sang repo-storage và đổi URL.

## Kiểm thử

- Backend: `HanziDictionaryBackendTest` (9 ca, H2) + toàn bộ repo-lms 366 ca xanh (`mvn -o test`).
- Frontend: `tests/vocabulary-list-params`, `vocabulary-home`, `vocabulary-detail-model`, `vocabulary-detail-page`, `route-registry` xanh; typecheck, ESLint, `next build` sạch.
- Đầu-cuối (cục bộ, Postgres/Redis tạm): nhập 621 từ thật từ API cũ (0 lỗi sau khi cho phép từ không phiên âm; nhập lại = "không đổi"); trang đầu khớp hệ cũ (一 七 三 上 下 不 个 九 书 买);
  trình duyệt trên bản build production: danh sách, lọc HSK/bộ thủ, tra cứu, chi tiết + phân tích thành phần, 4 popup, mobile không cuộn ngang.
