// Tham số URL của /learning-path/syllabus/manage: `?view=<syllabusId>[&tab=<key>]`. HSK cũ KHÔNG có tham số URL (chọn giáo trình bằng dropdown trong
// modal); thêm có chủ đích (như IELTS) để tải lại trang / nút quay lại của trình duyệt về đúng giáo trình và tab đang xem.
// Kiểm tra an toàn trước khi nối id vào đường dẫn API (cùng quy tắc với checkClassId của màn Danh sách bài học).

export type SyllabusTabKey = "info" | "clo" | "materials" | "schedule" | "grading" | "test-template" | "versions";

export const SYLLABUS_TABS: readonly { key: SyllabusTabKey; label: string }[] = [
  { key: "info", label: "Thông tin chung" },
  { key: "clo", label: "CLO" },
  { key: "materials", label: "Tài liệu" },
  { key: "schedule", label: "Lịch trình" },
  { key: "grading", label: "Cấu trúc đánh giá" },
  { key: "test-template", label: "Mẫu bài kiểm tra" },
  { key: "versions", label: "Phiên bản" },
];

export type SyllabusIdCheck = { kind: "ok"; id: string } | { kind: "none" } | { kind: "invalid" };

const MAX_ID_LENGTH = 128;
// Ký tự không bao giờ nằm trong id thật nhưng nguy hiểm khi nối vào đường dẫn API: / \ ? # % và ký tự điều khiển.
const UNSAFE_ID = /[/\\?#%\u0000-\u001f\u007f]/;

/** `?view=` thiếu/rỗng => chế độ danh sách (`none`); có nhưng không an toàn => `invalid` (không gọi API). */
export function checkSyllabusId(raw: string | null | undefined): SyllabusIdCheck {
  if (raw === null || raw === undefined) return { kind: "none" };
  const id = raw.trim();
  if (!id) return { kind: "invalid" };
  if (id.length > MAX_ID_LENGTH || UNSAFE_ID.test(id) || id === "." || id === "..") return { kind: "invalid" };
  return { kind: "ok", id };
}

/** `?tab=` không hợp lệ hoặc thiếu => tab đầu ("Thông tin chung"). */
export function parseSyllabusTab(raw: string | null | undefined): SyllabusTabKey {
  const hit = SYLLABUS_TABS.find((t) => t.key === raw);
  return hit ? hit.key : "info";
}
