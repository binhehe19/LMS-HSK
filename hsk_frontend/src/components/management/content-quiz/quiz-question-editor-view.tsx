"use client";

// Cấp CÂU HỏI (level "questions" của manage-quiz.tsx cũ): tiêu đề "Câu hỏi — {quiz}", khối audio/ảnh/đoạn văn đọc của quiz, danh sách câu hỏi.
// View thuần, cùng khung `.card.manage-lp-container` + breadcrumb của nền content-tree để chuyển giữa cây và trình soạn không đổi bố cục.
// Khác bản cũ có chủ đích: breadcrumb là liên kết URL thật (reload/back đúng chỗ); lỗi tải là khối thông báo; nút ghi ẩn khi không có quyền.
import { Alert } from "antd";
import Link from "next/link";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { QuizQuestionList } from "@/components/management/content-quiz/quiz-question-list";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { AssetImage } from "@/components/shared/asset-image";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import type { ContentAccess } from "@/hooks/use-content-access";
import { fileUrl } from "@/lib/api/storage-client";
import { quizDifficultyMeta, quizSkillLabel } from "@/lib/content/quiz-item";
import type { QuizItem, QuizQuestion } from "@/types/content-quiz";

export interface QuizQuestionEditorViewProps {
  /** Trạng thái tải chung (quiz + câu hỏi cùng nằm trong 1 content, tải chung 1 lần). */
  state: FetchState<{ item: QuizItem; questions: QuizQuestion[]; packageName: string }>;
  quiz: QuizItem | null;
  questions: QuizQuestion[];
  /** Tên gói cha cho breadcrumb (null khi chưa tải). */
  packageName: string | null;
  access: ContentAccess;
  writeEnabled: boolean;
  canWrite: boolean;
  busy: boolean;
  /** Về gốc ("Quản lý Bài tập"). */
  rootHref: string;
  /** Về cấp Bài tập của gói. */
  backHref: string;
  onAdd: () => void;
  onEdit: (q: QuizQuestion) => void;
  onDelete: (q: QuizQuestion) => void;
  onRetry: () => void;
}

function QuizMedia({ quiz }: { quiz: QuizItem }) {
  const audio = fileUrl(quiz.audioFileId);
  const image = fileUrl(quiz.passageImageFileId);
  const unavailable = (quiz.audioFileId && !audio) || (quiz.passageImageFileId && !image);
  if (!quiz.audioFileId && !quiz.passageImageFileId && !quiz.passageText) return null;
  return (
    <div className="mb-4 p-3 rounded-4 bg-light border shadow-sm" data-testid="quiz-media">
      {unavailable && <div className="small text-muted mb-2">Kho lưu trữ chưa được cấu hình: không hiển thị được tệp đính kèm.</div>}
      {audio && (
        <div className="mb-3">
          <span className="small fw-800 text-secondary d-block mb-1">
            <i className="isax isax-volume-high me-1 text-primary" /> Audio bài nghe:
          </span>
          <audio controls src={audio} preload="none" className="w-100" />
        </div>
      )}
      {image && (
        <div className="mb-3">
          <span className="small fw-800 text-secondary d-block mb-1">
            <i className="isax isax-gallery me-1 text-primary" /> Ảnh đoạn văn đọc:
          </span>
          <AssetImage src={image} alt="Ảnh đoạn văn đọc" className="img-fluid rounded-3 border d-block mb-1 shadow-sm" style={{ maxHeight: 200, objectFit: "contain" }} />
        </div>
      )}
      {quiz.passageText && (
        <div>
          <span className="small fw-800 text-secondary d-block mb-1">
            <i className="isax isax-textalign-justifyleft me-1 text-primary" /> Đoạn văn đọc:
          </span>
          <div className="text-muted bg-white p-3 rounded-3 border small" style={{ whiteSpace: "pre-wrap" }}>
            {quiz.passageText}
          </div>
        </div>
      )}
    </div>
  );
}

