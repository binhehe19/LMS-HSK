"use client";

// Form một thẻ ghi nhớ (các trường của CreateStudySetWithCardsModal / EditCardModal cũ: Chữ Hán, Pinyin, Từ loại, Nghĩa tiếng Việt, Ví dụ minh hoạ,
// Pinyin câu ví dụ, Dịch câu, Trường bổ sung) + ảnh/âm thanh qua kho lưu trữ backend chung. Thuần: nhận/trả giá trị qua props (ContentItemFormProps).
// Khác bản cũ: ảnh là tệp tải lên (ContentFileField), không phải URL tự do.
import type { ChangeEvent } from "react";
import { ContentFileField } from "@/components/management/content-tree/content-file-field";
import type { ContentItemFormProps } from "@/types/content";
import type { FlashcardCard, FlashcardCardInput, FlashcardCustomField } from "@/types/content-flashcard";

const LABEL = "form-label small fw-700 text-muted mb-1";

function updateFieldAt(list: readonly FlashcardCustomField[], index: number, patch: Partial<FlashcardCustomField>): FlashcardCustomField[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

export function FlashcardCardForm({ value, onChange, disabled, idPrefix }: ContentItemFormProps<FlashcardCard>) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const set = (field: keyof FlashcardCardInput) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [field]: e.target.value });
  const customFields = value.customFields ?? [];

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
        <label className={LABEL} htmlFor={id("example-pinyin")}>
          Pinyin câu ví dụ
        </label>
        <input id={id("example-pinyin")} type="text" className="form-control" placeholder="Nhập pinyin câu ví dụ..." value={value.examplePinyin ?? ""} onChange={set("examplePinyin")} disabled={disabled} />
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

      <div className="col-12">
        <div className="d-flex align-items-center justify-content-between mb-1">
          <label className={`${LABEL} mb-0`}>Trường bổ sung (hiển thị ở mặt sau)</label>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger rounded-pill"
            onClick={() => onChange({ ...value, customFields: [...customFields, { label: "", value: "" }] })}
            disabled={disabled}
          >
            <i className="isax isax-add me-1" />
            Thêm trường
          </button>
        </div>
        {customFields.length === 0 ? (
          <p className="text-muted small fst-italic mb-0">Chưa có trường nào. VD: Từ đồng nghĩa, Từ trái nghĩa...</p>
        ) : (
          customFields.map((field, i) => (
            <div key={i} className="d-flex align-items-center gap-2 mb-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Nhãn (vd: Từ đồng nghĩa)"
                aria-label={`Nhãn trường bổ sung ${i + 1}`}
                value={field.label}
                onChange={(e) => onChange({ ...value, customFields: updateFieldAt(customFields, i, { label: e.target.value }) })}
                disabled={disabled}
              />
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Giá trị"
                aria-label={`Giá trị trường bổ sung ${i + 1}`}
                value={field.value}
                onChange={(e) => onChange({ ...value, customFields: updateFieldAt(customFields, i, { value: e.target.value }) })}
                disabled={disabled}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline-danger rounded-circle flex-shrink-0"
                style={{ width: 30, height: 30, padding: 0 }}
                onClick={() => onChange({ ...value, customFields: customFields.filter((_, j) => j !== i) })}
                disabled={disabled}
                aria-label={`Xóa trường bổ sung ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
