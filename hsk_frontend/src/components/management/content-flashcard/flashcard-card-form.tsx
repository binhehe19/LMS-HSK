"use client";

// Form một thẻ ghi nhớ (các trường của CreateStudySetWithCardsModal / EditCardModal cũ: Chữ Hán, Pinyin, Từ loại, Nghĩa tiếng Việt, Ví dụ minh hoạ,
// Dịch câu) + ảnh/âm thanh qua kho lưu trữ backend chung. Thuần: nhận/trả giá trị qua props (ContentItemFormProps).
// Khác bản cũ có chủ đích: bỏ "Pinyin câu ví dụ" và "trường bổ sung" (customFields) — không có trong hợp đồng đề xuất M5; ảnh là tệp tải lên, không phải URL.
import type { ChangeEvent } from "react";
import { ContentFileField } from "@/components/management/content-tree/content-file-field";
import type { ContentItemFormProps } from "@/types/content";
import type { FlashcardCard, FlashcardCardInput } from "@/types/content-flashcard";

const LABEL = "form-label small fw-700 text-muted mb-1";

export function FlashcardCardForm({ value, onChange, disabled, idPrefix }: ContentItemFormProps<FlashcardCard>) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const set = (field: keyof FlashcardCardInput) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [field]: e.target.value });

  return (
    <div className="row g-3" data-testid="flashcard-card-form">
      <div className="col-md-4">
        <label className={LABEL} htmlFor={id("term")}>
          Chữ Hán <span className="text-danger">*</span>
        </label>
        <input id={id("term")} type="text" className="form-control flashcard-term-cell" placeholder="Nhập chữ Hán..." value={value.term} onChange={set("term")} disabled={disabled} />
      </div>
      <div className="col-md-4">
        <label className={LABEL} htmlFor={id("pinyin")}>
          Pinyin
        </label>
        <input id={id("pinyin")} type="text" className="form-control" placeholder="Ví dụ: nǐ hǎo" value={value.pinyin ?? ""} onChange={set("pinyin")} disabled={disabled} />
      </div>
      <div className="col-md-4">
        <label className={LABEL} htmlFor={id("wordType")}>
          Từ loại
        </label>
        <input id={id("wordType")} type="text" className="form-control" placeholder="Danh từ, Động từ..." value={value.wordType ?? ""} onChange={set("wordType")} disabled={disabled} />
      </div>
      <div className="col-12">
        <label className={LABEL} htmlFor={id("meaning")}>
          Nghĩa tiếng Việt <span className="text-danger">*</span>
        </label>
        <input id={id("meaning")} type="text" className="form-control" placeholder="Nhập nghĩa tiếng Việt..." value={value.meaning} onChange={set("meaning")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("example")}>
          Ví dụ minh hoạ
        </label>
        <textarea id={id("example")} className="form-control" rows={2} placeholder="Nhập câu ví dụ..." value={value.example ?? ""} onChange={set("example")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("exampleMeaning")}>
          Dịch câu
        </label>
        <textarea id={id("exampleMeaning")} className="form-control" rows={2} placeholder="Nhập nghĩa câu ví dụ..." value={value.exampleMeaning ?? ""} onChange={set("exampleMeaning")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <ContentFileField id={id("image")} label="Ảnh minh hoạ" kind="image" fileId={value.imageFileId} onChange={(fileId) => onChange({ ...value, imageFileId: fileId })} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <ContentFileField id={id("audio")} label="Âm thanh phát âm" kind="audio" fileId={value.audioFileId} onChange={(fileId) => onChange({ ...value, audioFileId: fileId })} disabled={disabled} />
      </div>
    </div>
  );
}
