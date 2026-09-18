"use client";

// Danh sách câu hỏi của một quiz — port question-list.tsx của HSK cũ (`.question-item`, huy hiệu loại, điểm, nội dung, đáp án đúng, cặp nối, đáp án
// tham khảo, giải thích; nút Sửa/Xóa). View thuần. Khác bản cũ: media là tệp repo-storage (fileUrl), có thêm TRUE_FALSE và đáp án chỗ trống.
import { AssetImage } from "@/components/shared/asset-image";
import { fileUrl } from "@/lib/api/storage-client";
import { normalizeBlankTemplate, questionSummary, questionTypeMeta, sortQuestions } from "@/lib/content/quiz-question";
import type { QuizQuestion } from "@/types/content-quiz";

export interface QuizQuestionListProps {
  questions: QuizQuestion[];
  canWrite: boolean;
  busy: boolean;
  onEdit: (q: QuizQuestion) => void;
  onDelete: (q: QuizQuestion) => void;
}

function QuestionMedia({ q }: { q: QuizQuestion }) {
  const image = fileUrl(q.imageFileId);
  const audio = fileUrl(q.audioFileId);
  if (!image && !audio) return null;
  return (
    <div className="d-flex flex-wrap align-items-center gap-3 mt-2">
      {image && <AssetImage src={image} alt="Ảnh câu hỏi" className="rounded border" style={{ maxHeight: 100, maxWidth: 160, objectFit: "cover" }} />}
      {audio && <audio controls src={audio} preload="none" style={{ height: 30, maxWidth: 220 }} />}
    </div>
  );
}

export function QuizQuestionList({ questions, canWrite, busy, onEdit, onDelete }: QuizQuestionListProps) {
  if (questions.length === 0) {
    return (
      <div className="text-center py-4" data-testid="quiz-questions-empty">
        <i className="isax isax-message-question" style={{ fontSize: 40, opacity: 0.3 }} />
        <p className="text-muted mt-2 mb-0 fw-500">Chưa có câu hỏi nào</p>
      </div>
    );
  }

  return (
    <div data-testid="quiz-question-list">
      {sortQuestions(questions).map((q, idx) => {
        const meta = questionTypeMeta(q.type);
        return (
          <div key={q.id} className="question-item d-flex align-items-start justify-content-between" data-testid="quiz-question-row">
            <div className="d-flex align-items-start gap-3 flex-grow-1">
              <div className="d-flex align-items-center justify-content-center rounded-circle fw-700 flex-shrink-0" style={{ width: 32, height: 32, background: "#f0f0f0", fontSize: 14 }}>
                {idx + 1}
              </div>
              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span className={`question-type-badge ${meta.badgeClass}`}>{meta.label}</span>
                  <span className="text-muted small">{q.points} điểm</span>
                  {q.difficulty && <span className="text-muted small">· {q.difficulty === "EASY" ? "Dễ" : q.difficulty === "HARD" ? "Khó" : "Trung bình"}</span>}
                </div>
                <p className="mb-0 fw-600" style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
                  {q.type === "FILL_IN_BLANK" ? normalizeBlankTemplate(q.prompt ?? "").replace(/\{blank\}/g, "____") : q.prompt || "(Không có nội dung)"}
                </p>
                <QuestionMedia q={q} />

                {q.type === "MULTIPLE_CHOICE" && q.options && q.options.length > 0 && (
                  <div className="mt-1">
                    {q.options.map((o, i) => (
                      <div key={i} className="d-flex align-items-center gap-2 small">
                        <i className={`isax ${o.isCorrect ? "isax-tick-circle text-success" : "isax-record"}`} style={{ fontSize: 13 }} />
                        <span className={o.isCorrect ? "fw-600 text-success" : ""}>{o.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === "TRUE_FALSE" && typeof q.correctAnswer === "boolean" && (
                  <div className="small mt-1">
                    <i className="isax isax-tick-circle text-success me-1" style={{ fontSize: 13 }} />
                    Đáp án: <span className="fw-600 text-success">{q.correctAnswer ? "Đúng" : "Sai"}</span>
                  </div>
                )}

                {q.type === "FILL_IN_BLANK" && q.blanks && q.blanks.length > 0 && (
                  <div className="small mt-1 d-flex flex-wrap gap-2">
                    {[...q.blanks]
                      .sort((a, b) => a.index - b.index)
                      .map((b) => (
                        <span key={b.index} className="badge bg-light text-dark border">
                          {b.index + 1}. {b.answer}
                          {b.acceptable && b.acceptable.length > 0 && <span className="text-muted fw-normal"> ({b.acceptable.join(", ")})</span>}
                        </span>
                      ))}
                    {q.fillBlankMode === "SELECT" && q.choices && q.choices.length > 0 && <span className="text-muted">Lựa chọn: {q.choices.join(" · ")}</span>}
                  </div>
                )}

                {q.type === "MATCHING_PAIRS" && q.pairs && q.pairs.length > 0 && (
                  <div className="mt-1">
                    {q.pairs.map((p, i) => (
                      <div key={i} className="d-flex align-items-center gap-2 small flex-wrap">
                        <span>{p.left}</span>
                        <i className="isax isax-arrow-right-3" style={{ fontSize: 12 }} />
                        <span>{p.right}</span>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === "SHORT_ANSWER" && q.referenceAnswer && (
                  <p className="text-muted small mt-1 mb-0">
                    <i className="isax isax-document-text me-1" />
                    Đáp án mẫu: {q.referenceAnswer}
                  </p>
                )}

                {q.explanation && (
                  <p className="text-muted small mt-1 mb-0">
                    <i className="isax isax-info-circle me-1" />
                    {q.explanation}
                  </p>
                )}
              </div>
            </div>
            {canWrite && (
              <div className="d-flex gap-2 ms-3 flex-shrink-0">
                <button type="button" className="btn btn-sm btn-outline-primary rounded-3" onClick={() => onEdit(q)} disabled={busy} title="Sửa" aria-label={`Sửa câu hỏi ${questionSummary(q)}`}>
                  <i className="isax isax-edit-2" />
                </button>
                <button type="button" className="btn btn-sm btn-outline-danger rounded-3" onClick={() => onDelete(q)} disabled={busy} title="Xóa" aria-label={`Xóa câu hỏi ${questionSummary(q)}`}>
                  <i className="isax isax-trash" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
