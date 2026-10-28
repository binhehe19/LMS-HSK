"use client";

// Port của LMS_Frontend/src/features/instructor/class-management/components/question-grading-card.tsx (cùng DOM, class, style nội tuyến và chữ).
// Thẻ một câu hỏi: đề + media, đáp án của học viên theo loại câu, giải thích, gợi ý AI, khung chấm (nhận xét + điểm + Lưu / Chỉnh sửa).
// Khác bản cũ có chủ đích: (1) luôn là component CÓ ĐIỀU KHIỂN (bản nháp do container giữ, kể cả câu chưa có answerId) nên bỏ state/effect đồng bộ nội bộ;
// (2) `disabled` = công tắc ghi đóng: mọi ô nhập và nút Lưu/Chỉnh sửa bị khoá; (3) media chỉ hiện khi có URL hợp lệ (grading-media.ts), không thì "Không có tệp".
import { useState, type CSSProperties, type ReactNode } from "react";
import { AutoGrowTextarea } from "@/components/management/instructor-grading/auto-grow-textarea";
import { AssetImage } from "@/components/shared/asset-image";
import { isEmptyAnswer, parseGradingMatchText, selectedOptionIds, studentBlankAnswer, studentChunkOrder, studentPairMap, textify } from "@/lib/grading/answer-display";
import { formatScore, sanitizeScoreInput } from "@/lib/grading/grading-helpers";
import { isImageMedia, mediaUrl } from "@/lib/grading/grading-media";
import type { GradeDraft } from "@/lib/grading/grading-workspace-model";
import type { GradingAttemptQuestion } from "@/types/grading";

interface QuestionGradingCardProps {
  question: GradingAttemptQuestion;
  value: GradeDraft;
  onChange: (value: GradeDraft) => void;
  /** Lưu điểm/nhận xét đang nhập; trả true khi backend đã lưu. */
  onSave: (scoreValue: string, comment: string) => Promise<boolean>;
  /** Câu đã gửi kết quả cho học viên: chỉ xem, không có "Chỉnh sửa". */
  readOnly: boolean;
  /** Công tắc ghi đóng (WAITING FOR BACKEND): ô nhập và nút bị khoá. */
  disabled: boolean;
  saving: boolean;
}

const NO_FILE = <div className="text-muted small mb-2">Không có tệp</div>;

function Row({ tone = "none", children, note }: { tone?: "ok" | "bad" | "none"; children: ReactNode; note?: string }) {
  const style: CSSProperties = tone === "ok" ? { background: "#e9f9ee" } : tone === "bad" ? { background: "#fdecec" } : {};
  const cls = tone === "ok" ? "border-success" : tone === "bad" ? "border-danger" : "border";
  return (
    <div className={`d-flex align-items-center rounded p-2 mb-2 ${cls}`} style={style}>
      {tone === "ok" && <i className="isax isax-tick-circle text-success me-2" />}
      {tone === "bad" && <i className="isax isax-close-circle text-danger me-2" />}
      <span className="flex-grow-1">{children}</span>
      {note && <span className="ms-2 fst-italic text-muted small flex-shrink-0">{note}</span>}
    </div>
  );
}

function PairSide({ text, media }: { text?: string; media?: string }) {
  const { primary, secondary } = parseGradingMatchText(text);
  const src = media ? mediaUrl(media) : null;
  return (
    <span className="d-inline-flex align-items-center gap-1">
      {media && (src ? <AssetImage src={src} alt="" style={{ maxHeight: 96, maxWidth: 140, objectFit: "cover" }} className="rounded" /> : <span className="text-muted small">Không có tệp</span>)}
      {primary ? (
        secondary ? (
          <span className="d-inline-flex flex-column text-start" style={{ lineHeight: 1.3 }}>
            <span className="fw-700">{primary}</span>
            <span className="text-muted small">{secondary}</span>
          </span>
        ) : (
          <span>{primary}</span>
        )
      ) : !media ? (
        <span>—</span>
      ) : null}
    </span>
  );
}

