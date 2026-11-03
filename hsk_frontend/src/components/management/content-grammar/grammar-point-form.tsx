"use client";

// Form một ĐIỂM NGỮ PHÁP — port GrammarPointModal.tsx của HSK cũ (tên, cấp HSK, phân loại, định nghĩa chung, cấu trúc, giải thích, ví dụ zh/pinyin/vi,
// ghi chú). Thuần: nhận/trả giá trị qua props (ContentItemFormProps). Khác bản cũ có chủ đích: cấp HSK là ô chọn 1–9 thay cho ô số; bỏ hẳn field
// "Bộ đề bài tập liên kết (id)" (chưa từng có chỗ lưu ở backend, xem lms-grammar-client.ts — field chết, không chỉ ẩn trên form).
import type { ChangeEvent } from "react";
import { HSK_LEVEL_OPTIONS } from "@/lib/content/grammar-point";
import type { ContentItemFormProps } from "@/types/content";
import type { GrammarPoint, GrammarPointInput } from "@/types/content-grammar";

const LABEL = "form-label small fw-700 text-muted mb-1";

export function GrammarPointForm({ value, onChange, disabled, idPrefix }: ContentItemFormProps<GrammarPoint>) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const set = (field: keyof GrammarPointInput) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ ...value, [field]: e.target.value });

  return (
    <div className="row g-3" data-testid="grammar-point-form">
      <div className="col-md-8">
        <label className={LABEL} htmlFor={id("title")}>
          Điểm ngữ pháp <span className="text-danger">*</span>
        </label>
        <input id={id("title")} type="text" className="form-control" placeholder="VD: Câu với 是" value={value.title} onChange={set("title")} disabled={disabled} />
      </div>
      <div className="col-md-4">
        <label className={LABEL} htmlFor={id("hskLevel")}>
          Cấp độ HSK
        </label>
        <select id={id("hskLevel")} className="form-select" value={value.hskLevel ?? "1"} onChange={set("hskLevel")} disabled={disabled}>
          {HSK_LEVEL_OPTIONS.map((level) => (
            <option key={level} value={level}>
              HSK {level}
            </option>
          ))}
        </select>
      </div>
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("category")}>
          Phân loại <span className="text-danger">*</span>
        </label>
        <input id={id("category")} type="text" className="form-control" placeholder="VD: Câu trần thuật" value={value.category ?? ""} onChange={set("category")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("generalDefinition")}>
          Định nghĩa chung
        </label>
        <input id={id("generalDefinition")} type="text" className="form-control" placeholder="Một câu tóm tắt..." value={value.generalDefinition ?? ""} onChange={set("generalDefinition")} disabled={disabled} />
      </div>
      <div className="col-12">
        <label className={LABEL} htmlFor={id("structure")}>
          Cấu trúc <span className="text-danger">*</span>
        </label>
        <textarea id={id("structure")} className="form-control" rows={2} placeholder="VD: A + 是 + B" value={value.structure ?? ""} onChange={set("structure")} disabled={disabled} />
      </div>
      <div className="col-12">
        <label className={LABEL} htmlFor={id("explanation")}>
          Giải thích <span className="text-danger">*</span>
        </label>
        <textarea id={id("explanation")} className="form-control" rows={3} placeholder="Cách dùng, lưu ý..." value={value.explanation ?? ""} onChange={set("explanation")} disabled={disabled} />
      </div>
      <div className="col-12">
        <label className={`${LABEL} fw-bold`} htmlFor={id("exampleSentenceZh")}>
          Ví dụ chính (Tiếng Trung)
        </label>
        <textarea id={id("exampleSentenceZh")} className="form-control" rows={2} placeholder="我是学生。" value={value.exampleSentenceZh ?? ""} onChange={set("exampleSentenceZh")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={`${LABEL} fw-bold`} htmlFor={id("exampleSentencePinyin")}>
          Phiên âm (Pinyin)
        </label>
        <textarea id={id("exampleSentencePinyin")} className="form-control" rows={2} placeholder="Wǒ shì xuésheng." value={value.exampleSentencePinyin ?? ""} onChange={set("exampleSentencePinyin")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={`${LABEL} fw-bold`} htmlFor={id("exampleSentenceVi")}>
          Dịch nghĩa (Tiếng Việt)
        </label>
        <textarea id={id("exampleSentenceVi")} className="form-control" rows={2} placeholder="Tôi là học sinh." value={value.exampleSentenceVi ?? ""} onChange={set("exampleSentenceVi")} disabled={disabled} />
      </div>
      <div className="col-12">
        <label className={LABEL} htmlFor={id("note")}>
          Ghi chú
        </label>
        <textarea id={id("note")} className="form-control" rows={2} value={value.note ?? ""} onChange={set("note")} disabled={disabled} />
      </div>
    </div>
  );
}
