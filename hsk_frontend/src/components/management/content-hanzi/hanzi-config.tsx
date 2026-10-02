"use client";

// Cấu hình module LUYỆN VIẾT (Hán tự) trên nền content-tree (/writing, mục `words`) — thay cho manage-hanzi.tsx + components/* của HSK cũ
// (features/learning-path/hanziwriter/manage). Nhãn/loại gói lấy nguyên văn i18n `hanzi.manage.*` (vi/hanzi.ts) và PackageTypeConfig của
// package-type-manager.tsx bản hanzi (màu FREE/VIDEO_COURSE khác bản flashcard).
import { HanziWordForm } from "@/components/management/content-hanzi/hanzi-word-form";
import { HanziWordPreview } from "@/components/management/content-hanzi/hanzi-word-preview";
import { emptyHanziInput, hanziSummary, hanziToInput, normalizeHanziInput, parseBulkHanzi, validateHanziInput } from "@/lib/content/hanzi-word";
import type { ContentItemColumn, ContentModuleConfig, ContentPackageTypeMeta } from "@/types/content";
import type { HanziWord } from "@/types/content-writing";

/** Màn chính của mục menu "Quản lý Luyện viết (Hán tự)" (HSK cũ: ManageHanzi tại /hanzi/manage). */
export const HANZI_MANAGE_PATH = "/hanzi/manage";
export const HANZI_CREATE_PACKAGE_PATH = "/hanzi/manage/create-package";

const enc = encodeURIComponent;

/** Thứ tự tab + nhãn/mô tả/màu của PackageTypeConfig bản hanzi (package-type-manager.tsx, i18n hanzi.manage.type.* / typeDesc.*). */
export const WRITING_PACKAGE_TYPES: ContentPackageTypeMeta[] = [
  { value: "LEARNING_PATH", label: "Lộ trình học", description: "Lộ trình học tập chi tiết với các bước cụ thể", icon: "isax isax-path-2", color: "#B00D0E", gradient: "linear-gradient(135deg, #B00D0E 0%, #7A0A0B 100%)" },
  { value: "LEARNING", label: "Khóa học", description: "Khóa học với nội dung bài tập và tài liệu", icon: "isax isax-video", color: "#f093fb", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { value: "VIDEO_COURSE", label: "Khóa học video", description: "Khóa học tập trung vào hướng dẫn viết qua video", icon: "isax isax-play-circle", color: "#860707", gradient: "linear-gradient(135deg, #860707 0%, #5D000D 100%)" },
  { value: "FREE", label: "Học miễn phí", description: "Tài nguyên luyện viết miễn phí", icon: "isax isax-gift", color: "#FFC107", gradient: "linear-gradient(135deg, #FFC107 0%, #FFB300 100%)" },
];

/** Loại gói hợp lệ cho `?type=` của trang chọn loại/tạo gói; giá trị lạ => mặc định FREE như form create-package.tsx cũ. */
export function resolveWritingPackageType(raw: string | null | undefined): string {
  const key = String(raw ?? "").trim().toUpperCase();
  return WRITING_PACKAGE_TYPES.some((t) => t.value === key) ? key : "FREE";
}

const HANZI_COLUMNS: ContentItemColumn<HanziWord>[] = [
  {
    key: "hanzi",
    title: "Chữ Hán",
    render: (word) => (
      <div className="d-flex align-items-center gap-3">
        <span className="hanzi-cell-glyph flashcard-term-cell fw-800 text-dark">{word.hanzi}</span>
        <div>
          <div className="fw-700 text-dark">{word.pinyin || "Chưa có phiên âm"}</div>
          {word.sinoVn && <div className="small text-muted">Hán Việt: {word.sinoVn}</div>}
        </div>
      </div>
    ),
  },
  {
    key: "meaning",
    title: "Nghĩa",
    render: (word) => (
      <>
        <div className="fw-600 text-secondary">{word.meaning || "Chưa có nghĩa"}</div>
        {word.example && <div className="small text-muted mt-1 flashcard-term-cell">VD: {word.example}</div>}
      </>
    ),
  },
  {
    key: "strokes",
    title: "Nét / Bộ thủ",
    width: 130,
    render: (word) => (
      <div className="d-flex flex-column small">
        <span className="text-dark">{typeof word.strokeCount === "number" ? `${word.strokeCount} nét` : "— nét"}</span>
        <span className="text-muted">Bộ {word.radical || "—"}</span>
      </div>
    ),
  },
];

export const WRITING_CONFIG: ContentModuleConfig<HanziWord> = {
  module: "WRITING",
  key: "writing",
  apiPrefix: "/writing",
  itemsPath: "words",
  title: "Quản lý Luyện viết",
  icon: "isax-edit-2",
  pageClassName: "manage-hanzi-page",
  labels: { package: "Package", folder: "Thư mục", studySet: "Bộ học", item: "Chữ" },
  packagesHeader: { title: "Danh sách Gói Luyện viết", subtitle: "Thiết lập các gói, thư mục và bộ học để luyện viết chữ Hán" },
  packageTypes: WRITING_PACKAGE_TYPES,
  // Bản cũ có "Import từ Excel" (2 kiểu: import-package-excel-modal, import-package-direct-modal) + "Tệp mẫu": chưa chuyển, nút chỉ báo toast.
  supportsImport: true,
  itemColumns: HANZI_COLUMNS,
  ItemForm: HanziWordForm,
  emptyItemInput: emptyHanziInput,
  itemToInput: hanziToInput,
  validateItemInput: validateHanziInput,
  normalizeItemInput: normalizeHanziInput,
  itemSummary: hanziSummary,
  ItemPreview: HanziWordPreview,
  parseBulkText: parseBulkHanzi,
  setEditorRoutes: {
    create: (packageId, folderId) => `/hanzi/create?packageId=${enc(packageId)}&folderId=${enc(folderId)}`,
    edit: (studySetId) => `/hanzi/edit/${enc(studySetId)}`,
  },
};
