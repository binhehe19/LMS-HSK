// Hàm thuần của màn Quản lý tài liệu học tập (lesson-material-management-page.tsx + lesson-materials.const.ts cũ): nhãn, thứ tự loại, hành động
// vòng đời theo trạng thái, suy loại từ đuôi tệp, kiểm tra trùng tên bộ, đếm theo loại, định dạng dung lượng.
import type { BulkItemError, GroupedLessonMaterials, LessonMaterial, LessonMaterialCategory, LessonMaterialGroup, LessonMaterialStatus, LessonMaterialType } from "@/types/lesson-materials";

export const LESSON_MATERIAL_CATEGORY_LABELS: Record<LessonMaterialCategory, string> = { LESSON: "Buổi học", COURSE: "Khóa học" };

export const LESSON_MATERIAL_TYPE_LABELS: Record<LessonMaterialType, string> = { SLIDE: "Slides", GRAMMAR: "Ngữ pháp", GRAMMAR_3_0: "Ngữ pháp 3.0", TEXTBOOK: "Giáo trình" };

export const LESSON_MATERIAL_STATUS_LABELS: Record<LessonMaterialStatus, string> = { DRAFT: "Bản nháp", PUBLISHED: "Đã xuất bản", ARCHIVED: "Đã lưu trữ" };

export const LESSON_MATERIAL_TYPES_BY_CATEGORY: Record<LessonMaterialCategory, LessonMaterialType[]> = { LESSON: ["SLIDE", "GRAMMAR", "GRAMMAR_3_0"], COURSE: ["TEXTBOOK"] };

export const LESSON_MATERIAL_TYPE_ORDER: LessonMaterialType[] = ["SLIDE", "GRAMMAR", "GRAMMAR_3_0", "TEXTBOOK"];

export const LESSON_MATERIAL_CATEGORY_ORDER: LessonMaterialCategory[] = ["LESSON", "COURSE"];

export type MaterialDetailTab = "ALL" | LessonMaterialType;

export const MATERIAL_DETAIL_TABS: MaterialDetailTab[] = ["ALL", "SLIDE", "GRAMMAR", "GRAMMAR_3_0", "TEXTBOOK"];

/** Giá trị đặc biệt của ô chọn "Bộ tài liệu" trong form: "" = Chưa phân loại; NEW_GROUP = tạo bộ mới. */
export const NEW_GROUP = "__NEW_GROUP__";

export const MAX_BULK_FILES = 20;

export const ACCEPTED_MATERIAL_FILE_TYPES =
  ".pdf,.ppt,.pptx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,image/webp";

export interface LifecycleAction {
  status: LessonMaterialStatus;
  label: string;
  icon: string;
  /** Class nút Bootstrap (bản cũ: variant của react-bootstrap Button). */
  buttonClass: string;
}

export function getLifecycleActions(status: LessonMaterialStatus): LifecycleAction[] {
  switch (status) {
    case "DRAFT":
      return [
        { status: "PUBLISHED", label: "Xuất bản", icon: "isax-tick-circle", buttonClass: "btn-outline-success" },
        { status: "ARCHIVED", label: "Lưu trữ", icon: "isax-archive-2", buttonClass: "btn-outline-danger" },
      ];
    case "PUBLISHED":
      return [
        { status: "DRAFT", label: "Chuyển về nháp", icon: "isax-edit-2", buttonClass: "btn-outline-secondary" },
        { status: "ARCHIVED", label: "Lưu trữ", icon: "isax-archive-2", buttonClass: "btn-outline-danger" },
      ];
    case "ARCHIVED":
      return [{ status: "DRAFT", label: "Khôi phục nháp", icon: "isax-refresh", buttonClass: "btn-outline-secondary" }];
    default:
      return [];
  }
}

export function formatBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

/** PDF/PPT → Slides; ảnh → Ngữ pháp (như bản cũ). */
export function inferTypeFromFilename(filename: string): LessonMaterialType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "webp"].includes(ext) ? "GRAMMAR" : "SLIDE";
}

export function inferCategoryFromType(type: LessonMaterialType): LessonMaterialCategory {
  return type === "TEXTBOOK" ? "COURSE" : "LESSON";
}

export function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

export function normalizeGroupName(value: string): string {
  return value.trim().toLocaleLowerCase("vi-VN");
}