const NOT_ANSWERED = <div className="text-danger fst-italic small mb-2">Học viên chưa trả lời câu này</div>;

function AnswerBody({ question }: { question: GradingAttemptQuestion }) {
  const student = question.studentAnswer;
  const answered = !isEmptyAnswer(student) || !!question.studentAudioId;

  // MULTIPLE_CHOICE: hiện tất cả đáp án, đúng = xanh, học viên chọn sai = đỏ.
  if (question.options && question.options.length > 0) {
    const selected = new Set(selectedOptionIds(student));
    return (
      <>
        {question.options.map((opt) => {
          const isStudent = selected.has(String(opt.id));
          const tone = opt.isCorrect ? "ok" : isStudent ? "bad" : "none";
          return (
            <Row key={opt.id} tone={tone} note={isStudent ? "(Đáp án của học viên)" : undefined}>
              <PairSide text={opt.content || "-"} media={opt.mediaUrl} />
            </Row>
          );
        })}
        {!answered && NOT_ANSWERED}
      </>
    );
  }

  // MATCHING_PAIRS: hiện cặp đúng + cặp học viên nối (đúng/sai).
  if (question.matchingPairs && question.matchingPairs.length > 0) {
    const pairs = question.matchingPairs;
    const byId = new Map(pairs.map((p) => [String(p.id), p]));
    const chosen = studentPairMap(student);
    return (
      <>
        <div className="text-muted small mb-1">Đáp án đúng:</div>
        {pairs.map((p) => (
          <Row key={`c-${p.id}`} tone="ok">
            <PairSide text={p.prompt} media={p.promptMediaUrl} />
            <i className="isax isax-arrow-right-3 mx-2" />
            <PairSide text={p.answer} media={p.answerMediaUrl} />
          </Row>
        ))}
        <div className="text-muted small mb-1 mt-2">Học viên nối:</div>
        {pairs.map((p) => {
          const chosenId = chosen[String(p.id)];
          const chosenPair = chosenId ? byId.get(String(chosenId)) : undefined;
          const ok = !!chosenId && String(chosenId) === String(p.id);
          return (
            <Row key={`s-${p.id}`} tone={chosenId ? (ok ? "ok" : "bad") : "none"}>
              <PairSide text={p.prompt} media={p.promptMediaUrl} />
              <i className="isax isax-arrow-right-3 mx-2" />
              {chosenPair ? <PairSide text={chosenPair.answer} media={chosenPair.answerMediaUrl} /> : <span>—</span>}
            </Row>
          );
        })}
        {!answered && NOT_ANSWERED}
      </>
    );
  }

  // FILL_IN_BLANK: từng ô, so sánh đáp án học viên với đáp án đúng.
  if (question.blanks && question.blanks.length > 0) {
    return (
      <>
        {question.blanks.map((b) => {
          const idx = b.index ?? 0;
          const ans = studentBlankAnswer(student, idx);
          const ok = ans.trim() !== "" && ans.trim().toLowerCase() === String(b.correctAnswer || "").trim().toLowerCase();
          return (
            <div key={idx} className="mb-2">
              <Row tone={ans ? (ok ? "ok" : "bad") : "none"} note={`(Ô ${idx + 1})`}>
                {ans || <span className="text-muted">—</span>}
              </Row>
              {!ok && <div className="small text-success ms-1">Đáp án đúng: {b.correctAnswer}</div>}
            </div>
          );
        })}
        {!answered && NOT_ANSWERED}
      </>
    );
  }

  // SENTENCE_BUILDER: câu học viên ghép vs câu đúng.
  if (question.sentenceChunks && question.sentenceChunks.length > 0) {
    const chunkById = new Map(question.sentenceChunks.map((c) => [String(c.id), c.content || ""]));
    const studentSentence = studentChunkOrder(student)
      .map((id) => chunkById.get(id) ?? id)
      .join(" ");
    const correctSentence = question.sentenceChunks
      .filter((c) => !c.isDistractor)
      .map((c) => c.content)
      .join(" ");
    return (
      <>
        <div className="text-muted small mb-1">Học viên ghép:</div>
        <Row tone={answered ? (studentSentence.trim() === correctSentence.trim() ? "ok" : "bad") : "none"}>{studentSentence || <span className="text-muted">—</span>}</Row>
        <div className="text-muted small mb-1">Đáp án đúng:</div>
        <Row tone="ok">{correctSentence}</Row>
      </>
    );
  }

  // SHORT_ANSWER / AUDIO_RESPONSE (chấm tay): hiện bài học viên + đáp án tham khảo. Câu chỉ ghi âm: backend cũ rơi studentAnswer về CHÍNH audioId thô —
  // không in dòng text khi nó trùng với audioId đang phát (nếu không "Bài làm của học viên" sẽ là chuỗi ID lưu trữ).
  const studentText = textify(student);
  const isDuplicateOfAudioId = !!question.studentAudioId && studentText === question.studentAudioId;
  const audio = question.studentAudioId ? mediaUrl(question.studentAudioId) : null;
  return (
    <>
      {question.studentAudioId && (
        <div className="mb-2">
          <div className="text-muted small mb-1">Ghi âm của học viên:</div>
          {audio ? <audio controls src={audio} className="w-100" /> : NO_FILE}
        </div>
      )}
      {!isDuplicateOfAudioId && (
        <>
          <div className="text-muted small mb-1">Bài làm của học viên:</div>
          <Row tone="none">{answered ? studentText : <span className="text-muted">Học viên chưa trả lời câu này</span>}</Row>
        </>
      )}
      {!isEmptyAnswer(question.correctAnswer) && (
        <>
          <div className="text-muted small mb-1">Đáp án tham khảo:</div>
          <Row tone="ok">{textify(question.correctAnswer)}</Row>
        </>
      )}
      <AiSuggestion question={question} />
    </>
  );
}

