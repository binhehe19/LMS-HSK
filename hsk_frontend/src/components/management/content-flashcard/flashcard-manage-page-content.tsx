"use client";

import { FLASHCARD_CONFIG } from "@/components/management/content-flashcard/flashcard-config";
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
import type { ContentPackageTypeMeta } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";

const FLASHCARD_CLIENT: FlatContentClient<FlashcardCard> = {
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
};

// Backend (ContentPackage) không có khái niệm LEARNING_PATH/LEARNING/VIDEO_COURSE/FREE của HSK cũ — mọi gói flashcard đều là
// ContentPackageType.VOCABULARY, nên ghi đè packageTypes của FLASHCARD_CONFIG (vốn dùng DEFAULT_PACKAGE_TYPES cho ContentTreeManager/mock)
// thành đúng 1 lựa chọn, khoá cứng qua `lockType` ở PackageFormModal.
const VOCABULARY_PACKAGE_TYPE: ContentPackageTypeMeta = {
  value: "VOCABULARY",
  label: "Flashcard",
  description: "Gói thẻ ghi nhớ từ vựng HSK",
  icon: "isax isax-cards",
  color: "#B10019",
  gradient: "linear-gradient(135deg, #B10019 0%, #7A0012 100%)",
};

const FLASHCARD_FLAT_CONFIG = { ...FLASHCARD_CONFIG, packageTypes: [VOCABULARY_PACKAGE_TYPE] };

/** Màn "Quản lý Flashcards" (HSK cũ: ManageFlashcard, dùng chung cho /flashcard/package, /flashcard/manage, /flashcard/manage-learning-path, /flashcard/manage-learning). */
export function FlashcardManagePageContent() {
  return <FlatContentManager config={FLASHCARD_FLAT_CONFIG} client={FLASHCARD_CLIENT} />;
}
