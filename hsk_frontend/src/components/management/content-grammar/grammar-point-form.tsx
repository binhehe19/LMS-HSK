"use client";

// Form một ĐIỂM NGỮ PHÁP — port GrammarPointModal.tsx của HSK cũ (tên, cấp HSK, phân loại, định nghĩa chung, cấu trúc, giải thích, ví dụ zh/pinyin/vi,
// ghi chú). Thuần: nhận/trả giá trị qua props (ContentItemFormProps). Khác bản cũ có chủ đích: cấp HSK là ô chọn 1–9 thay cho ô số; bỏ hẳn field
// "Bộ đề bài tập liên kết (id)" (chưa từng có chỗ lưu ở backend, xem lms-grammar-client.ts — field chết, không chỉ ẩn trên form).
import type { ChangeEvent } from "react";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { HSK_LEVEL_OPTIONS } from "@/lib/content/grammar-point";
import type { ContentItemFormProps } from "@/types/content";
import type { GrammarPoint, GrammarPointInput, GrammarRichTextField } from "@/types/content-grammar";

const LABEL = "form-label small fw-700 text-muted mb-1";

export function GrammarPointForm({ value, onChange, disabled, idPrefix, readOnly }: ContentItemFormProps<GrammarPoint> & { readOnly?: boolean }) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const set = (field: keyof GrammarPointInput) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [field]: e.target.value });

  const richField = (field: GrammarRichTextField, label: string, placeholder?: string) => (
    <RichTextEditor label={label} text={value[field] ?? ""} html={value.richText?.[field]} placeholder={placeholder} readOnly={readOnly} disabled={disabled}
      onChange={(text, html) => onChange({ ...value, [field]: text, richText: { ...value.richText, [field]: html } })} />
  );

  return (
    <div className="row g-2" data-testid="grammar-point-form">
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
      <div className="col-md-6">
        <div className={LABEL}>
          Cấu trúc <span className="text-danger">*</span>
        </div>
        {richField("structure", "Cấu trúc", "VD: A + 是 + B")}
      </div>
      <div className="col-md-6">
        <div className={LABEL}>
          Giải thích <span className="text-danger">*</span>
        </div>
        {richField("explanation", "Giải thích", "Cách dùng, lưu ý…")}
      </div>
      <div className="col-md-4">
        <div className={`${LABEL} fw-bold`}>
          Ví dụ chính (Tiếng Trung)
        </div>
        {richField("exampleSentenceZh", "Ví dụ chính (Tiếng Trung)", "我是学生。")}
      </div>
      <div className="col-md-4">
        <div className={`${LABEL} fw-bold`}>
          Phiên âm (Pinyin)
        </div>
        {richField("exampleSentencePinyin", "Phiên âm (Pinyin)", "Wǒ shì xuésheng.")}
      </div>
      <div className="col-md-4">
        <div className={`${LABEL} fw-bold`}>
          Dịch nghĩa (Tiếng Việt)
        </div>
        {richField("exampleSentenceVi", "Dịch nghĩa (Tiếng Việt)", "Tôi là học sinh.")}
      </div>
      <div className="col-12">
        <div className={LABEL}>
          Ghi chú
        </div>
        {richField("note", "Ghi chú")}
      </div>
    </div>
  );
}
