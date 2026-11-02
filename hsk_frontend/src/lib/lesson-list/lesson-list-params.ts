// Tham số URL của /instructor/list-class/list-lesson: ?classId=…&courseId=…[&page=N]. Hợp đồng URL giữ NGUYÊN như HSK cũ (LessonListPage).
// Khác bản cũ có chủ đích: kiểm tra an toàn trước khi gọi API (classId thiếu/không hợp lệ => không gọi API), trang không hợp lệ được chuẩn hoá.

export type ClassIdCheck = { kind: "ok"; classId: string } | { kind: "missing" } | { kind: "invalid" };

const MAX_ID_LENGTH = 128;
// Ký tự không bao giờ nằm trong mã lớp thật nhưng nguy hiểm khi nối vào đường dẫn API: / \ ? # % và ký tự điều khiển.
const UNSAFE_ID = /[/\\?#%\u0000-\u001f\u007f]/;

/** Kiểm tra `classId` lấy từ URL. Thiếu/chỉ khoảng trắng => missing; quá dài, có ký tự không an toàn, hoặc "."/".." => invalid. */
export function checkClassId(raw: string | null | undefined): ClassIdCheck {
  const classId = (raw ?? "").trim();
  if (!classId) return { kind: "missing" };
  if (classId.length > MAX_ID_LENGTH || UNSAFE_ID.test(classId) || classId === "." || classId === "..") return { kind: "invalid" };
  return { kind: "ok", classId };
}

/** `courseId` chỉ được chuyển tiếp trong liên kết (bản cũ không dùng để gọi API); thiếu => chuỗi rỗng. */
export function readCourseId(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

/**
 * Số trang từ `?page=`: số nguyên ≥ 1, ngược lại 1 ("abc", "0", "-3", "1.5" => 1). Bản cũ dùng `Number(...) || 1` nên "-3" cho trang âm.
 * Trang vượt quá tổng số trang được kẹp ở nơi hiển thị (clampPage), không ghi lại vào URL.
 */
export function parsePage(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function clampPage(page: number, totalItems: number, pageSize: number): number {
  const lastPage = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(1, page), lastPage);
}
