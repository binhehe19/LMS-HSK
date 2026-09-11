"use client";

import { VOCAB_SET_CONFIG } from "@/components/management/content-flashcard/flashcard-config";
import { FlatContentManager } from "@/components/management/content-flat/flat-content-manager";
import type { FlatContentClient } from "@/components/management/content-flat/use-flat-content";
import {
  createFlashcardItem,
  createFlashcardPackage,
  deleteFlashcardItem,
  deleteFlashcardPackage,
  listFlashcardPackages,
  listPackageItems,
  publishFlashcardPackage,
  unpublishFlashcardPackage,
  updateFlashcardItem,
  updateFlashcardPackage,
} from "@/lib/api/lms-content-client";
import { packageTopicsClient } from "@/lib/api/package-topics-client";
import type { ContentPackageTypeMeta } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";

// Cùng dịch vụ/dữ liệu với Flashcard (ContentPackageType.VOCABULARY, VocabularyContent) — "Quản lý Từ vựng" chỉ là nhãn/tiêu đề khác, không
// phải module backend riêng (xem flashcard-config.tsx: VOCAB_SET_CONFIG = {...FLASHCARD_CONFIG, nhãn khác, không thẻ lật}).
const VOCAB_SET_CLIENT: FlatContentClient<FlashcardCard> = {
  listPackages: listFlashcardPackages,
  createPackage: createFlashcardPackage,
  updatePackage: updateFlashcardPackage,
  deletePackage: deleteFlashcardPackage,
  publishPackage: publishFlashcardPackage,
  unpublishPackage: unpublishFlashcardPackage,
  listItems: listPackageItems,
  createItem: createFlashcardItem,
  updateItem: updateFlashcardItem,
  deleteItem: deleteFlashcardItem,
  topics: packageTopicsClient,
};

const VOCABULARY_PACKAGE_TYPE: ContentPackageTypeMeta = {
  value: "VOCABULARY",
  label: "Từ vựng",
  description: "Gói từ vựng HSK",
  icon: "isax isax-book-1",
  color: "#B00D0E",
  gradient: "linear-gradient(135deg, #B00D0E 0%, #7A0A0B 100%)",
};

const VOCAB_SET_FLAT_CONFIG = { ...VOCAB_SET_CONFIG, packageTypes: [VOCABULARY_PACKAGE_TYPE] };

/** Màn "Quản lý Từ vựng" /vocab-set/manage (HSK cũ: ManageVocabularySet — cùng dịch vụ /flashcard, khác nhãn). */
export function VocabSetManagePageContent() {
  return <FlatContentManager config={VOCAB_SET_FLAT_CONFIG} client={VOCAB_SET_CLIENT} />;
}
