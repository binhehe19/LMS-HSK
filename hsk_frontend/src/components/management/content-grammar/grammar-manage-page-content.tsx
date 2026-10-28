"use client";

import { GRAMMAR_CONFIG } from "@/components/management/content-grammar/grammar-config";
import { ContentTreeManager } from "@/components/management/content-tree/content-tree-manager";

/** Màn "Quản lý Ngữ pháp" (/grammar/manage, ManageGrammar của HSK cũ) trên nền content-tree. */
export function GrammarManagePageContent() {
  return <ContentTreeManager config={GRAMMAR_CONFIG} />;
}
