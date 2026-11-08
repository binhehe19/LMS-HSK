// Cấu hình màn "Khoá học" học viên đọc từ env lúc build (NEXT_PUBLIC_* phải viết nguyên tên để Next.js thay giá trị).
import { safeUrl } from "@/lib/student-course/course-view-model";

/** Nhãn ưu đãi trên banner "Tất cả khoá học", ví dụ "20%". Trống = ẩn dòng ưu đãi (không hiển thị khuyến mãi không có thật). */
export const STUDENT_COURSE_PROMO = (process.env.NEXT_PUBLIC_STUDENT_COURSE_PROMO ?? "").trim().slice(0, 12);

/** Trang đăng ký/mở khoá khoá học (http(s) hoặc đường dẫn nội bộ). Trống = nút "Mở khoá ngay!" mở hộp thông báo như bản xem trước. */
export const STUDENT_COURSE_UNLOCK_URL = safeUrl(process.env.NEXT_PUBLIC_STUDENT_COURSE_UNLOCK_URL);
