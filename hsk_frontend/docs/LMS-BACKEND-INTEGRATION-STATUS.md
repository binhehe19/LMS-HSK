# Nối `hsk_frontend` vào backend chung `LMS_IELTS/backend` (repo-lms) — trạng thái & hạn chế

Cập nhật 2026-11-01. Phạm vi: nối thử các module "kho nội dung" (quản lý ôn luyện) của `hsk_frontend` vào API thật của
`repo-lms`, thay cho kiến trúc 4 cấp `Package → Folder → Study set → Item` cũ (`content-tree-client.ts`, chưa từng có
backend, chỉ mock). Không nằm trong phạm vi tài liệu này: Auth, lớp/giáo trình (`lms-class-client.ts`/`lms-syllabus-client.ts`),
thông báo, lưu trữ — các phần đó đã có client viết sẵn theo `FEATURE-STATUS.md` nhưng **chưa được xác minh trên môi
trường thật trong phiên làm việc này**.

## 1. Cách làm chung

`repo-lms` đã có sẵn mô hình nội dung **phẳng**: `ContentPackage` (gói, có `syllabusId`/`syllabusVersionId` bắt buộc,
version DRAFT/PUBLISHED, khoá sửa qua Redis) chứa các `LearningResource` (tài nguyên, version hoá, nội dung JSON theo
`LearningResourceType`) gắn vào từng buổi (`sessionNo`). Không có khái niệm Folder/StudySet.

Chiến lược: với mỗi module HSK cũ (Package→Folder→StudySet→Item), **rút 4 cấp xuống 2 cấp** `Package → resource` (bỏ
Folder/StudySet, `sessionNo` cố định = 1), map `Item` của module đó vào một `LearningResourceType` có sẵn, viết một
client dịch field hai chiều, rồi nối vào `FlatContentManager`/`useFlatContent` (hạ tầng UI chung, generic theo `TItem`
+ nhận một bộ hàm CRUD `FlatContentClient<TItem>` làm tham số — xem
[`content-flat/use-flat-content.ts`](../src/components/management/content-flat/use-flat-content.ts)).

Quy ước áp dụng cho mọi module đã nối: **không sửa backend ở đợt này**; field HSK cũ có mặt tương đương ở backend thì
map thẳng; field KHÔNG có cột tương ứng thì nêu rõ và **tạm bỏ qua** (không gửi lên, không đọc lại) — chờ quyết định
thêm field thật ở backend, không bịa dữ liệu, không âm thầm đánh tráo ý nghĩa field có sẵn.

## 2. Đã nối (4 module)

| Module | `LearningResourceType`/`ContentPackageType` | Client | Field KHÔNG có ở backend → tạm bỏ qua |
|---|---|---|---|
| Thẻ ghi nhớ (Flashcard) | `VOCABULARY` (tái dùng `VocabularyContent`, vốn cho từ vựng tiếng Anh) | [`lms-content-client.ts`](../src/lib/api/lms-content-client.ts) | không còn field nào bị bỏ (xem 2.1) |
| Ngữ pháp (Grammar) | `GRAMMAR`/`GrammarContent` | [`lms-grammar-client.ts`](../src/lib/api/lms-grammar-client.ts) | `hskLevel` |
| Bài tập (Quiz) | `ASSESSMENT`/`QuizContent` | [`lms-quiz-client.ts`](../src/lib/api/lms-quiz-client.ts) | xem mục 3.3 cũ (nhiều field hơn, kể cả cấp câu hỏi) |
| Từ điển Hán tự (Dictionary) | `DICTIONARY`/`DictionaryContent` (MỚI, không tái dùng `VOCABULARY`) | [`lms-dictionary-client.ts`](../src/lib/api/lms-dictionary-client.ts) | không bỏ field nào (xem 2.4) |

Cả 4 đều đã có bộ test vitest riêng (`tests/flat-content-manager.test.tsx`, `tests/flat-grammar-manager.test.tsx`,
`tests/flat-quiz-manager.test.tsx`, `tests/dictionary-manage.test.tsx`) mock ở lớp client, chưa chạy thật qua môi
trường dev có backend + token hợp lệ ngoài một lần xác minh thủ công cho Flashcard (người phụ trách tự test qua UI,
xem mục 4).

### 2.1 Flashcard → `VOCABULARY`

