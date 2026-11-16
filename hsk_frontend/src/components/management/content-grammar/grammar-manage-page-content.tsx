"use client";

import { GRAMMAR_CONFIG } from "@/components/management/content-grammar/grammar-config";
import { FlatContentManager } from "@/components/management/content-flat/flat-content-manager";
import type { FlatContentClient } from "@/components/management/content-flat/use-flat-content";
import {
  createGrammarItem,
  createGrammarPackage,
  deleteGrammarItem,
  deleteGrammarPackage,
  listGrammarPackages,
  listPackageGrammarPoints,
  publishGrammarPackage,
  unpublishGrammarPackage,
  updateGrammarItem,
  updateGrammarPackage,
} from "@/lib/api/lms-grammar-client";
import { packageTopicsClient } from "@/lib/api/package-topics-client";
import type { ContentPackageTypeMeta } from "@/types/content";
import type { GrammarPoint } from "@/types/content-grammar";

// Backend (ContentPackage) không có khái niệm LEARNING_PATH/LEARNING/VIDEO_COURSE/FREE của HSK cũ — mọi gói ngữ pháp đều là
// ContentPackageType.GRAMMAR, nên ghi đè packageTypes của GRAMMAR_CONFIG (vốn dùng GRAMMAR_PACKAGE_TYPES cho ContentTreeManager/mock)
// thành đúng 1 lựa chọn, khoá cứng qua `lockType` ở PackageFormModal (theo đúng mẫu đã làm cho Flashcard).
const GRAMMAR_PACKAGE_TYPE: ContentPackageTypeMeta = {
  value: "GRAMMAR",
  label: "Ngữ pháp",
  description: "Gói điểm ngữ pháp HSK",
  icon: "isax isax-book-1",
  color: "#B10019",
  gradient: "linear-gradient(135deg, #B10019 0%, #7A0012 100%)",
};

const GRAMMAR_FLAT_CONFIG = { ...GRAMMAR_CONFIG, packageTypes: [GRAMMAR_PACKAGE_TYPE] };

const GRAMMAR_CLIENT: FlatContentClient<GrammarPoint> = {
  listPackages: listGrammarPackages,
  createPackage: createGrammarPackage,
  updatePackage: updateGrammarPackage,
  deletePackage: deleteGrammarPackage,
  publishPackage: publishGrammarPackage,
  unpublishPackage: unpublishGrammarPackage,
  listItems: listPackageGrammarPoints,
  createItem: createGrammarItem,
  updateItem: updateGrammarItem,
  deleteItem: deleteGrammarItem,
  topics: packageTopicsClient,
};

/** Màn "Quản lý Ngữ pháp" (/grammar/manage, ManageGrammar của HSK cũ) trên nền phẳng (Package → Điểm ngữ pháp), nối repo-lms thật. */
export function GrammarManagePageContent() {
  return <FlatContentManager config={GRAMMAR_FLAT_CONFIG} client={GRAMMAR_CLIENT} />;
}