/** FEAT-AI-GRADING: gợi ý điểm/nhận xét của AI — chỉ để giáo viên tham khảo, không tự áp vào điểm. */
function AiSuggestion({ question }: { question: GradingAttemptQuestion }) {
  if (question.aiJobStatus === "PENDING" || question.aiJobStatus === "PROCESSING") {
    return (
      <div className="rounded p-2 mb-2 mt-2 text-muted small" style={{ background: "#f5f5f5" }}>
        <i className="isax isax-timer me-1" /> AI đang chấm bài này, vài phút sẽ có kết quả...
      </div>
    );
  }
  if (question.aiJobStatus === "FAILED" || question.aiJobStatus === "TIMEOUT") {
    return (
      <div className="rounded p-2 mb-2 mt-2 text-muted small" style={{ background: "#f5f5f5" }}>
        AI chấm không thành công cho câu này — chấm tay như bình thường.
      </div>
    );
  }
  if (isEmptyAnswer(question.aiScore) && isEmptyAnswer(question.aiFeedback)) return null;
  return (
    <div className="rounded p-2 mb-2 mt-2" style={{ background: "#fff4e5", border: "1px solid #ffe0b2" }}>
      <div className="fw-semibold mb-1" style={{ color: "#b95c00" }}>
        AI gợi ý
        {!isEmptyAnswer(question.aiScore) && (
          <>
            : {formatScore(question.aiScore)} / {formatScore(question.maxScore)}
          </>
        )}
      </div>
      {question.aiFeedback && <div className="small">{question.aiFeedback}</div>}
    </div>
  );
}

