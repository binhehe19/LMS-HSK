# Yêu cầu API cho backend — Quản lý Syllabus: `/learning-path/syllabus/manage` (module ôn luyện theo buổi)

Trạng thái: giáo trình (danh sách, chi tiết, phiên bản) **AVAILABLE** từ backend chung; module ôn luyện theo buổi **WAITING FOR BACKEND** (hợp đồng ĐỀ XUẤT dưới đây, kế thừa HSK cũ). Frontend (M5, gói W2-D) đã hoàn thiện giao diện, lớp gọi API và máy chủ giả lập; **không** sửa backend và **không** dùng dữ liệu giả thay thế: dịch vụ chưa cấu hình ⇒ màn hiện "WAITING FOR BACKEND", API lỗi ⇒ hiện lỗi + "Thử lại".

Phạm vi màn RÚT GỌN có chủ đích (quyết định chủ dự án D-UI-3, `docs/M5-FULL-DEMO-PLAN.md` mục 5) so với `syllabus-management-modal.tsx` 4.345 dòng của HSK cũ — xem mục 6.

Quyền route (registry, PrivateRoute HSK cũ): `ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_MENTOR`. Client: `src/lib/api/lms-syllabus-client.ts` (backend chung, `lmsClient`) và `src/lib/api/syllabus-modules-client.ts` (hợp đồng đề xuất, `hskClient` — `NEXT_PUBLIC_HSK_API_BASE_PATH`, đề nghị `/api/hsk`). DTO: `src/types/lms.ts` (Syllabus*), `src/types/syllabus-modules.ts`. Mock: `scripts/mock/handlers/syllabus-modules.mjs` (+ `lms.mjs` đã có cho giáo trình).

## 1. Đối chiếu (đọc code, chưa chạy trên môi trường thật)

| Phần màn | HSK cũ gọi | Backend chung IELTS (`repo-lms`) | Kết luận |
|---|---|---|---|
| Danh sách giáo trình (dropdown cũ → bảng mới) | `syllabusCmsService.getAllSyllabuses()` (`/syllabus-cms/...`, proxy CMS) | `GET /api/lms/syllabuses` → `SyllabusSummaryResponse[]` (chỉ cần đăng nhập, không giới hạn role — đã báo trong khảo sát) | **AVAILABLE** — dùng `listSyllabuses()` |
| Chi tiết: Thông tin chung, CLO, Tài liệu, Lịch trình, Cấu trúc đánh giá, Mẫu bài kiểm tra | `syllabusCmsService.getSyllabusById(id)` (JSON ERP tuỳ ý, màn cũ tự dò khoá) | `GET /api/lms/syllabuses/{id}` → `SyllabusDetailResponse` (hình dạng cố định: `clo[]`, `materials[]`, `schedule[]`, `gradingStructure[]`, `testTemplate`) | **AVAILABLE** — `getSyllabus(id)`; chỉ đọc (proxy ERP) |
| Phiên bản | không có | `GET /api/lms/syllabuses/{id}/versions` → `SyllabusVersionResponse[]` | **AVAILABLE** — tab mới "Phiên bản" |
| Module ôn luyện theo buổi (xem/thêm/sắp xếp/xoá) | `onlineCourseService` `/online-learning/schedule-modules*`, `/online-learning/schedule-available-modules/{TYPE}` | **không có** (dữ liệu riêng của HSK: gắn bộ nội dung của kho flashcard/quiz/ngữ pháp… vào buổi của giáo trình) | **MISSING** → hợp đồng đề xuất mục 2 |
| Gắn học liệu theo buổi (`/lesson-materials/schedules/{id}/attachments`) | `lessonMaterialsService.*` | không có | **Không chuyển ở màn này** — màn Tài liệu học tập riêng (`/learning-path/lesson-materials/manage`) |
| Đề luyện (`/online-learning/management/practice-exams/*`), tạo nội dung mới trong modal, chọn video, import Excel | nhiều service | không có | **Không chuyển** (mục 6) |

## 2. Endpoint đề nghị (module ôn luyện theo buổi — `hskClient`)

Chung: cookie phiên Auth chung hoặc `Authorization: Bearer` (`credentials: include`; 401 ⇒ frontend refresh một lần); response bọc `{ success, data }` (frontend cũng nhận thân trần); lỗi `{ success: false, errorCode, errorMessage }` (frontend hiện `errorMessage` khi là văn bản ngắn). `scheduleId` chính là `SyllabusScheduleItem.id` của backend chung (`GET /syllabuses/{id}` → `schedule[i].id`) — backend HSK cần đồng bộ/khớp id buổi với ERP (HSK cũ: bảng `syllabus_schedule` đồng bộ từ CMS).