`word↔term`, `pinyin↔pinyin`, `partOfSpeech↔wordType`, `commonMeaning↔meaning`,
`examples[0]{en,pinyin,vi}↔{example,examplePinyin,exampleMeaning}`, `imageUrl↔imageFileId` (qua
`storage-client.fileUrl`), `ukAudioUrl↔audioFileId`, `extraFields[]{label,value}↔customFields[]`, `language` cố
định `"zh"`. Trước đó `VocabularyContent` thiếu field `pinyin` và `examples[].pinyin` (Flashcard tiếng Trung không
lưu được phiên âm) — người phụ trách backend đã bổ sung 2 field này trực tiếp vào `VocabularyContent` /
`VocabularyExampleItem` ngay trong đợt này, cộng với `extraFields[]` vốn đã có sẵn nhưng frontend chưa dùng tới;
sau khi nối lại, **không còn field nào của Flashcard bị bỏ qua**.

### 2.2 Ngữ pháp → `GRAMMAR`

`title/category/generalDefinition/structure/explanation` giữ tên; `note→usageNote` (chỉ khác tên, cùng nghĩa);
`exampleSentenceZh/Pinyin/Vi` (3 chuỗi riêng) dồn vào **1 phần tử** `examples[]{sentenceEn: Zh, pronunciation: Pinyin,
translationVi: Vi}` — ép hơi gượng vì backend thiết kế `examples` là **danh sách** nhiều ví dụ với `exampleType`
(EXAMPLE/COMMON_MISTAKE) và cả cặp câu đúng/sai, còn frontend chỉ có đúng 1 ví dụ chính.
**Thiếu**: `hskLevel` (trình độ 1–9) — không có field tương ứng nào. `linkedQuizStudySetId` (liên kết bộ đề) đã bị
xoá hẳn khỏi frontend (field chết, chưa từng được gửi lên hay đọc lại từ backend) chứ không chỉ "tạm bỏ qua".

### 2.3 Bài tập → `ASSESSMENT`

Khác biệt lớn nhất trong 3 module: `QuizContent` gộp **cả metadata lẫn toàn bộ danh sách câu hỏi** vào một JSON của
một `LearningResource` duy nhất — **không có endpoint CRUD riêng cho từng câu hỏi** (HSK cũ coi câu hỏi là entity
riêng, có `id`/`index` CRUD độc lập qua `/quiz/questions/*`). Hệ quả:

- Thêm/Sửa/Xoá **1** câu hỏi phải đọc lại **toàn bộ** nội dung quiz, sửa mảng `questions` trong bộ nhớ, rồi PUT lại cả
  mảng (`saveQuizQuestions`). Không có khoá/version ở mức câu hỏi — 2 người soạn cùng lúc 1 quiz sẽ ghi đè nhau (chấp
  nhận rủi ro này ở đợt này, giống cách Flashcard/Grammar chấp nhận rủi ro tương tự ở mức resource).
- `TRUE_FALSE` không có field boolean riêng ở backend — phải dùng chung `options[]` như `MULTIPLE_CHOICE` (tự đổi
  `correctAnswer` thành 2 `options` cố định "Đúng"/"Sai" khi gửi, đọc lại theo option nào `correct=true`).
- `SHORT_ANSWER` (HSK) đổi tên thành `ESSAY` (backend) — không có kiểu "tự luận chấm tay" tên riêng.
- Field **cấp bài tập** không có cột riêng trong `QuizContent` (`instruction`, `skill`, `difficulty`, `passingScore`,
  `audioFileId`, `passageText`, `passageImageFileId`) được nhét vào `layout` — một `JsonNode` tự do mà backend
  "chỉ lưu và trả lại" (đúng thiết kế, không phải lách luật) nhưng **không type-safe, không validate, không có
  schema** phía backend; nếu sau này một dịch vụ khác cũng ghi vào `layout` theo cấu trúc khác sẽ đụng nhau.
- Field **cấp câu hỏi** hoàn toàn không có chỗ lưu, phải bỏ: `imageFileId` (ảnh minh hoạ câu hỏi — `QuestionContent`
  chỉ có `audioUrl`, không có ảnh), `difficulty` (không có field độ khó riêng từng câu), `fillBlankMode`/`choices`
  (chế độ "chọn đáp án có sẵn" cho điền chỗ trống — backend chỉ có điền tự do `blanks[]`, không có ngân hàng lựa
  chọn chung), `gradingMode`, `referenceAnswer` (đáp án mẫu cho câu tự luận/ghi âm — backend có `gradingCriteria`
  nhưng là rubric có cấu trúc khác, không phải 1 chuỗi đáp án mẫu).

