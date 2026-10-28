// DTO tài liệu học tập theo HỢP ĐỒNG ĐỀ XUẤT kế thừa `/lesson-materials/*` của HSK cũ (core/types/lesson-materials.type.ts), chỉ phần màn
// `/learning-path/lesson-materials/manage` dùng (bộ tài liệu + tài liệu + tạo hàng loạt + đổi trạng thái). Phần gắn tài liệu vào buổi/khoá
// (attachments) chưa chuyển vì màn quản lý cũ không có giao diện cho nó.

export type LessonMaterialCategory = "LESSON" | "COURSE";

export type LessonMaterialType = "SLIDE" | "GRAMMAR" | "GRAMMAR_3_0" | "TEXTBOOK";

export type LessonMaterialStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type LessonMaterialGroupStatus = "ACTIVE" | "ARCHIVED";

export interface LessonMaterialGroup {
  id: string;
  name: string;
  description?: string | null;
  displayOrder?: number | null;
  status: LessonMaterialGroupStatus;
  slideCount?: number | null;
  grammarCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLessonMaterialGroupRequest {
  name: string;
  description?: string;
}

export interface UpdateLessonMaterialGroupRequest {
  name?: string;
  description?: string;
  displayOrder?: number;
  status?: LessonMaterialGroupStatus;
}

export interface LessonMaterial {
  id: string;
  title: string;
  description?: string | null;
  type: LessonMaterialType;
  category: LessonMaterialCategory;
  status: LessonMaterialStatus;
  groupId?: string | null;
  /** Mã tệp ở repo-storage của backend chung (tải lên bằng storage-client, không gửi byte qua dịch vụ tài liệu). */
  fileId: string;
  filename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLessonMaterialRequest {
  title: string;
  description?: string;
  category: LessonMaterialCategory;
  type: LessonMaterialType;
  fileId: string;
  groupId?: string;
}

export interface GroupedLessonMaterials {
  group: LessonMaterialGroup;
  materialsByType: Partial<Record<LessonMaterialType, LessonMaterial[]>>;
}

export interface UpdateLessonMaterialStatusRequest {
  status: LessonMaterialStatus;
}

export interface LessonMaterialQuery {
  keyword?: string;
  category?: LessonMaterialCategory;
  type?: LessonMaterialType;
  status?: LessonMaterialStatus;
  groupId?: string;
  page?: number;
  size?: number;
  sort?: string;
}

/** Spring Page như HSK cũ (`number` = trang hiện tại từ 0). */
export interface LessonMaterialPage {
  content: LessonMaterial[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface BulkItemError {
  index: number;
  title: string;
  errorCode: string;
  message: string;
}

export interface BulkCreateMaterialResult {
  created: LessonMaterial[];
  errors: BulkItemError[] | null;
  totalRequested: number;
  totalCreated: number;
  totalFailed: number;
}