```ts
type ScheduleModuleType = "FLASHCARD" | "VOCABULARY" | "WRITING" | "KANJI" | "PRONUNCIATION" | "QUIZ" | "LISTENING" | "GRAMMAR" | "LESSON_MATERIAL" | "AI_PRACTICE" | "AI_WRITING" | "AI_SPEAKING" | "AI_LISTENING" | "AI_READING";

interface ScheduleModule { id: string; scheduleId: string; moduleType: ScheduleModuleType | string; contentSetId?: string; title?: string; order: number; skillType?: string }
interface ScheduleAvailableModule { id: string; title?: string; moduleType?: string; repoName?: string; itemCount?: number }   // repoName = "Gói / Thư mục" chứa bộ nội dung
interface CreateScheduleModuleRequest { scheduleId: string; moduleType: ScheduleModuleType; contentSetId: string; title: string; skillType?: string }  // skillType chỉ QUIZ
interface ReorderScheduleModulesRequest { ids: string[] }   // TOÀN BỘ id module của buổi theo thứ tự mới
```

| # | Method + đường dẫn | Dùng cho | Quyền đề nghị | Phản hồi |
|---|---|---|---|---|
| 1 | `GET {HSK}/online-learning/schedule-modules/by-schedule/{scheduleId}` | Tab Lịch trình: một lời gọi **mỗi buổi** (song song) khi mở tab | đã đăng nhập (ADMIN, TEACHER, MENTOR) | `ScheduleModule[]` đã sắp theo `order` (frontend vẫn sắp lại); buổi không có module ⇒ `[]`; buổi không tồn tại ⇒ 404 |
| 2 | `GET {HSK}/online-learning/schedule-available-modules/{TYPE}?q=` | Hộp "Thêm module": bộ nội dung có sẵn theo **loại nội dung** (`TYPE` = `contentTypeOf(moduleType)`: `VOCABULARY` ⇒ `FLASHCARD`, `AI_*` ⇒ `AI_PRACTICE`); `q` lọc theo tên (không gửi khi rỗng) | đã đăng nhập | `ScheduleAvailableModule[]`; `TYPE` lạ ⇒ 400 |
| 3 | `POST {HSK}/online-learning/schedule-modules` body `CreateScheduleModuleRequest` | Nút "Thêm vào buổi" | ADMIN, hoặc TEACHER/MENTOR có ticket `OTHER` OPEN/DONE (**backend kiểm lại**) | 201 `ScheduleModule` với `order` = cuối buổi; 400 thiếu trường/`moduleType` lạ/`title` > 200; 404 `scheduleId`/`contentSetId` không có |
| 4 | `PUT {HSK}/online-learning/schedule-modules/by-schedule/{scheduleId}/reorder` body `{ ids }` | Nút ↑ / ↓ | như 3 | 200 `ScheduleModule[]` đã đánh lại `order` 1..n; 400 khi `ids` không đúng tập id của buổi |
| 5 | `DELETE {HSK}/online-learning/schedule-modules/{id}` | Nút "Xóa" (có hộp xác nhận) | như 3 | 204; 404 không có. Backend đánh lại `order` của module còn lại |

Khác hợp đồng HSK cũ (`online-course.service.ts`) có chủ đích, cần backend xác nhận: (a) `order` thay `moduleOrder`; (b) reorder nhận `{ ids }` thay `{ items: [{ id, newOrder }] }`; (c) frontend **không** gửi `moduleOrder`/`description`/`isRequired`/`contentFolderId`/`externalRefJson` khi tạo (bản cũ có — module con "Từ vựng" qua `externalRefJson` **không chuyển**); (d) `LESSON_MATERIAL` không được tạo từ màn này; (e) `/schedule-modules/import` (Excel) không chuyển.

## 3. Quyền và công tắc ghi phía frontend

- Route: ADMIN, TEACHER, MENTOR (Teacher-manager/Collaborator chưa được app mới phục vụ).
- Sửa module: `useContentAccess("OTHER")` (quy tắc ticket HSK cũ: Admin luôn có; giảng viên cần ticket OPEN/DONE module `OTHER` giao cho mình) **và** `useWriteGate("content")` (`NEXT_PUBLIC_WRITE_CONTENT=enabled` hoặc chế độ demo). Không có quyền ⇒ Alert "Chế độ Xem duy nhất" (chữ bản cũ), module vẫn **xem** được (bản cũ ẩn "Không có quyền truy cập"); công tắc đóng ⇒ `WriteLockedNotice`, nút ghi không hiện, hàm client ném `WriteDisabledError` — **không có request ghi nào được tạo**.
- Backend **phải** kiểm quyền ở mọi API (guard frontend chỉ là rào giao diện).