### 2.4 Từ điển Hán tự → `DICTIONARY` (type mới, không tái dùng `VOCABULARY`)

Khác với 3 module trên (chỉ cần nối vào type có sẵn), Dictionary cần **thêm hẳn 1 `LearningResourceType` + content
class mới** ở backend — xem mục 3.3 cũ (đã xoá, chuyển thành mục này) để biết lý do `VocabularyContent` (tiếng Anh)
không dùng được. Đã làm:

- Backend: `LearningResourceType.DICTIONARY` + [`DictionaryContent.java`](../../backend/repo-lms/src/main/java/pl/co/lms/entity/json/DictionaryContent.java)
  (`hanzi` → `pinyins[]` → mỗi pinyin nhiều `meanings[]`, khớp 1:1 tên trường với `types/dictionary.ts`), thêm case
  trong `ResourceSearchColumns`/`LearningResourceService.validateContent`, và **đúng 1** endpoint mới
  `GET /learning-resources/dictionary-hanzi/search` (lọc `hskLevel/isSingleVocab/wordType/radical` — các trường nằm
  trong JSON content, danh sách chung không lọc được); CRUD còn lại (tạo/sửa/xoá/lấy 1 từ) dùng lại nguyên các
  endpoint chung `POST /learning-resources`, `POST/GET /{id}/versions{,/{versionId}}`, `.../publish`, `DELETE /{id}`.
- Tài nguyên **độc lập trong Kho** (`inLibrary=true`), không gắn `ContentPackage` — tra từ điển không thuộc syllabus
  nào, giống đúng cách bộ từ điển tiếng Anh (`VOCABULARY`) hiện có đang hoạt động, nhưng **tách endpoint riêng**
  (`/dictionary-hanzi/**` thay vì dùng chung `/dictionary/**`) để không đụng tính năng tiếng Anh đang chạy.
- `status` (draft/published) **không** nằm trong `DictionaryContent` — dùng đúng cơ chế draft/published version có
  sẵn của mọi `LearningResource` khác, không phải field JSON riêng.
- Frontend: `Vocabulary.id` đổi từ `number` sang `string` (ULID thật của `LearningResource`, không phải số tự tăng
  như backend từ điển HSK cũ mà hợp đồng đề xuất ban đầu giả định).

## 3. Đã khảo sát, QUYẾT ĐỊNH DỪNG — chờ backend (2 module)

### 3.1 Luyện phát âm (Pronunciation) → `AUDIO_PRACTICE` — KHÔNG phù hợp

`AudioPracticeContent` được thiết kế cho bài **luyện nghe dài** (1 file audio hoặc YouTube) chia thành nhiều
`segments` có mốc thời gian (`startMillis/endMillis`) + transcript, dùng cho shadowing/dictation. `PronunciationItem`
của HSK là **1 thẻ nhỏ**: ký hiệu/từ + pinyin + hướng dẫn phát âm + audio mẫu + **ảnh khẩu hình**. Hai mô hình không
khớp về bản chất, không chỉ thiếu vài field:

- Không có field ảnh nào trong `AudioPracticeContent` (chỉ có audio) → mất hoàn toàn "ảnh khẩu hình" — phần quan
  trọng nhất của việc luyện phát âm bằng hình.
- Không có field `pinyin`.
- `ContentPackageType` (enum riêng, khác `LearningResourceType`) **không có giá trị `AUDIO_PRACTICE`** — chỉ có
  `GRAMMAR/VOCABULARY/ASSESSMENT/MATERIAL/SLIDE` — nên không tạo được một `ContentPackage` đúng nghĩa cho module này;
  phải mượn tạm một loại gói khác (vd `MATERIAL`) chỉ để chứa được resource, sai hoàn toàn phân loại học phần của
  backend.

**Quyết định** (xác nhận với người phụ trách): dừng, không ép mapping, chờ backend thêm type/field thật.

### 3.2 Luyện viết Hán tự (Hanzi)

Không có `LearningResourceType` nào dành cho luyện viết chữ Hán (hoạt hình nét chữ, 田字格, bộ thủ/số nét) trong toàn
bộ enum. Chưa khảo sát sâu field-by-field vì đã chặn ngay ở bước chọn type — không có ứng viên nào để thử ép.

## 4. Hạn chế/khó khăn khác phát hiện được khi nối (không riêng một module)

