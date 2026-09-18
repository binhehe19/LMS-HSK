"use client";

// Form soạn MỘT câu hỏi — port thân create-question-modal.tsx của HSK cũ: lưới chọn loại (.qqm-type-grid), thông tin chung, phần riêng theo loại,
// giải thích. Thuần: nhận/trả QuizQuestionInput qua props, kiểm tra do lib/content/quiz-question.ts.
// Khác bản cũ có chủ đích: thêm loại TRUE_FALSE (bộ đề HSK dùng nhiều, mock đã có); SENTENCE_BUILDER hiện trong lưới nhưng khoá ("Chưa chuyển sang bản mới");
// chế độ chấm AI (aiGradingSubtype/hskLevel) chưa chuyển — tự luận/ghi âm luôn "Giáo viên chấm tay"; ảnh cho từng lựa chọn/vế nối chưa chuyển, chỉ có
// ảnh/âm thanh cấp câu hỏi qua ContentFileField (repo-storage).
import type { ChangeEvent } from "react";
import { ContentFileField } from "@/components/management/content-tree/content-file-field";
import { QUIZ_DIFFICULTIES } from "@/lib/content/quiz-item";
import { QUIZ_QUESTION_TYPES, questionTypeMeta, type QuizBlankInput, type QuizOptionInput, type QuizPairInput, type QuizQuestionInput } from "@/lib/content/quiz-question";
import type { QuizDifficulty, QuizFillBlankMode, QuizQuestionType } from "@/types/content-quiz";

export interface QuizQuestionFormProps {
  value: QuizQuestionInput;
  onChange: (next: QuizQuestionInput) => void;
  disabled?: boolean;
  idPrefix: string;
}

const LABEL = "form-label fw-600";
const REMOVE_STYLE = { width: 30, height: 30, padding: 0 } as const;

function updateAt<T>(list: readonly T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}
function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

