# Màn Khoá học học viên (`/student/student-courses`)

Chuyển từ HSK cũ (`LMS_Frontend/src/features/student/student-course`, URL `https://lms-ai.hoc-ba.edu.vn/student/student-courses`).
Frontend nằm trong `hsk_frontend`. **Không thay đổi backend**: chỉ dùng API có sẵn của `repo-lms` (LMS_IELTS).

## Luồng dữ liệu

| Phần màn hình | API có sẵn | Ghi chú |
|---|---|---|
| Danh mục "Tất cả khoá học" | `GET /syllabuses` (SyllabusController) | Mỗi giáo trình là một khoá. Đây là nguồn giáo trình chung mà hsk_frontend đã thống nhất dùng (commit `0b698c1`). |
| "Đã sở hữu", tiến độ, số buổi | `GET /me/classes` + `GET /me/classes/{id}` (MeController) | Sở hữu khoá khi học viên có lớp dùng giáo trình đó. Tiến độ = `completedSessions / totalSessions`. Lớp có giáo trình không nằm trong danh mục vẫn hiện (thẻ dựng từ thông tin lớp). |
| Modal chi tiết: lộ trình, tài liệu | `GET /syllabuses/{id}` | Khoá đã sở hữu thấy toàn bộ lộ trình; chưa sở hữu chỉ thấy tên 5 buổi đầu (ẩn ở giao diện). |

Ghép dữ liệu ở `src/lib/api/lms-course-client.ts` (`buildCourseCatalog`, `buildCourseDetail`). Ảnh bìa, danh mục, đối tượng, hình thức học, giá:
`/syllabuses` không có các trường này, nên lấy dữ liệu biên tập tĩnh theo mã khoá (`course/data/catalog-courses.ts`), không khớp thì suy từ mã/tên như bản cũ.
Ảnh lỗi thì đổi sang ảnh mặc định của danh mục.

## Cấu hình (env frontend, đọc lúc build)

- `NEXT_PUBLIC_LMS_API_BASE_PATH`: đã có từ trước.
- `NEXT_PUBLIC_STUDENT_COURSE_PROMO`: nhãn ưu đãi trên banner, ví dụ `20%`. Trống thì ẩn dòng ưu đãi.
- `NEXT_PUBLIC_STUDENT_COURSE_UNLOCK_URL`: trang đăng ký khi bấm "Mở khoá ngay!". Trống thì hiện hộp thông báo "Đăng ký khóa học".

## Khác bản cũ có chủ đích

- Bỏ dữ liệu giả: danh sách khoá mẫu khi API rỗng, tiến độ 65% cho "đang học", trình độ cố định "0 → HSK2 → HSK5" trên banner (giờ suy từ khoá đã sở hữu).
- Không đọc được lớp của học viên (`/me/classes` lỗi) thì danh mục vẫn hiện, kèm thông báo; lỗi tải danh mục có "Thử lại".
- Nút "Vào thời khoá biểu" bị ẩn vì khu học viên mới chưa có trang thời khoá biểu.
- Tab "Khoá học của tôi" lọc khoá đã sở hữu trong cùng lưới như bản cũ.

## Giới hạn so với hệ cũ (cần lead quyết nếu muốn đầy đủ)

- Danh mục là giáo trình trên CMS dùng chung, không phải danh mục "khoá học bán" (giá, ảnh bìa, mô tả do quản trị nhập) của dịch vụ onl-learning cũ.
  Muốn có các trường này thì cần nơi lưu, tức là thay đổi backend, cần lead duyệt.
- Tài liệu trong syllabus không có đường dẫn tải, nên modal chỉ hiện tên tài liệu.

## Kiểm thử

- `tests/student-course-client.test.ts` (ghép dữ liệu từ API có sẵn), `tests/student-course-view-model.test.ts`, `tests/student-courses-page.test.tsx`.