- **JWT public key là bí mật cục bộ từng máy** (`backend/secrets/jwt-public.pem`, `.gitignore`d ở
  `backend/.gitignore:80`) dù tài liệu triển khai (`backend/docs/lms-ielts-docker-deploy.md:68`) ghi "public key
  không bí mật nên được commit" — trên thực tế file không có trong git, mỗi máy dev tự quản lý. Lệch key gây lỗi
  `401 Invalid token signature` rất khó chẩn đoán từ phía frontend (giống hệt lỗi hết hạn token) — chỉ lần ra được
  nhờ đọc log WARN `JWT verification failed on path {}: {}` ở `BearerTokenAuthenticationFilter`. Nên tài liệu hoá rõ
  cách lấy đúng key cho máy dev mới, hoặc thực sự commit nó như tài liệu đã nói.
- **`layout` (Quiz) là lối thoát chung nhưng không có schema**: hữu ích để không phải sửa backend, nhưng không ai
  kiểm tra được hình dạng `layout.meta` qua thời gian; nếu nhiều client cùng ghi vào `layout` theo cấu trúc khác nhau
  sẽ không phát hiện được lỗi cho tới khi đọc lại ra rác.
- **Không có khoá/version ở mức câu hỏi của Quiz** (mục 2.3) — rủi ro ghi đè khi nhiều người soạn cùng một bài tập,
  trong khi package/resource đã có khoá sửa (Redis) ở mức package.
- **ERP (`backup-erp.thespace.edu.vn`) không có proxy nào cho "khoá học trực tuyến"/"đăng ký khoá học" trong
  `repo-lms`** (`CmsClient.java` chỉ có hàm cho Lớp/Giáo trình) — `docs/api-requirements/online-course.md` đã ghi
  nhận MISSING từ trước. Thử trực tiếp endpoint ERP (không qua repo-lms) cũng không xác minh được gì thêm: bộ lọc xác
  thực của ERP chạy **trước** khi định tuyến, nên mọi đường dẫn (có thật hay bịa ra) đều trả `401` giống nhau khi
  chưa có token hợp lệ — không có cách phân biệt "endpoint không tồn tại" với "endpoint có nhưng thiếu quyền" nếu
  không có một access token thật để thử.
- **Không có môi trường dev/staging + tài khoản sẵn dùng cho agent** (đã nêu ở `FEATURE-STATUS.md` D-API-1) — mọi
  xác minh thật trong phiên này đều phải chạy `repo-lms` cục bộ và nhờ người phụ trách tự đăng nhập/test qua UI vì
  trình duyệt tích hợp của agent không đăng nhập được vào `backup-accounts.thespace.edu.vn` (lỗi cookie cross-origin).

## 5. Khuyến nghị việc cần backend quyết định (gộp thêm vào D-API-4 của `FEATURE-STATUS.md`)

| # | Module | Cần gì |
|---|---|---|
| 1 | Flashcard | ~~Thêm field `pinyin` vào `VocabularyContent`~~ — **đã xong** (đã thêm `pinyin` + `VocabularyExampleItem.pinyin`, frontend đã nối lại, mục 2.1) |
| 2 | Grammar | Thêm `hskLevel`; xác nhận có nên sửa `examples[]` thành cho phép nhiều ví dụ với 3 field Zh/Pinyin/Vi tách riêng thay vì `sentenceEn/pronunciation/translationVi` (field `linkedQuizStudySetId` đã bị xoá hẳn khỏi frontend, không còn cần backend quyết định) |
| 3 | Quiz | Thêm field ảnh cho câu hỏi (`QuestionContent`); xác nhận `layout.meta` có phải nơi "chính thức" để backend biết trước hay cần field thật; cân nhắc khoá/version ở mức câu hỏi nếu nhiều giảng viên soạn cùng lúc |
| 4 | Pronunciation | Cần `LearningResourceType`/`ContentPackageType` mới (hoặc field ảnh + pinyin trong `AudioPracticeContent`) cho dạng "thẻ phát âm ngắn", tách khỏi "bài luyện nghe dài có segment" hiện tại |
| 5 | Hanzi | Cần `LearningResourceType` mới cho luyện viết chữ (bộ thủ, số nét, hoạt hình nét) |
| 6 | Dictionary | ~~Cần mô hình dữ liệu riêng cho từ điển Hán ngữ~~ — **đã xong** (`LearningResourceType.DICTIONARY`/`DictionaryContent`, mục 2.4) |
| 7 | Online course / ERP | Xác nhận ERP có endpoint khoá học trực tuyến/đăng ký thật hay không; nếu có, bổ sung proxy trong `repo-lms` (`CmsClient`) theo hợp đồng `online-course.md` |
