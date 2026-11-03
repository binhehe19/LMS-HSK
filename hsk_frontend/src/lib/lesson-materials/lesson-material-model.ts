// Hàm thuần của màn Quản lý tài liệu học tập: nhãn, suy loại từ đuôi tệp, kiểm tra trùng tên bộ, định dạng dung lượng, danh sách hàng loạt.
// Rút theo đúng 2 loại thật có backing ở backend (SLIDE/MATERIAL) — không còn category LESSON/COURE hay trạng thái riêng từng tài liệu.
import type { BulkItemError, LessonMaterialGroup, LessonMaterialType } from "@/types/lesson-materials";

export const LESSON_MATERIAL_TYPE_LABELS: Record<LessonMaterialType, string> = { SLIDE: "Slides", MATERIAL: "Tài liệu" };

export const LESSON_MATERIAL_TYPE_ORDER: LessonMaterialType[] = ["SLIDE", "MATERIAL"];

/** Giá trị đặc biệt của ô chọn "Bộ tài liệu" trong form: NEW_GROUP = tạo bộ mới. Mọi tài liệu luôn thuộc đúng 1 bộ (không có "Chưa phân loại"). */
export const NEW_GROUP = "__NEW_GROUP__";

export const MAX_BULK_FILES = 20;

export const ACCEPTED_MATERIAL_FILE_TYPES =
  ".pdf,.ppt,.pptx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,image/webp";

export function formatBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

/** PDF/PPT → Slides; ảnh → Tài liệu (giữ nguyên quy ước bản cũ, chỉ đổi tên loại đích). */
export function inferTypeFromFilename(filename: string): LessonMaterialType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "webp"].includes(ext) ? "MATERIAL" : "SLIDE";
}

export function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

export function normalizeGroupName(value: string): string {
  return value.trim().toLocaleLowerCase("vi-VN");
}

/** Bộ tài liệu trùng tên (không phân biệt hoa thường), bỏ qua `excludeId` khi đang sửa chính bộ đó; chỉ so trong cùng loại (package type cố định theo bộ). */
export function findDuplicateGroup(groups: readonly LessonMaterialGroup[], type: LessonMaterialType, name: string, excludeId: string | null = null): LessonMaterialGroup | null {
  const key = normalizeGroupName(name);
  if (!key) return null;
  return groups.find((group) => group.id !== excludeId && group.type === type && normalizeGroupName(group.name) === key) ?? null;
}

export function filterGroups(groups: readonly LessonMaterialGroup[], search: string): LessonMaterialGroup[] {
  const term = search.trim().toLowerCase();
  if (!term) return [...groups];
  return groups.filter((group) => group.name.toLowerCase().includes(term));
}

/** Nhãn trạng thái bộ: suy từ publishedVersionId/draftVersionId của package, không có cờ ARCHIVED riêng. */
export function groupStatusLabel(status: LessonMaterialGroup["status"]): string {
  return status === "PUBLISHED" ? "Đã xuất bản" : "Bản nháp";
}

export type BulkUploadStatus = "idle" | "uploading" | "uploaded" | "error";

export interface BulkFileItem {
  file: File;
  title: string;
  type: LessonMaterialType;
  uploadStatus: BulkUploadStatus;
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  errorMessage: string;
}

export function bulkItemFromFile(file: File): BulkFileItem {
  return { file, title: titleFromFilename(file.name), type: inferTypeFromFilename(file.name), uploadStatus: "idle", fileId: "", filename: "", mimeType: "", sizeBytes: 0, errorMessage: "" };
}

/** Thêm tệp vào danh sách hàng loạt, cắt ở MAX_BULK_FILES như bản cũ. */
export function appendBulkFiles(current: readonly BulkFileItem[], files: readonly File[]): BulkFileItem[] {
  return [...current, ...files.slice(0, Math.max(0, MAX_BULK_FILES - current.length)).map(bulkItemFromFile)].slice(0, MAX_BULK_FILES);
}

/** Lỗi tải tệp (trước bước tạo) ghép vào kết quả bulk như bản cũ: errorCode UPLOAD_FAILED. */
export function uploadFailureErrors(items: readonly BulkFileItem[]): BulkItemError[] {
  return items.filter((item) => item.uploadStatus === "error").map((item, index) => ({ index, title: item.title, errorCode: "UPLOAD_FAILED", message: item.errorMessage || "Tải tệp lên thất bại" }));
}
