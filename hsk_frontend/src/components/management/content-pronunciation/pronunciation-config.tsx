"use client";

// Cấu hình module LUYỆN PHÁT ÂM trên nền content-tree (/pronunciation, mục `pronunciation-items`) — thay cho manage-pronunciation.tsx (2.359 dòng) +
// pronunciation-package-manager.tsx của HSK cũ: chỉ chuyển phần cây gói → thư mục → bộ → mục + form mục có tải âm thanh/ảnh. Nhãn/loại gói lấy
// nguyên văn PackageTypeConfig của pronunciation-package-manager.tsx. Không có tab "thống kê" hay "kiểm thử phát âm" trong bản cũ (chỉ Import Excel).
import { PronunciationItemForm } from "@/components/management/content-pronunciation/pronunciation-item-form";
import { PronunciationItemPreview } from "@/components/management/content-pronunciation/pronunciation-item-preview";
import { AssetImage } from "@/components/shared/asset-image";
import { fileUrl } from "@/lib/api/storage-client";
import { emptyPronunciationInput, normalizePronunciationInput, pronunciationSummary, pronunciationToInput, validatePronunciationInput } from "@/lib/content/pronunciation-item";
import type { ContentItemColumn, ContentModuleConfig, ContentPackageTypeMeta } from "@/types/content";
import type { PronunciationItem } from "@/types/content-pronunciation";

/** Màn chính của mục menu "Quản lý Luyện Phát âm" (HSK cũ: ManagePronunciation tại /pronunciation/manage). */
export const PRONUNCIATION_MANAGE_PATH = "/pronunciation/manage";

/** Thứ tự tab + nhãn/mô tả/màu của PackageTypeConfig bản phát âm (pronunciation-package-manager.tsx). */
export const PRONUNCIATION_PACKAGE_TYPES: ContentPackageTypeMeta[] = [
  { value: "LEARNING_PATH", label: "Lộ trình học", description: "Lộ trình học phát âm theo từng bước", icon: "isax isax-path-2", color: "#B10019", gradient: "linear-gradient(135deg, #B10019 0%, #7A0012 100%)" },
  { value: "FREE", label: "Học miễn phí", description: "Nội dung phát âm miễn phí", icon: "isax isax-gift", color: "#43e97b", gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { value: "LEARNING", label: "Khóa học", description: "Khóa học phát âm có cấu trúc", icon: "isax isax-video", color: "#f093fb", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { value: "VIDEO_COURSE", label: "Khóa học video", description: "Luyện phát âm theo bài học video", icon: "isax isax-play-circle", color: "#D4AF37", gradient: "linear-gradient(135deg, #D4AF37 0%, #F0CF72 100%)" },
];

function MouthThumb({ item }: { item: PronunciationItem }) {
  const url = fileUrl(item.imageFileId);
  if (!url) return null;
  return <AssetImage src={url} alt={`Hình miệng ${item.text}`} className="rounded-3 border" style={{ width: 40, height: 40, objectFit: "cover" }} />;
}

/** Cột của bảng mục cũ (Ký hiệu, Pinyin, Ví dụ/hướng dẫn, media) gom lại cho DataTable dùng chung. */
const PRONUNCIATION_COLUMNS: ContentItemColumn<PronunciationItem>[] = [
  {
    key: "text",
    title: "Ký hiệu / Từ",
    render: (item) => (
      <div className="d-flex align-items-center gap-3">
        <MouthThumb item={item} />
        <div>
          <span className="fw-bold text-primary flashcard-term-cell" style={{ fontSize: "1.15rem" }}>
            {item.text}
          </span>
          <div className="fw-medium text-dark small">{item.pinyin || "—"}</div>
        </div>
      </div>
    ),
  },
  {
    key: "tip",
    title: "Hướng dẫn phát âm",
    render: (item) => (item.tip ? <span className="text-secondary pronunciation-tip-cell" title={item.tip}>{item.tip}</span> : <span className="text-muted small">---</span>),
  },
  {
    key: "media",
    title: "Tệp",
    width: 80,
    render: (item) => (
      <span className="text-muted" title={[item.audioFileId ? "Có âm thanh" : "", item.imageFileId ? "Có hình miệng" : ""].filter(Boolean).join(", ") || "Không có tệp"}>
        {item.audioFileId && <i className="isax isax-volume-high me-1 text-primary" aria-label="Có âm thanh" />}
        {item.imageFileId && <i className="isax isax-gallery text-primary" aria-label="Có hình miệng" />}
        {!item.audioFileId && !item.imageFileId && "—"}
      </span>
    ),
  },
];

export const PRONUNCIATION_CONFIG: ContentModuleConfig<PronunciationItem> = {
  module: "PRONUNCIATION",
  key: "pronunciation",
  apiPrefix: "/pronunciation",
  itemsPath: "pronunciation-items",
  title: "Quản lý Phát âm",
  icon: "isax-microphone-2",
  pageClassName: "manage-pronunciation-page",
  labels: { package: "Package", folder: "Thư mục", studySet: "Bộ học", item: "Mục phát âm" },
  packagesHeader: { title: "Quản lý Phát âm", subtitle: "Quản lý toàn bộ nội dung luyện phát âm tiếng Trung" },
  packageTypes: PRONUNCIATION_PACKAGE_TYPES,
  // Bản cũ có modal "Import Excel" (POST /pronunciation/packages/import-excel): chưa chuyển, nút chỉ báo toast.
  supportsImport: true,
  itemColumns: PRONUNCIATION_COLUMNS,
  ItemForm: PronunciationItemForm,
  emptyItemInput: emptyPronunciationInput,
  itemToInput: pronunciationToInput,
  validateItemInput: validatePronunciationInput,
  normalizeItemInput: normalizePronunciationInput,
  itemSummary: pronunciationSummary,
  ItemPreview: PronunciationItemPreview,
  // Bản cũ không có trang tạo/sửa bộ kèm mục (chỉ modal trong cây) => không có setEditorRoutes / parseBulkText.
};