export function QuizQuestionEditorView({ state, quiz, questions, packageName, access, writeEnabled, canWrite, busy, rootHref, backHref, onAdd, onEdit, onDelete, onRetry }: QuizQuestionEditorViewProps) {
  const notice = state.kind === "waiting" || state.kind === "error";
  const difficulty = quizDifficultyMeta(quiz?.difficulty);

  return (
    <ManagementPageFrame contentClassName="manage-quiz-page content-tree-page">
      <div className="card manage-lp-container border-0 shadow-sm" data-testid="quiz-question-editor">
        <div className="manage-lp-header px-4 pt-4 border-0">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="section-title mb-0 fw-800">
              <i className="isax isax-clipboard-text me-2 text-primary" />
              Quản lý Bài tập
            </h5>
          </div>

          {access.status !== "loading" && !access.canManage && (
            <div className="mb-3">
              <Alert message="Chế độ Xem duy nhất" description="Bạn hiện không có Ticket được cấp cho Module này. Bạn vẫn có thể xem các nội dung nhưng không thể Thêm, Sửa hoặc Xóa." type="warning" showIcon className="rounded-3 border-warning bg-soft-warning" data-testid="content-readonly-alert" />
            </div>
          )}
          {access.canManage && !writeEnabled && (
            <div className="mb-3">
              <WriteLockedNotice what="Thêm/Sửa/Xóa câu hỏi" />
            </div>
          )}

          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" data-testid="quiz-breadcrumb">
              <li className="breadcrumb-item">
                <Link href={rootHref} prefetch={false} className="btn btn-link p-0 align-baseline">
                  <i className="isax isax-home-2 me-1" /> Quản lý Bài tập
                </Link>
              </li>
              {backHref !== rootHref && (
                <li className="breadcrumb-item">
                  <Link href={backHref} prefetch={false} className="btn btn-link p-0 align-baseline">
                    <i className="isax isax-book-1 me-1" /> {packageName ?? "Package"}
                  </Link>
                </li>
              )}
              <li className="breadcrumb-item active" aria-current="page">
                <i className="isax isax-clipboard-text me-1" /> {quiz?.title ?? "…"}
              </li>
            </ol>
          </nav>
        </div>

        <div className="card-body p-4">
          {state.kind === "loading" && !quiz ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="text-muted mt-3 mb-0">Đang tải bài tập...</p>
            </div>
          ) : notice && !quiz ? (
            <FetchStateNotice state={state} waitingText="Bài tập chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onRetry} testId="quiz-notice" />
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                  <h5 className="fw-800 mb-1">
                    <i className="isax isax-message-question me-2 text-success" />
                    Câu hỏi — {quiz?.title ?? "…"}
                  </h5>
                  {quiz && (
                    <div className="d-flex align-items-center gap-2 flex-wrap small text-muted" data-testid="quiz-meta">
                      <span className={`difficulty-badge ${difficulty.className}`}>{difficulty.label}</span>
                      <span className="badge bg-info-subtle text-info border">{quiz.skill ? quizSkillLabel(quiz.skill) : "Chưa chọn kỹ năng"}</span>
                      <span>
                        <i className="isax isax-timer-1 me-1" />
                        {quiz.durationMinutes && quiz.durationMinutes > 0 ? `${quiz.durationMinutes} phút` : "Không giới hạn"}
                      </span>
                      {typeof quiz.passingScore === "number" && <span>Điểm đạt {quiz.passingScore}%</span>}
                      <span data-testid="quiz-question-count">{questions.length} câu</span>
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2">
                  <Link href={backHref} prefetch={false} className="btn btn-outline-secondary btn-sm rounded-pill">
                    <i className="isax isax-arrow-left me-1" />
                    Quay lại
                  </Link>
                  {canWrite && (
                    <button type="button" className="btn btn-primary btn-sm rounded-pill" onClick={onAdd} disabled={busy || !quiz}>
                      <i className="isax isax-add me-1" />
                      Thêm câu hỏi
                    </button>
                  )}
                </div>
              </div>

              {quiz && <QuizMedia quiz={quiz} />}

              {state.kind === "loading" ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                  <p className="text-muted mt-3 mb-0">Đang tải câu hỏi...</p>
                </div>
              ) : notice ? (
                <FetchStateNotice state={state} waitingText="Danh sách câu hỏi chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onRetry} testId="quiz-questions-notice" />
              ) : (
                <QuizQuestionList questions={questions} canWrite={canWrite} busy={busy} onEdit={onEdit} onDelete={onDelete} />
              )}
            </>
          )}
        </div>
      </div>
    </ManagementPageFrame>
  );
}