export function QuizQuestionForm({ value, onChange, disabled, idPrefix }: QuizQuestionFormProps) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const meta = questionTypeMeta(value.type);
  const set = <K extends keyof QuizQuestionInput>(field: K, next: QuizQuestionInput[K]) => onChange({ ...value, [field]: next });
  const setText = (field: "prompt" | "explanation" | "referenceAnswer") => (e: ChangeEvent<HTMLTextAreaElement>) => set(field, e.target.value);
  const promptLabel = value.type === "FILL_IN_BLANK" ? "Câu mẫu (dùng {blank} hoặc ___ cho chỗ trống)" : value.type === "TRUE_FALSE" ? "Mệnh đề cần phán đoán" : value.type === "SHORT_ANSWER" ? "Đề bài tự luận" : value.type === "AUDIO_RESPONSE" ? "Đề bài ghi âm" : "Nội dung câu hỏi";

  return (
    <div data-testid="quiz-question-form">
      <div className="qqm-section mb-4">
        <label className={LABEL}>Loại câu hỏi *</label>
        <div className="qqm-type-grid" role="radiogroup" aria-label="Loại câu hỏi">
          {QUIZ_QUESTION_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              role="radio"
              aria-checked={value.type === t.value}
              className={`qqm-type-btn ${value.type === t.value ? "active" : ""}`}
              onClick={() => set("type", t.value as QuizQuestionType)}
              disabled={disabled || !t.supported}
              title={t.supported ? t.label : "Chưa chuyển sang bản mới"}
            >
              <div className="qqm-type-icon">
                <i className={`isax ${t.icon}`} />
              </div>
              <div>
                <div className="qqm-type-label">{t.label}</div>
                <div className="qqm-type-desc">{t.description}</div>
              </div>
            </button>
          ))}
        </div>
        {!meta.supported && (
          <div className="alert alert-warning small mt-3 mb-0" role="status">
            Loại câu hỏi &quot;{meta.label}&quot; chưa được hỗ trợ soạn trên bản mới; chọn loại khác để lưu (nội dung đã nhập được giữ).
          </div>
        )}
      </div>

      <div className="qqm-section mb-4">
        <h6 className="qqm-section-title">Thông tin chung</h6>
        <div className="row g-3 mb-0">
          <div className="col-md-8">
            <label className={LABEL} htmlFor={id("prompt")}>
              {promptLabel}
            </label>
            <textarea id={id("prompt")} className="form-control rounded-3" rows={2} value={value.prompt} onChange={setText("prompt")} placeholder={value.type === "FILL_IN_BLANK" ? "Tôi {blank} đến trường mỗi ngày" : "Nhập câu hỏi..."} disabled={disabled} />
          </div>
          <div className="col-md-2 col-6">
            <label className={LABEL} htmlFor={id("points")}>
              Điểm
            </label>
            <input id={id("points")} type="number" className="form-control rounded-3" min={1} value={value.points} onChange={(e) => set("points", Number(e.target.value))} disabled={disabled} />
          </div>
          <div className="col-md-2 col-6">
            <label className={LABEL} htmlFor={id("difficulty")}>
              Độ khó
            </label>
            <select id={id("difficulty")} className="form-select rounded-3" value={value.difficulty} onChange={(e) => set("difficulty", e.target.value as QuizDifficulty)} disabled={disabled}>
              {QUIZ_DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {value.type === "MULTIPLE_CHOICE" && (
        <div className="qqm-section mb-4" data-testid="qq-multiple-choice">
          <h6 className="qqm-section-title">Đáp án trắc nghiệm</h6>
          <label className="form-label fw-700">
            Các lựa chọn <small className="text-muted">(Chỉ chọn 1 đáp án đúng)</small>
          </label>
          {value.options.map((opt, i) => (
            <div key={i} className="d-flex align-items-center gap-2 mb-2 qqm-row-item">
              <input id={id(`correct-${i}`)} type="radio" name={id("correct")} checked={opt.isCorrect} onChange={() => set("options", value.options.map((o, j) => ({ ...o, isCorrect: j === i })))} style={{ cursor: "pointer", width: 18, height: 18 }} title="Chọn làm đáp án đúng" aria-label={`Lựa chọn ${i + 1} là đáp án đúng`} disabled={disabled} />
              <label htmlFor={id(`correct-${i}`)} className="mb-0" style={{ cursor: "pointer", minWidth: 34 }}>
                {opt.isCorrect ? <span className="badge bg-success">Đúng</span> : <span className="badge bg-light text-dark">Sai</span>}
              </label>
              <input type="text" className="form-control form-control-sm rounded-3 flex-grow-1" value={opt.text} placeholder={`Lựa chọn ${i + 1}`} aria-label={`Lựa chọn ${i + 1}`} onChange={(e) => set("options", updateAt<QuizOptionInput>(value.options, i, { text: e.target.value }))} disabled={disabled} />
              {value.options.length > 2 && (
                <button type="button" className="btn btn-sm btn-outline-danger rounded-circle" style={REMOVE_STYLE} onClick={() => set("options", removeAt(value.options, i))} disabled={disabled} aria-label={`Xóa lựa chọn ${i + 1}`}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-outline-primary rounded-pill mt-1" onClick={() => set("options", [...value.options, { text: "", isCorrect: false }])} disabled={disabled}>
            <i className="isax isax-add me-1" />
            Thêm lựa chọn
          </button>
        </div>
      )}

      {value.type === "TRUE_FALSE" && (
        <div className="qqm-section mb-4" data-testid="qq-true-false">
          <h6 className="qqm-section-title">Đáp án Đúng / Sai</h6>
          <div className="d-flex gap-4">
            {[true, false].map((answer) => (
              <div key={String(answer)} className="form-check">
                <input id={id(`tf-${answer}`)} className="form-check-input" type="radio" name={id("tf")} checked={value.correctAnswer === answer} onChange={() => set("correctAnswer", answer)} disabled={disabled} />
                <label className="form-check-label fw-600" htmlFor={id(`tf-${answer}`)}>
                  {answer ? "Đúng" : "Sai"}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {value.type === "FILL_IN_BLANK" && (
        <div className="qqm-section mb-4" data-testid="qq-fill-blank">
          <h6 className="qqm-section-title">Cấu hình điền chỗ trống</h6>
          <div className="mb-3">
            <label className={LABEL} htmlFor={id("fib-mode")}>
              Chế độ
            </label>
            <select id={id("fib-mode")} className="form-select rounded-3 form-select-sm" style={{ width: 200 }} value={value.fillBlankMode} onChange={(e) => set("fillBlankMode", e.target.value as QuizFillBlankMode)} disabled={disabled}>
              <option value="TYPE">Gõ đáp án</option>
              <option value="SELECT">Chọn đáp án</option>
            </select>
          </div>
          <label className="form-label fw-700">Đáp án cho các chỗ trống</label>
          {value.blanks.map((b, i) => (
            <div key={i} className="d-flex gap-2 mb-2 qqm-row-item">
              <span className="badge bg-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 28, height: 28 }}>
                {i + 1}
              </span>
              <input className="form-control form-control-sm rounded-3" value={b.answer} placeholder="Đáp án đúng" aria-label={`Đáp án chỗ trống ${i + 1}`} onChange={(e) => set("blanks", updateAt<QuizBlankInput>(value.blanks, i, { answer: e.target.value }))} disabled={disabled} />
              <input className="form-control form-control-sm rounded-3" value={b.acceptable} placeholder="Đáp án chấp nhận (phân cách bằng dấu phẩy)" aria-label={`Đáp án chấp nhận chỗ trống ${i + 1}`} onChange={(e) => set("blanks", updateAt<QuizBlankInput>(value.blanks, i, { acceptable: e.target.value }))} disabled={disabled} />
              {value.blanks.length > 1 && (
                <button type="button" className="btn btn-sm btn-outline-danger rounded-circle flex-shrink-0" style={REMOVE_STYLE} onClick={() => set("blanks", removeAt(value.blanks, i))} disabled={disabled} aria-label={`Xóa chỗ trống ${i + 1}`}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-outline-primary rounded-pill mt-1" onClick={() => set("blanks", [...value.blanks, { answer: "", acceptable: "" }])} disabled={disabled}>
            <i className="isax isax-add me-1" />
            Thêm chỗ trống
          </button>
          {value.fillBlankMode === "SELECT" && (
            <div className="mt-3">
              <label className="form-label fw-700">Danh sách lựa chọn</label>
              {value.choices.map((choice, i) => (
                <div key={i} className="d-flex align-items-center gap-2 mb-2 qqm-row-item">
                  <input className="form-control form-control-sm rounded-3 flex-grow-1" value={choice} placeholder={`Lựa chọn ${i + 1}`} aria-label={`Lựa chọn điền ${i + 1}`} onChange={(e) => set("choices", value.choices.map((c, j) => (j === i ? e.target.value : c)))} disabled={disabled} />
                  {value.choices.length > 2 && (
                    <button type="button" className="btn btn-sm btn-outline-danger rounded-circle" style={REMOVE_STYLE} onClick={() => set("choices", removeAt(value.choices, i))} disabled={disabled} aria-label={`Xóa lựa chọn điền ${i + 1}`}>
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-outline-primary rounded-pill mt-1" onClick={() => set("choices", [...value.choices, ""])} disabled={disabled}>
                <i className="isax isax-add me-1" />
                Thêm lựa chọn
              </button>
            </div>
          )}
        </div>
      )}

      {value.type === "MATCHING_PAIRS" && (
        <div className="qqm-section mb-4" data-testid="qq-matching">
          <h6 className="qqm-section-title">Cấu hình nối cặp</h6>
          <label className="form-label fw-700">Các cặp nối</label>
          {value.pairs.map((p, i) => (
            <div key={i} className="d-flex gap-2 align-items-center mb-2 qqm-row-item">
              <span className="badge bg-info rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 28, height: 28 }}>
                {i + 1}
              </span>
              <input className="form-control form-control-sm rounded-3" value={p.left} placeholder="Mục trái" aria-label={`Mục trái ${i + 1}`} onChange={(e) => set("pairs", updateAt<QuizPairInput>(value.pairs, i, { left: e.target.value }))} disabled={disabled} />
              <i className="isax isax-arrow-right-1 text-muted flex-shrink-0" />
              <input className="form-control form-control-sm rounded-3" value={p.right} placeholder="Mục phải" aria-label={`Mục phải ${i + 1}`} onChange={(e) => set("pairs", updateAt<QuizPairInput>(value.pairs, i, { right: e.target.value }))} disabled={disabled} />
              {value.pairs.length > 2 && (
                <button type="button" className="btn btn-sm btn-outline-danger rounded-circle flex-shrink-0" style={REMOVE_STYLE} onClick={() => set("pairs", removeAt(value.pairs, i))} disabled={disabled} aria-label={`Xóa cặp ${i + 1}`}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-outline-primary rounded-pill mt-1" onClick={() => set("pairs", [...value.pairs, { left: "", right: "" }])} disabled={disabled}>
            <i className="isax isax-add me-1" />
            Thêm cặp
          </button>
        </div>
      )}

      {(value.type === "SHORT_ANSWER" || value.type === "AUDIO_RESPONSE") && (
        <div className="qqm-section mb-4" data-testid="qq-manual">
          <h6 className="qqm-section-title">{value.type === "SHORT_ANSWER" ? "Câu tự luận" : "Câu trả lời ghi âm"}</h6>
          <div className="row g-3">
            <div className="col-md-4">
              <label className={LABEL}>Chế độ chấm</label>
              <div className="form-control rounded-3 bg-light text-muted">Giáo viên chấm tay</div>
              <div className="form-text">Chấm hỗ trợ bằng AI chưa chuyển sang bản mới.</div>
            </div>
            {value.type === "SHORT_ANSWER" && (
              <div className="col-md-8">
                <label className={LABEL} htmlFor={id("reference")}>
                  Đáp án tham khảo
                </label>
                <textarea id={id("reference")} className="form-control rounded-3" rows={3} value={value.referenceAnswer} onChange={setText("referenceAnswer")} placeholder="Nhập đáp án tham khảo..." disabled={disabled} />
              </div>
            )}
            {value.type === "AUDIO_RESPONSE" && (
              <div className="col-md-8 d-flex align-items-end">
                <p className="text-muted small mb-2">Học viên trả lời bằng cách ghi âm; giáo viên nghe và chấm điểm trong màn chấm bài.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="qqm-section mb-4">
        <h6 className="qqm-section-title">Tệp đính kèm của câu hỏi</h6>
        <div className="row g-3">
          <div className="col-md-6">
            <ContentFileField id={id("image")} label="Ảnh minh hoạ" kind="image" fileId={value.imageFileId} onChange={(fileId) => set("imageFileId", fileId)} disabled={disabled} />
          </div>
          <div className="col-md-6">
            <ContentFileField id={id("audio")} label="Âm thanh (câu hỏi nghe)" kind="audio" fileId={value.audioFileId} onChange={(fileId) => set("audioFileId", fileId)} disabled={disabled} />
          </div>
        </div>
      </div>

      <div className="qqm-section mb-2">
        <h6 className="qqm-section-title">Giải thích sau khi trả lời</h6>
        <label className={LABEL} htmlFor={id("explanation")}>
          Giải thích (hiện sau khi trả lời)
        </label>
        <textarea id={id("explanation")} className="form-control rounded-3" rows={3} value={value.explanation} onChange={setText("explanation")} placeholder="Giải thích đáp án..." disabled={disabled} />
      </div>
    </div>
  );
}
