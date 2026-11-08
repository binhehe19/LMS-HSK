// Hàm thuần hiển thị giáo trình (backend chung, DTO types/lms.ts) cho màn Quản lý Syllabus. Không import React/Next, không gọi API.
// Nhãn tiếng Việt lấy từ INFO_FIELD_MAP của syllabus-management-modal.tsx HSK cũ; bản cũ dựng cột/ô theo KHOÁ BẤT KỲ của JSON ERP (keyToLabel),
// ở đây DTO đã có hình dạng cố định nên danh sách trường cố định — thiếu giá trị hiện "—" như bản cũ hiện "-".
import dayjs from "dayjs";
import type { SyllabusDetailResponse, SyllabusSummaryResponse } from "@/types/lms";

export const EMPTY_VALUE = "—";

/** Chuỗi hiển thị cho một giá trị đơn: rỗng => "—", boolean => Có/Không, mảng => nối ", ". */
export function displayText(value: unknown): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (Array.isArray(value)) {
    const parts = value.map((v) => displayText(v)).filter((v) => v !== EMPTY_VALUE);
    return parts.length ? parts.join(", ") : EMPTY_VALUE;
  }
  if (typeof value === "object") return EMPTY_VALUE;
  const text = String(value).trim();
  return text || EMPTY_VALUE;
}

/** Ngày ISO => dd/MM/yyyy; thiếu/không hợp lệ => "—" (không hiện "Invalid Date"). */
export function formatSyllabusDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE;
  const d = dayjs(iso);
  return d.isValid() ? d.format("DD/MM/YYYY") : EMPTY_VALUE;
}

/** Tên hiển thị: tên, rồi mã, rồi id (như optionLabel của dropdown cũ). */
export function syllabusTitle(s: Pick<SyllabusSummaryResponse, "id" | "name" | "code">): string {
  return s.name?.trim() || s.code?.trim() || s.id;
}

/** Tìm kiếm phía client trên Tên / Mã / Cấp độ / Loại / Tác giả (không phân biệt hoa thường); từ khoá rỗng => giữ nguyên thứ tự API. */
export function filterSyllabuses(list: readonly SyllabusSummaryResponse[], keyword: string): SyllabusSummaryResponse[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return [...list];
  return list.filter((s) => [s.name, s.code, s.educationLevelName, s.type, s.author].some((v) => (v ?? "").toLowerCase().includes(q)));
}

export interface InfoField {
  label: string;
  value: string;
}

/** Tab "Thông tin chung": thứ tự cố định theo INFO_PRIORITY_KEYS của bản cũ, phần còn lại theo DTO. */
export function buildSyllabusInfoFields(d: SyllabusDetailResponse): InfoField[] {
  return [
    { label: "Tên khóa học", value: displayText(d.name) },
    { label: "Mã khóa học", value: displayText(d.code) },
    { label: "Cấp độ HSK", value: displayText(d.educationLevelName ?? d.educationLevelCode) },
    { label: "Loại khóa học", value: displayText(d.type) },
    { label: "Loại văn bản", value: displayText(d.documentType) },
    { label: "Chương trình đào tạo", value: displayText(d.trainingProgram) },
    { label: "Điều kiện tiên quyết", value: displayText(d.prerequisite) },
    { label: "Phân bố giờ học", value: displayText(d.distributionHours) },
    { label: "Phương pháp giảng dạy", value: displayText(d.teachingMethods) },
    { label: "Công cụ học tập", value: displayText(d.learningTools) },
    { label: "Điểm đạt tối thiểu", value: displayText(d.minimumPassingScore) },
    { label: "Thang điểm", value: displayText(d.scoreRange) },
    { label: "Tác giả", value: displayText(d.author) },
    { label: "Trạng thái", value: displayText(d.status) },
    { label: "Phiên bản mới nhất", value: displayText(d.latestVersionNo) },
    { label: "Ngày tạo", value: formatSyllabusDate(d.createdAt) },
    { label: "Cập nhật", value: formatSyllabusDate(d.updatedAt) },
    { label: "Mô tả", value: displayText(d.description) },
    { label: "Trách nhiệm của học viên", value: displayText(d.studentResponsibilities) },
    { label: "Ghi chú", value: displayText(d.notes) },
  ];
}

/** Mã CLO (CLO1, CLO2...) từ danh sách id tham chiếu; id không có trong bảng CLO thì hiện nguyên id. */
export function cloCodes(detail: Pick<SyllabusDetailResponse, "clo">, ids: readonly string[] | undefined): string {
  if (!ids || ids.length === 0) return EMPTY_VALUE;
  const byId = new Map((detail.clo ?? []).map((c) => [c.id, c.code?.trim() || c.name?.trim() || c.id]));
  return ids.map((id) => byId.get(id) ?? id).join(", ");
}

/** Liên kết tài liệu chỉ mở được khi là URL http(s) tuyệt đối; "#" / đường dẫn lạ của ERP chỉ hiện chữ. */
export function isOpenableLink(link: string | undefined): link is string {
  return typeof link === "string" && /^https?:\/\//i.test(link.trim());
}
