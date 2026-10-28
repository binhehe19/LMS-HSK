// DTO + cấu hình module cho NỀN QUẢN LÝ NỘI DUNG dạng cây "Package → Folder → Study set → mục nội dung" của HSK cũ (7 màn manage-*.tsx cùng mẫu).
// Hợp đồng là ĐỀ XUẤT (kế thừa core/types/flashcard.type.ts, storage.type.ts, learning-path.type.ts của LMS_Frontend; backend chung chưa có) — xem
// docs/api-requirements/content-tree.md. Mục nội dung (thẻ/từ/quiz/điểm ngữ pháp/mục phát âm) là generic: mỗi module khai báo kiểu riêng kế thừa ContentItemBase.
import type { ComponentType, ReactNode } from "react";
import type { ContentModule } from "@/lib/tickets/ticket-access";

export type ContentPublishStatus = "DRAFT" | "PUBLISHED";

export interface ContentPackage {
  id: string;
  name: string;
  description?: string;
  /** Khoá loại gói (FREE, LEARNING_PATH, LEARNING, VIDEO_COURSE...); nhãn/màu do ContentModuleConfig.packageTypes quyết định. */
  type: string;
  publishStatus?: ContentPublishStatus;
  folderCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentPackageInput {
  name: string;
  type: string;
  description?: string;
}

export interface ContentFolder {
  id: string;
  packageId: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  studySetCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentFolderInput {
  packageId: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
}

export interface ContentStudySet {
  id: string;
  folderId: string;
  title: string;
  description?: string;
  isPrivate?: boolean;
  /** Chỉ module có `hasSkill` (quiz: LISTENING/READING/WRITING/SPEAKING). */
  skill?: string;
  itemCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentStudySetInput {
  folderId: string;
  title: string;
  description?: string;
  isPrivate?: boolean;
  skill?: string;
}

/** Phần chung của mọi mục nội dung; module thêm trường riêng (vd thẻ: term/pinyin/meaning). */
export interface ContentItemBase {
  id: string;
  studySetId: string;
  /** Thứ tự trong bộ (cardIndex của HSK cũ). */
  index?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Thân POST/PUT của một mục: mọi trường riêng của module + thứ tự; id/studySetId/thời gian do máy chủ quản lý. */
export type ContentItemInput<TItem extends ContentItemBase> = Omit<TItem, keyof ContentItemBase> & { index?: number };

/** Mục kèm vị trí trong cây (kết quả tìm toàn cây `GET {prefix}/{itemsPath}/search`). */
export type ContentItemWithContext<TItem extends ContentItemBase> = TItem & {
  studySetTitle?: string;
  folderId?: string;
  folderName?: string;
  packageId?: string;
  packageName?: string;
  packageType?: string;
};

export interface ContentPage<T> {
  items: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface ContentPackageTypeMeta {
  value: string;
  label: string;
  description: string;
  /** Class iconsax đầy đủ, vd "isax isax-path-2". */
  icon: string;
  color: string;
  gradient: string;
}

export interface ContentSkillOption {
  value: string;
  label: string;
}

/** Nhãn tiếng Việt của bốn cấp, dùng trong tiêu đề/nút/thông báo của màn dùng chung. */
export interface ContentLabels {
  package: string;
  folder: string;
  studySet: string;
  item: string;
}

export interface ContentItemColumn<TItem extends ContentItemBase> {
  key: string;
  title: string;
  render: (item: TItem) => ReactNode;
  width?: number | string;
}

export interface ContentItemFormProps<TItem extends ContentItemBase> {
  value: ContentItemInput<TItem>;
  onChange: (next: ContentItemInput<TItem>) => void;
  disabled?: boolean;
  /** Tiền tố id cho label/input (một form có thể lặp nhiều lần trên trang sửa bộ). */
  idPrefix: string;
}

/** Đường dẫn trang tạo/sửa một bộ kèm danh sách mục (vd /sets/create, /sets/:id/edit của thẻ ghi nhớ); không có => chỉ dùng modal. */
export interface ContentSetEditorRoutes {
  create: (packageId: string, folderId: string) => string;
  edit: (studySetId: string) => string;
}

/**
 * Cấu hình một module nội dung trên nền content-tree: tiền tố API, tên tài nguyên mục, nhãn, loại gói, cột bảng mục và form mục.
 * Thêm module mới = thêm một file config (xem docs/api-requirements/content-tree.md mục "Thêm module").
 */
export interface ContentModuleConfig<TItem extends ContentItemBase = ContentItemBase> {
  /** Module ticket phân công (quyền Thêm/Sửa/Xoá của giảng viên). */
  module: ContentModule;
  /** Khoá ngắn, duy nhất (khoá tải dữ liệu, data-testid, class). */
  key: string;
  /** Tiền tố dịch vụ sau gốc hskClient, vd "/flashcard". */
  apiPrefix: string;
  /** Tên tài nguyên mục, vd "cards", "words", "quizzes", "grammar-points", "pronunciation-items". */
  itemsPath: string;
  title: string;
  /** Class iconsax (chỉ phần "isax-..." hoặc đầy đủ). */
  icon: string;
  /** Class gắn vào `.content` để SCSS của màn cũ áp dụng (manage-flashcard-page / manage-vocabulary-page...). */
  pageClassName: string;
  labels: ContentLabels;
  /** Tiêu đề/mô tả khối quản lý gói (HSK cũ: "Quản Lý Packages Flashcard" / "Quản lý Bộ Từ vựng"). */
  packagesHeader: { title: string; subtitle: string };
  packageTypes: ContentPackageTypeMeta[];
  hasSkill?: boolean;
  skills?: ContentSkillOption[];
  /** HSK cũ có nút "Nhập Excel" ở cấp gói: hiện nút nhưng chưa chuyển (không thêm thư viện). */
  supportsImport?: boolean;
  /** Tab tìm mục trên toàn cây (`GET {prefix}/{itemsPath}/search?q=`), vd "Quản lý từ vựng". */
  itemSearchTab?: { label: string; icon: string; title: string; subtitle: string; placeholder: string };
  itemColumns: ContentItemColumn<TItem>[];
  ItemForm: ComponentType<ContentItemFormProps<TItem>>;
  emptyItemInput: () => ContentItemInput<TItem>;
  itemToInput: (item: TItem) => ContentItemInput<TItem>;
  /** Thông điệp lỗi hoặc null khi hợp lệ. */
  validateItemInput: (input: ContentItemInput<TItem>) => string | null;
  /** Chuẩn hoá trước khi gửi (cắt khoảng trắng, bỏ trường rỗng). */
  normalizeItemInput: (input: ContentItemInput<TItem>) => ContentItemInput<TItem>;
  /** Tên ngắn của mục (hộp xác nhận xoá, toast). */
  itemSummary: (item: TItem) => string;
  /** Xem nhanh một mục ở cấp mục (vd thẻ lật của flashcard). */
  ItemPreview?: ComponentType<{ item: TItem }>;
  /** Nhập nhanh nhiều mục từ văn bản (mỗi dòng một mục) ở trang sửa bộ. */
  parseBulkText?: (text: string) => ContentItemInput<TItem>[];
  setEditorRoutes?: ContentSetEditorRoutes;
}
