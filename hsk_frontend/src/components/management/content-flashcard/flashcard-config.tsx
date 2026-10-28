"use client";

// Cấu hình module THẺ GHI NHỚ (/flashcard, mục `cards`) và biến thể BỘ TỪ VỰNG (/vocab-set/manage của HSK cũ: cùng dịch vụ, cùng dữ liệu, khác nhãn/
// tiêu đề, không có thẻ lật — manage-vocabulary-set.tsx là bản sao của manage-flashcard.tsx chỉ đổi chữ). Đây là mẫu để các gói sau thêm module mới
// (quiz, hán tự, ngữ pháp, phát âm): một file config như thế này + một form mục + (tuỳ chọn) cột/xem nhanh.
import { FlashcardCardForm } from "@/components/management/content-flashcard/flashcard-card-form";
import { FlashcardPreview } from "@/components/management/content-flashcard/flashcard-preview";
import { AssetImage } from "@/components/shared/asset-image";
import { fileUrl } from "@/lib/api/storage-client";
import { DEFAULT_PACKAGE_TYPES } from "@/lib/content/content-tree-model";
import { emptyFlashcardInput, flashcardSummary, flashcardToInput, normalizeFlashcardInput, parseBulkCards, validateFlashcardInput } from "@/lib/content/flashcard-card";
import type { ContentItemColumn, ContentModuleConfig } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";

/** Màn chính của mục menu "Thẻ ghi nhớ" (HSK cũ: /flashcard/create-package, cùng component với /flashcard/manage*). */
export const FLASHCARD_MANAGE_PATH = "/flashcard/create-package";

const enc = encodeURIComponent;

function CardThumb({ card }: { card: FlashcardCard }) {
  const url = fileUrl(card.imageFileId);
  if (url) return <AssetImage src={url} alt={card.term} className="rounded-3 border" style={{ width: 40, height: 40, objectFit: "cover" }} />;
  return (
    <div className="rounded-3 border bg-light d-flex align-items-center justify-content-center text-muted" style={{ width: 40, height: 40 }} aria-hidden>
      <i className="isax isax-gallery" />
    </div>
  );
}

const FLASHCARD_COLUMNS: ContentItemColumn<FlashcardCard>[] = [
  {
    key: "term",
    title: "Từ vựng",
    render: (card) => (
      <div className="d-flex align-items-center gap-3">
        <CardThumb card={card} />
        <div>
          <div className="fw-700 text-dark flashcard-term-cell">{card.term}</div>
          <div className="small text-muted">{card.pinyin || "Chưa có pinyin"}</div>
          {card.wordType && <span className="badge bg-primary-subtle text-primary small">{card.wordType}</span>}
        </div>
      </div>
    ),
  },
  {
    key: "meaning",
    title: "Nghĩa",
    render: (card) => (
      <>
        <div className="fw-600 text-secondary">{card.meaning}</div>
        {card.example && <div className="small text-muted mt-1">VD: {card.example}</div>}
      </>
    ),
  },
  {
    key: "media",
    title: "Tệp",
    width: 80,
    render: (card) => (
      <span className="text-muted" title={[card.imageFileId ? "Có ảnh" : "", card.audioFileId ? "Có âm thanh" : ""].filter(Boolean).join(", ") || "Không có tệp"}>
        {card.imageFileId && <i className="isax isax-gallery me-1 text-primary" aria-label="Có ảnh" />}
        {card.audioFileId && <i className="isax isax-volume-high text-primary" aria-label="Có âm thanh" />}
        {!card.imageFileId && !card.audioFileId && "—"}
      </span>
    ),
  },
];

export const FLASHCARD_CONFIG: ContentModuleConfig<FlashcardCard> = {
  module: "FLASHCARD",
  key: "flashcard",
  apiPrefix: "/flashcard",
  itemsPath: "cards",
  title: "Quản lý Flashcards",
  icon: "isax-cards",
  pageClassName: "manage-flashcard-page",
  labels: { package: "Package", folder: "Thư mục", studySet: "Bộ học", item: "Thẻ" },
  packagesHeader: { title: "Quản Lý Packages Flashcard", subtitle: "Tổ chức và quản lý các loại khóa học flashcard của bạn" },
  packageTypes: DEFAULT_PACKAGE_TYPES,
  supportsImport: true,
  itemSearchTab: {
    label: "Quản lý từ vựng",
    icon: "isax-book-1",
    title: "Quản lý từ vựng Flashcard",
    subtitle: "Tìm kiếm và chỉnh sửa nhanh tất cả từ vựng trong các flashcard",
    placeholder: "Tìm theo chữ Hán, Pinyin hoặc nghĩa tiếng Việt...",
  },
  itemColumns: FLASHCARD_COLUMNS,
  ItemForm: FlashcardCardForm,
  emptyItemInput: emptyFlashcardInput,
  itemToInput: flashcardToInput,
  validateItemInput: validateFlashcardInput,
  normalizeItemInput: normalizeFlashcardInput,
  itemSummary: flashcardSummary,
  ItemPreview: FlashcardPreview,
  parseBulkText: parseBulkCards,
  setEditorRoutes: {
    create: (packageId, folderId) => `/sets/create?packageId=${enc(packageId)}&folderId=${enc(folderId)}`,
    edit: (studySetId) => `/sets/${enc(studySetId)}/edit`,
  },
};

export const VOCAB_SET_CONFIG: ContentModuleConfig<FlashcardCard> = {
  ...FLASHCARD_CONFIG,
  key: "vocab-set",
  title: "Quản lý Từ vựng",
  icon: "isax-book-1",
  pageClassName: "manage-vocabulary-page",
  labels: { ...FLASHCARD_CONFIG.labels, studySet: "Bộ từ vựng", item: "Từ" },
  packagesHeader: { title: "Quản lý Bộ Từ vựng", subtitle: "Tổ chức và quản lý các bộ từ vựng của bạn" },
  // Bản từ vựng cũ: không có thẻ lật, chỉ liệt kê danh sách.
  ItemPreview: undefined,
};
