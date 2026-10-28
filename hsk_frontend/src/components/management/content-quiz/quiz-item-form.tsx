"use client";

// Form một BÀI TẬP (quiz) — port create-quiz-modal.tsx của HSK cũ: hai cột (thông tin chung | audio bài nghe, đoạn văn đọc, ảnh đoạn đọc).
// Thuần: nhận/trả giá trị qua props (ContentItemFormProps). Khác bản cũ có chủ đích: kỹ năng là ô chọn với "Theo bộ đề" (bản cũ chỉ hiển thị
// kỹ năng kế thừa từ bộ đề, form không biết bộ đề); audio/ảnh là tệp của repo-storage (ContentFileField) thay cho MediaUploadService.
import type { ChangeEvent } from "react";
import { ContentFileField } from "@/components/management/content-tree/content-file-field";
import { QUIZ_DIFFICULTIES, QUIZ_SKILLS } from "@/lib/content/quiz-item";
import type { ContentItemFormProps } from "@/types/content";
import type { QuizDifficulty, QuizItem } from "@/types/content-quiz";

const LABEL = "form-label small fw-700 text-muted mb-1";

export function QuizItemForm({ value, onChange, disabled, idPrefix }: ContentItemFormProps<QuizItem>) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const setText = (field: "title" | "description" | "instruction" | "passageText" | "skill") => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ ...value, [field]: e.target.value });
  const setNumber = (field: "durationMinutes" | "passingScore") => (e: ChangeEvent<HTMLInputElement>) => onChange({ ...value, [field]: e.target.value === "" ? undefined : Number(e.target.value) });

  return (
    <div className="row g-3" data-testid="quiz-item-form">
      <div className="col-md-6 border-end">
        <div className="mb-3">
          <label className={LABEL} htmlFor={id("title")}>
            Tiêu đề <span className="text-danger">*</span>
          </label>
          <input id={id("title")} type="text" className="form-control rounded-3" placeholder="Nhập tiêu đề quiz..." value={value.title} onChange={setText("title")} disabled={disabled} />
        </div>
        <div className="mb-3">
          <label className={LABEL} htmlFor={id("description")}>
            Mô tả
          </label>
          <textarea id={id("description")} className="form-control rounded-3" rows={2} placeholder="Mô tả ngắn..." value={value.description ?? ""} onChange={setText("description")} disabled={disabled} />
        </div>
        <div className="mb-3">
          <label className={LABEL} htmlFor={id("instruction")}>
            Hướng dẫn làm bài
          </label>
          <textarea id={id("instruction")} className="form-control rounded-3" rows={2} placeholder="Hướng dẫn cho người học..." value={value.instruction ?? ""} onChange={setText("instruction")} disabled={disabled} />
        </div>
        <div className="mb-3">
          <label className={LABEL} htmlFor={id("skill")}>
            Kỹ năng
          </label>
          <select id={id("skill")} className="form-select rounded-3" value={value.skill ?? ""} onChange={setText("skill")} disabled={disabled}>
            <option value="">Theo bộ đề (kế thừa)</option>
            {QUIZ_SKILLS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className={LABEL} htmlFor={id("difficulty")}>
              Độ khó
            </label>
            <select id={id("difficulty")} className="form-select rounded-3" value={value.difficulty ?? "MEDIUM"} onChange={(e) => onChange({ ...value, difficulty: e.target.value as QuizDifficulty })} disabled={disabled}>
              {QUIZ_DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6">
            <label className={LABEL} htmlFor={id("duration")}>
              Thời gian (phút)
            </label>
            <input id={id("duration")} type="number" className="form-control rounded-3" min={0} placeholder="0 = không giới hạn" value={value.durationMinutes ?? ""} onChange={setNumber("durationMinutes")} disabled={disabled} />
          </div>
        </div>
        <div className="row g-3">
          <div className="col-6">
            <label className={LABEL} htmlFor={id("passing")}>
              Điểm đạt (%)
            </label>
            <input id={id("passing")} type="number" className="form-control rounded-3" min={0} max={100} value={value.passingScore ?? ""} onChange={setNumber("passingScore")} disabled={disabled} />
          </div>
          <div className="col-6 d-flex align-items-end">
            <div className="form-check form-switch mb-2">
              <input id={id("shuffle")} className="form-check-input" type="checkbox" checked={value.shuffleQuestions ?? false} onChange={(e) => onChange({ ...value, shuffleQuestions: e.target.checked })} disabled={disabled} />
              <label className="form-check-label fw-600" htmlFor={id("shuffle")}>
                Trộn câu hỏi
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-6">
        <div className="mb-3">
          <ContentFileField id={id("audio")} label="Audio bài nghe (nếu có)" kind="audio" fileId={value.audioFileId} onChange={(fileId) => onChange({ ...value, audioFileId: fileId })} disabled={disabled} />
        </div>
        <div className="mb-3">
          <label className={LABEL} htmlFor={id("passage")}>
            Đoạn văn đọc (nếu có)
          </label>
          <textarea id={id("passage")} className="form-control rounded-3" rows={4} placeholder="Nhập đoạn văn đọc..." value={value.passageText ?? ""} onChange={setText("passageText")} disabled={disabled} />
        </div>
        <ContentFileField id={id("passage-image")} label="Ảnh đoạn đọc" kind="image" fileId={value.passageImageFileId} onChange={(fileId) => onChange({ ...value, passageImageFileId: fileId })} disabled={disabled} />
      </div>
    </div>
  );
}