/** Bộ tài liệu trùng tên (không phân biệt hoa thường), bỏ qua `excludeId` khi đang sửa chính bộ đó. */
export function findDuplicateGroup(groups: readonly LessonMaterialGroup[], name: string, excludeId: string | null = null): LessonMaterialGroup | null {
  const key = normalizeGroupName(name);
  if (!key) return null;
  return groups.find((group) => group.id !== excludeId && normalizeGroupName(group.name) === key) ?? null;
}

export function filterGroups(groups: readonly LessonMaterialGroup[], search: string): LessonMaterialGroup[] {
  const term = search.trim().toLowerCase();
  if (!term) return [...groups];
  return groups.filter((group) => group.name.toLowerCase().includes(term));
}

export function materialsOfGroup(materials: readonly LessonMaterial[], groupId: string | null): LessonMaterial[] {
  return materials.filter((m) => (groupId === null ? !m.groupId : m.groupId === groupId));
}

export function countByType(materials: readonly LessonMaterial[], type: LessonMaterialType): number {
  return materials.filter((m) => m.type === type).length;
}

/** "Ngữ pháp" trên card bộ gồm cả Ngữ pháp 3.0 (bản cũ). */
export function countGrammarFamily(materials: readonly LessonMaterial[]): number {
  return materials.filter((m) => m.type === "GRAMMAR" || m.type === "GRAMMAR_3_0").length;
}

/** Danh sách phẳng theo thứ tự loại chuẩn từ phản hồi GET /groups/{id}/materials. */
export function flattenGroupedMaterials(grouped: GroupedLessonMaterials | null | undefined): LessonMaterial[] {
  const byType = grouped?.materialsByType ?? {};
  return LESSON_MATERIAL_TYPE_ORDER.flatMap((type) => byType[type] ?? []);
}

export function filterMaterialsByTab(materials: readonly LessonMaterial[], tab: MaterialDetailTab): LessonMaterial[] {
  return tab === "ALL" ? [...materials] : materials.filter((m) => m.type === tab);
}

export function materialDetailTabLabel(tab: MaterialDetailTab): string {
  return tab === "ALL" ? "Tất cả" : LESSON_MATERIAL_TYPE_LABELS[tab];
}

/** Thông điệp lỗi của bản cũ cho mã lỗi trùng tên/chuyển trạng thái sai của dịch vụ tài liệu. */
export function isDuplicateGroupError(status: number | undefined, errorCode: string | undefined): boolean {
  return status === 409 || errorCode === "LESSON_MATERIAL_GROUP_DUPLICATE_NAME";
}

export function isInvalidTransitionError(status: number | undefined, errorCode: string | undefined): boolean {
  return status === 409 || errorCode === "LESSON_MATERIAL_INVALID_STATUS_TRANSITION";
}

export type BulkUploadStatus = "idle" | "uploading" | "uploaded" | "error";

export interface BulkFileItem {
  file: File;
  title: string;
  type: LessonMaterialType;
  category: LessonMaterialCategory;
  uploadStatus: BulkUploadStatus;
  fileId: string;
  errorMessage: string;
}

export function bulkItemFromFile(file: File): BulkFileItem {
  const type = inferTypeFromFilename(file.name);
  return { file, title: titleFromFilename(file.name), type, category: inferCategoryFromType(type), uploadStatus: "idle", fileId: "", errorMessage: "" };
}

/** Thêm tệp vào danh sách hàng loạt, cắt ở MAX_BULK_FILES như bản cũ. */
export function appendBulkFiles(current: readonly BulkFileItem[], files: readonly File[]): BulkFileItem[] {
  return [...current, ...files.slice(0, Math.max(0, MAX_BULK_FILES - current.length)).map(bulkItemFromFile)].slice(0, MAX_BULK_FILES);
}

/** Lỗi tải tệp (trước bước tạo) ghép vào kết quả bulk như bản cũ: errorCode UPLOAD_FAILED. */
export function uploadFailureErrors(items: readonly BulkFileItem[]): BulkItemError[] {
  return items.filter((item) => item.uploadStatus === "error").map((item, index) => ({ index, title: item.title, errorCode: "UPLOAD_FAILED", message: item.errorMessage || "Tải tệp lên thất bại" }));
}
