"use client";

import { useSearchParams } from "next/navigation";
import { QUIZ_CONFIG, QUIZ_ID_PARAM } from "@/components/management/content-quiz/quiz-config";
import { QuizQuestionEditorPageContent } from "@/components/management/content-quiz/quiz-question-editor-page-content";
import { FlatContentManager } from "@/components/management/content-flat/flat-content-manager";
import type { FlatContentClient } from "@/components/management/content-flat/use-flat-content";
import { readId } from "@/lib/content/content-tree-params";
import { readFlatLocation } from "@/lib/content/flat-content-params";
import {
  createQuizItem,
  createQuizPackage,
  deleteQuizItem,
  deleteQuizPackage,
  listPackageQuizItems,
  listQuizPackages,
  publishQuizPackage,
  unpublishQuizPackage,
  updateQuizItem,
  updateQuizPackage,
} from "@/lib/api/lms-quiz-client";
import { packageTopicsClient } from "@/lib/api/package-topics-client";
import type { ContentPackageTypeMeta } from "@/types/content";
import type { QuizItem } from "@/types/content-quiz";

// Backend (ContentPackage) không có khái niệm LEARNING_PATH/LEARNING/VIDEO_COURSE/FREE của HSK cũ — mọi gói bài tập đều là
// ContentPackageType.ASSESSMENT, nên ghi đè packageTypes của QUIZ_CONFIG thành đúng 1 lựa chọn (theo đúng mẫu Flashcard/Grammar).
const QUIZ_PACKAGE_TYPE: ContentPackageTypeMeta = {
  value: "ASSESSMENT",
  label: "Bài tập",
  description: "Gói bài tập HSK",
  icon: "isax isax-clipboard-text",
  color: "#B10019",
  gradient: "linear-gradient(135deg, #B10019 0%, #7A0012 100%)",
};

const QUIZ_FLAT_CONFIG = { ...QUIZ_CONFIG, packageTypes: [QUIZ_PACKAGE_TYPE] };

const QUIZ_CLIENT: FlatContentClient<QuizItem> = {
  listPackages: listQuizPackages,
  createPackage: createQuizPackage,
  updatePackage: updateQuizPackage,
  deletePackage: deleteQuizPackage,
  publishPackage: publishQuizPackage,
  unpublishPackage: unpublishQuizPackage,
  listItems: listPackageQuizItems,
  createItem: createQuizItem,
  updateItem: updateQuizItem,
  deleteItem: deleteQuizItem,
  topics: packageTopicsClient,
};

/**
 * Màn "Quản lý Bài tập" (/quiz/manage, ManageQuiz của HSK cũ) trên nền phẳng (Package → Bài tập), nối repo-lms thật.
 * Khi URL có `quizId` hợp lệ (và đã ở trong một gói) thì hiện trình soạn câu hỏi ở cùng đường dẫn — câu hỏi nằm trong
 * content của resource (QuizContent.questions), không phải một cấp URL/API riêng như bản cây cũ.
 */
export function QuizManagePageContent() {
  const params = useSearchParams();
  const quizId = readId(params.get(QUIZ_ID_PARAM));
  const location = readFlatLocation(params);
  if (quizId && location.packageId) return <QuizQuestionEditorPageContent packageId={location.packageId} quizId={quizId} />;
  return <FlatContentManager config={QUIZ_FLAT_CONFIG} client={QUIZ_CLIENT} />;
}
