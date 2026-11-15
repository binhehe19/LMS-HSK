// DTO tài liệu học tập — gắn trực tiếp vào ContentPackage/LearningResource có sẵn của repo-lms (type MATERIAL/SLIDE, nội dung SlideMaterialContent),
// cùng cơ chế Kho nội dung Flashcard/Quiz/Ngữ pháp (lms-content-client.ts). Xem docs/api-requirements/lesson-materials.md.

/** Đúng 2 loại thật có backing ở backend (ContentPackageType/LearningResourceType) — không còn GRAMMAR/GRAMMAR_3_0/TEXTBOOK giả. */
export type LessonMaterialType = "SLIDE" | "MATERIAL";

/** Bộ tài liệu = 1 ContentPackage; trạng thái suy từ publishedVersionId/draftVersionId (như Kho Flashcard/Quiz/Ngữ pháp), không có cờ ARCHIVED riêng. */
export type LessonMaterialGroupStatus = "DRAFT" | "PUBLISHED";

export interface LessonMaterialGroup {
  id: string;
  name: string;
  description?: string | null;
  type: LessonMaterialType;
  status: LessonMaterialGroupStatus;
  /** Nguồn của bộ: "Kho HSK" hoặc tên giáo trình thật mà bộ gắn vào. */
  syllabusName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLessonMaterialGroupRequest {
  type: LessonMaterialType;
  name: string;
  description?: string;
}

export interface UpdateLessonMaterialGroupRequest {
  name?: string;
  description?: string;
}

export interface LessonMaterial {
  id: string;
  title: string;
  /** Mã tệp ở repo-storage của backend chung (tải lên bằng storage-client, không gửi byte qua dịch vụ tài liệu). */
  fileId: string;
  filename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  groupId: string;
  displayOrder: number;
}

export interface CreateLessonMaterialRequest {
  title: string;
  fileId: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface BulkItemError {
  index: number;
  title: string;
  errorCode: string;
  message: string;
}

export interface BulkCreateMaterialResult {
  created: LessonMaterial[];
  errors: BulkItemError[];
  totalRequested: number;
  totalCreated: number;
  totalFailed: number;
}