export function QuestionGradingCard({ question, value, onChange, onSave, readOnly, disabled, saving }: QuestionGradingCardProps) {
  // Câu chưa có điểm giáo viên mở sẵn khung nhập (bản cũ); sau khi lưu điểm thì chuyển sang xem + nút "Chỉnh sửa".
  const [editing, setEditing] = useState(() => question.teacherScore == null);
  const fieldId = question.answerId || question.questionId;
  const questionMedia = question.questionMediaUrl ? mediaUrl(question.questionMediaUrl) : null;

  const handleSave = async () => {
    const saved = await onSave(value.score, value.comment);
    if (saved && value.score !== "") setEditing(false);
  };

  return (
    <div className="border rounded p-3 mb-3 bg-white" data-testid="question-card">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div className="fw-medium pe-3">{question.questionText || "-"}</div>
        <span className="badge bg-danger flex-shrink-0">{formatScore(question.maxScore)}</span>
      </div>
      {question.questionMediaUrl &&
        (questionMedia ? (
          isImageMedia(question.questionMediaUrl) ? (
            <AssetImage src={questionMedia} alt="" className="d-block mb-2" style={{ maxHeight: 160 }} />
          ) : (
            <audio controls src={questionMedia} className="w-100 mb-2" />
          )
        ) : (
          NO_FILE
        ))}

      <div className="text-muted small mb-1">Các đáp án:</div>
      <AnswerBody question={question} />

      {question.explanation && (
        <div className="rounded p-2 mb-2 mt-2" style={{ background: "#eef4ff" }}>
          <span className="fw-semibold text-primary">Giải thích: </span>
          {question.explanation}
        </div>
      )}

      <hr className="my-3" />

      {readOnly || !editing ? (
        <>
          {/* Khung nhận xét LUÔN hiện (kể cả câu máy chấm đúng 100%) theo yêu cầu nghiệp vụ của HSK cũ. */}
          <label className="form-label d-flex align-items-center gap-1">
            <i className="isax isax-message-text" /> Nhận xét của giáo viên
          </label>
          <div className="border rounded p-2 mb-2 bg-light text-muted" style={{ minHeight: 38, whiteSpace: "pre-wrap" }}>
            {question.teacherComment || "Chưa có nhận xét"}
          </div>
          <div className="text-muted">
            Điểm: <b className="text-dark">{formatScore(question.teacherScore ?? question.autoScore)}</b> / {formatScore(question.maxScore)}
          </div>
          {!readOnly && (
            <button type="button" className="btn btn-outline-primary mt-2" disabled={disabled || saving} onClick={() => setEditing(true)}>
              <i className="isax isax-edit-2 me-1" /> Chỉnh sửa
            </button>
          )}
        </>
      ) : (
        <div>
          <div className="mb-2">
            <label className="form-label d-flex align-items-center gap-1" htmlFor={`comment-${fieldId}`}>
              <i className="isax isax-message-text" /> Nhận xét của giáo viên
            </label>
            <AutoGrowTextarea id={`comment-${fieldId}`} className="form-control" minHeight={60} placeholder="Nhập nhận xét..." value={value.comment} disabled={disabled} onChange={(e) => onChange({ ...value, comment: e.target.value })} />
          </div>
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <div style={{ width: 130 }}>
              <label className="form-label" htmlFor={`score-${fieldId}`}>
                Điểm
              </label>
              <div className="input-group">
                <input
                  id={`score-${fieldId}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={question.maxScore ?? 0}
                  step="0.25"
                  className="form-control"
                  value={value.score}
                  disabled={disabled}
                  onKeyDown={(e) => {
                    // Chặn ngay từ bàn phím: chỉ cho số, dấu chấm, và các phím điều hướng/chỉnh sửa.
                    if (e.key.length === 1 && !/[0-9.]/.test(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => onChange({ ...value, score: sanitizeScoreInput(e.target.value) })}
                />
                <span className="input-group-text">/ {formatScore(question.maxScore)}</span>
              </div>
            </div>
            <button type="button" className="btn btn-success px-3" disabled={disabled || saving} onClick={handleSave}>
              <i className="isax isax-save-2 me-1" />
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
