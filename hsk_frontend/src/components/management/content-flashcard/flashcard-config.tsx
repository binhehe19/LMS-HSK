"use client";

// Cấu hình module THẺ GHI NHỚ (/flashcard, mục `cards`) và biến thể BỘ TỪ VỰNG (/vocab-set/manage của HSK cũ: cùng dịch vụ, cùng dữ liệu, khác nhãn/
// tiêu đề, không có thẻ lật — manage-vocabulary-set.tsx là bản sao của manage-flashcard.tsx chỉ đổi chữ). Đây là mẫu để các gói sau thêm module mới
// (quiz, hán tự, ngữ pháp, phát âm): một file config như thế này + một form mục + (tuỳ chọn) cột/xem nhanh.
import { useRef } from "react";
import { DictionaryWordPickerModal } from "@/components/management/content-flashcard/dictionary-word-picker-modal";
import { FlashcardCardForm } from "@/components/management/content-flashcard/flashcard-card-form";
import { FlashcardPreview } from "@/components/management/content-flashcard/flashcard-preview";
import { AssetImage } from "@/components/shared/asset-image";
import { fileUrl } from "@/lib/api/storage-client";
import { DEFAULT_PACKAGE_TYPES } from "@/lib/content/content-tree-model";
import { emptyFlashcardInput, flashcardSummary, flashcardToInput, normalizeFlashcardInput, parseBulkCards, validateFlashcardInput } from "@/lib/content/flashcard-card";
import type { ContentItemColumn, ContentModuleConfig } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";

/** Màn chính của mục menu "Thẻ ghi nhớ" (HSK cũ: /flashcard/package, cùng component với /flashcard/manage*). */
export const FLASHCARD_MANAGE_PATH = "/flashcard/package";

const enc = encodeURIComponent;

function CardThumb({ card }: { card: FlashcardCard }) {
  const url = fileUrl(card.imageFileId);
  if (!url) return null;
  return <AssetImage src={url} alt={card.term} className="rounded-3 border flex-shrink-0" style={{ width: 40, height: 40, objectFit: "cover" }} />;
}

/** Nút phát âm tròn của hàng (port .flashcard-manage-audio-btn cũ, dùng chung tệp đã tải lên hoặc Web Speech API zh-CN như FlashcardPreview). */
function RowAudioButton({ card }: { card: FlashcardCard }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audio = fileUrl(card.audioFileId);

  const speak = () => {
    if (audio && audioRef.current) {
      void audioRef.current.play().catch(() => undefined);
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(card.term);
    utterance.lang = "zh-CN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      <button type="button" className="flashcard-manage-audio-btn" style={{ width: 36, height: 36, minWidth: 36 }} onClick={speak} title="Phát âm" aria-label={`Phát âm ${card.term}`}>
        <i className="isax isax-volume-high" style={{ fontSize: "1rem" }} />
      </button>
      {audio && <audio ref={audioRef} src={audio} preload="none" />}
    </>
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
          <div className="fw-semibold text-dark flashcard-term-cell">{card.term}</div>
          <div className="text-muted">{card.pinyin || "Chưa có pinyin"}</div>
          {card.wordType && <div className="small text-muted">{card.wordType}</div>}
        </div>
      </div>
    ),
  },
  {
    key: "meaning",
    title: "Nghĩa",
    render: (card) => (card.meaning || card.example) && (
      <>
        <div className="fw-700" style={{ color: "#D4AF37" }}>
          {card.meaning}
        </div>
        {card.example && (
          <div className="small text-muted mt-1">
            VD: {card.example}
            {card.exampleMeaning && <span> ({card.exampleMeaning})</span>}
          </div>
        )}
      </>
    ),
  },
  {
    key: "audio",
    title: "Phát âm",
    cardAction: true,
    width: 90,
    render: (card) => <RowAudioButton card={card} />,
  },
];

export const FLASHCARD_CONFIG: ContentModuleConfig<FlashcardCard> = {
  module: "FLASHCARD",
  key: "flashcard",
  apiPrefix: "/flashcard",
  itemsPath: "cards",
  title: "Quản lý Thẻ ghi nhớ",
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
  // Thêm từ bằng cách chọn từ Từ điển (bản sao có nguồn), không nhập tay từng thẻ.
  ItemPicker: DictionaryWordPickerModal,
};