## 4. Hành vi frontend theo tình huống (đã kiểm thử với vitest/mock)

| Tình huống | Frontend |
|---|---|
| Chưa cấu hình `NEXT_PUBLIC_LMS_API_BASE_PATH` | Danh sách/chi tiết: dòng WAITING FOR BACKEND (không "Thử lại"), không toast |
| Chưa cấu hình `NEXT_PUBLIC_HSK_API_BASE_PATH` | Tab Lịch trình vẫn hiện buổi từ giáo trình; cột module "—" + dòng WAITING; nút "Thêm module" khoá; hộp thêm hiện WAITING trong phần kho |
| Giáo trình 404 / 5xx / mất mạng | Toast (như bản cũ) + khối lỗi có "Thử lại"; phiên bản lỗi có khối lỗi riêng, không che chi tiết |
| Một buổi lỗi khi tải module | Cả khối module lỗi + "Thử lại" (bản cũ coi buổi lỗi là rỗng) |
| Ghi lỗi (400/403/404/5xx) | Toast `errorMessage` của backend; không toast thành công; danh sách giữ nguyên |
| Ghi thành công | Toast chữ bản cũ ("Đã thêm module", "Đã cập nhật thứ tự học module", "Đã xóa module") rồi tải lại module của mọi buổi |
| `?view=` không an toàn (`/ \ ? # %`, ".", "..", > 128 ký tự) | Thông báo, **không gọi API** |

## 5. Máy chủ giả lập (tham chiếu hành vi mong đợi)

`scripts/mock/handlers/syllabus-modules.mjs`: chỉ bắt 5 đường dẫn ở mục 2 (đường dẫn khác dưới `/api/hsk/online-learning/` trả `false` cho gói khác). Seed LƯỜI từ chính giáo trình giả lập của backend chung (`state.data.lmsSyllabuses()` / `lmsSyllabus(id).schedule[i].id`) nên khớp cả hồ sơ `demo` (`syl-<courseId>-sch-<n>`) và `e2e` (`sch-<i>-<n>`): buổi lẻ có Từ vựng + Quiz, buổi chia hết cho 3 thêm Ngữ pháp, buổi 2/6/10 Phát âm, buổi 4/8 trống (để demo cột "Cần bổ sung"). Kho có sẵn: 6 bộ mỗi loại (`set-<type>-<n>`). 401 chưa đăng nhập; ghi: 403 ngoài ADMIN/TEACHER/MENTOR; 400/404 như mục 2; đọc chính tôn trọng `controls.api` (`error` ⇒ 500, `slow` ⇒ trễ 2,5 s); `/mock-reset` seed lại.

## 6. Phạm vi KHÔNG chuyển (D-UI-3) — ghi trong Alert "Phạm vi rút gọn" trên tab Lịch trình

1. Tạo nội dung mới ngay trong modal (gói / thư mục / bộ học của flashcard, quiz, hán tự, phát âm, ngữ pháp; nhập nội dung tay; hàng đợi bản nháp nhiều module).
2. Gắn học liệu theo buổi / theo khoá (`/lesson-materials/*`) — có màn riêng.
3. Tab "Luyện đề" (`/online-learning/management/practice-exams/*`).
4. Chọn video từ kho cho module Luyện nghe (`LISTENING` không có trong dropdown thêm).
5. Import module từ Excel (`/schedule-modules/import`).
6. Module con của "Từ vựng" (`externalRefJson`: Flashcard / Từ vựng chi tiết / Luyện viết / Game) — chỉ gắn một bộ thẻ cho module Từ vựng.

## 7. Điểm backend cần xác nhận trước khi tích hợp

1. Dịch vụ chịu trách nhiệm module theo buổi (repo-lms mở rộng hay dịch vụ HSK riêng) và base path thật; cách khớp `scheduleId` với `schedule[i].id` của ERP.
2. Tên trường thứ tự (`order` hay `moduleOrder`) và hình dạng body reorder (`{ ids }` hay `{ items }`).
3. Quyền ghi của TEACHER/MENTOR: theo ticket `OTHER` (như HSK cũ) hay chỉ ADMIN/TEACHER_MANAGER (bản cũ `canManageScheduleModules` chỉ cho Admin/Teacher Manager — khác với `canCUD` của trang)?
4. Danh mục `moduleType` chính thức và `skillType` của QUIZ; có cần `isRequired`/`description` không (frontend hiện không gửi).
5. Kho `schedule-available-modules/{TYPE}` lọc `packageType=LEARNING` phía backend như bản cũ? `repoName`/`itemCount` có sẵn không?
6. Giới hạn độ dài `title`, giới hạn số module mỗi buổi (nếu có).
