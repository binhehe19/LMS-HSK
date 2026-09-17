"use client";

// Cấu hình module BÀI TẬP (/quiz, mục `quizzes`) trên nền content-tree — thay cho manage-quiz.tsx của HSK cũ (4 cấp Gói → Thư mục → Bộ đề → Bài tập).
// Cấp thứ 5 (CÂU HỎI) không có trong nền: cột "Câu hỏi" là liên kết sang trình soạn câu hỏi ở CÙNG URL kèm `&quizId=` (giữ reload/back),
// do QuizManagePageContent chuyển hướng hiển thị. Bộ đề có kỹ năng (hasSkill) với QUIZ_SKILL_OPTIONS của bản cũ.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FlatItemsBreadcrumbView } from "@/components/management/content-flat/flat-items-breadcrumb-view";
import { QuizItemForm } from "@/components/management/content-quiz/quiz-item-form";
import type { ContentApiTarget } from "@/lib/api/content-tree-client";
import { emptyQuizInput, normalizeQuizInput, quizDifficultyMeta, QUIZ_SKILLS, quizSkillLabel, quizSummary, quizToInput, validateQuizInput } from "@/lib/content/quiz-item";
import type { ContentItemColumn, ContentModuleConfig, ContentPackageTypeMeta } from "@/types/content";
import type { QuizItem } from "@/types/content-quiz";

export const QUIZ_API_TARGET: ContentApiTarget = { apiPrefix: "/quiz", itemsPath: "quizzes" };

/** PackageTypeConfig của quiz (components/package-type-manager.tsx bản quiz), thứ tự ALL_PACKAGE_TYPES của manage-quiz.tsx. */
export const QUIZ_PACKAGE_TYPES: ContentPackageTypeMeta[] = [
  { value: "LEARNING_PATH", label: "Lộ trình học", description: "Gói học theo lộ trình học tập", icon: "isax isax-path-2", color: "#B00D0E", gradient: "linear-gradient(135deg, #B00D0E 0%, #7A0A0B 100%)" },
  { value: "FREE", label: "Học miễn phí", description: "Tài nguyên học tập miễn phí", icon: "isax isax-gift", color: "#43e97b", gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { value: "LEARNING", label: "Khóa học", description: "Khóa học với nội dung video và tài liệu", icon: "isax isax-video", color: "#f093fb", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { value: "VIDEO_COURSE", label: "Khóa học video", description: "Khóa học video tập trung vào nội dung video", icon: "isax isax-play-circle", color: "#D4AF37", gradient: "linear-gradient(135deg, #D4AF37 0%, #F0CF72 100%)" },
];

/** Tham số URL mở trình soạn câu hỏi của một quiz (cùng trang /quiz/manage). */
export const QUIZ_ID_PARAM = "quizId";

/** Liên kết "Soạn câu hỏi" giữ nguyên vị trí cây hiện tại trong URL và thêm quizId. Là component để dùng được hook điều hướng trong ô bảng. */
function QuizQuestionsLink({ quiz }: { quiz: QuizItem }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const next = new URLSearchParams(params.toString());
  next.set(QUIZ_ID_PARAM, quiz.id);
  const count = quiz.questionCount ?? 0;
  return (
    <div className="d-flex flex-column align-items-start gap-1">
      <span className="text-muted small">
        <i className="isax isax-message-question me-1" />
        {count} câu
      </span>
      <Link href={`${pathname}?${next.toString()}`} prefetch={false} className="btn btn-sm btn-outline-primary rounded-pill" aria-label={`Soạn câu hỏi ${quiz.title}`}>
        <i className="isax isax-edit me-1" />
        Soạn câu hỏi
      </Link>
    </div>
  );
}

const QUIZ_COLUMNS: ContentItemColumn<QuizItem>[] = [
  {
    key: "title",
    title: "Bài tập",
    render: (quiz) => (
      <div className="d-flex align-items-center gap-3">
        <div className="min-width-0">
          <div className="fw-700 text-dark">{quiz.title}</div>
          {quiz.description && <div className="small text-muted text-truncate" style={{ maxWidth: 320 }}>{quiz.description}</div>}
          <span className="badge bg-info-subtle text-info border small">{quiz.skill ? quizSkillLabel(quiz.skill) : "Chưa chọn kỹ năng"}</span>
        </div>
      </div>
    ),
  },
  {
    key: "difficulty",
    title: "Độ khó",
    width: 110,
    render: (quiz) => {
      const meta = quizDifficultyMeta(quiz.difficulty);
      return <span className={`difficulty-badge ${meta.className}`}>{meta.label}</span>;
    },
  },
  {
    key: "duration",
    title: "Thời gian",
    width: 120,
    render: (quiz) => (
      <span className="text-muted small">
        <i className="isax isax-timer-1 me-1" />
        {quiz.durationMinutes && quiz.durationMinutes > 0 ? `${quiz.durationMinutes} phút` : "Không giới hạn"}
      </span>
    ),
  },
  { key: "passing", title: "Điểm đạt", width: 100, render: (quiz) => <span className="text-muted small">{typeof quiz.passingScore === "number" ? `${quiz.passingScore}%` : "—"}</span> },
  { key: "questions", title: "Câu hỏi", width: 150, cardAction: true, render: (quiz) => <QuizQuestionsLink quiz={quiz} /> },
];

export const QUIZ_CONFIG: ContentModuleConfig<QuizItem> = {
  module: "QUIZ",
  key: "quiz",
  apiPrefix: QUIZ_API_TARGET.apiPrefix,
  itemsPath: QUIZ_API_TARGET.itemsPath,
  title: "Quản lý Bài tập",
  icon: "isax-clipboard-text",
  pageClassName: "manage-quiz-page",
  labels: { package: "Package", folder: "Thư mục", studySet: "Bộ đề", item: "Bài tập" },
  packagesHeader: { title: "Quản lý bài tập theo khóa học", subtitle: "Tổ chức và quản lý bài tập" },
  packageTypes: QUIZ_PACKAGE_TYPES,
  hasSkill: true,
  skills: QUIZ_SKILLS,
  supportsImport: true,
  itemColumns: QUIZ_COLUMNS,
  ItemsView: FlatItemsBreadcrumbView,
  ItemForm: QuizItemForm,
  emptyItemInput: emptyQuizInput,
  itemToInput: quizToInput,
  validateItemInput: validateQuizInput,
  normalizeItemInput: normalizeQuizInput,
  itemSummary: quizSummary,
};
