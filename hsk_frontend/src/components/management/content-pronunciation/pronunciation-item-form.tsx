"use client";

// Form MỘT mục phát âm — port phần "Item Modal" của manage-pronunciation.tsx cũ (Ký hiệu*, Pinyin, Hướng dẫn phát âm, Âm thanh, Hình miệng) với
// âm thanh/ảnh là tệp của kho lưu trữ backend chung (ContentFileField: presign → PUT → confirm) thay cho MediaUploadService trả URL.
// Khác bản cũ có chủ đích: bỏ "Loại âm" (Shengmu/Yunmu), "Hán tự", "Ví dụ từ / Pinyin ví dụ / Nghĩa ví dụ" — không có trong hợp đồng đề xuất M5
// (ghi ở báo cáo W2-E để backend cân nhắc); tệp tải lên ngay khi chọn (bản cũ tải lúc bấm Lưu).
import type { ChangeEvent } from "react";
import { ContentFileField } from "@/components/management/content-tree/content-file-field";
import type { ContentItemFormProps } from "@/types/content";
import type { PronunciationItem, PronunciationItemInput } from "@/types/content-pronunciation";

const LABEL = "form-label small fw-700 text-muted mb-1";

type TextField = Exclude<keyof PronunciationItemInput, "audioFileId" | "imageFileId" | "index">;

export function PronunciationItemForm({ value, onChange, disabled, idPrefix }: ContentItemFormProps<PronunciationItem>) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const set = (field: TextField) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [field]: e.target.value });

  return (
    <div className="row g-3" data-testid="pronunciation-item-form">
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("text")}>
          Ký hiệu / Từ <span className="text-danger">*</span>
        </label>
        <input id={id("text")} type="text" className="form-control flashcard-term-cell" placeholder="VD: zh hoặc 妈" value={value.text} onChange={set("text")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("pinyin")}>
          Pinyin
        </label>
        <input id={id("pinyin")} type="text" className="form-control" placeholder="VD: mā" value={value.pinyin ?? ""} onChange={set("pinyin")} disabled={disabled} />
      </div>
      <div className="col-12">
        <label className={LABEL} htmlFor={id("tip")}>
          Hướng dẫn phát âm
        </label>
        <textarea id={id("tip")} className="form-control" rows={3} placeholder="Khẩu hình, vị trí lưỡi, thanh điệu, lỗi thường gặp của người Việt..." value={value.tip ?? ""} onChange={set("tip")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <ContentFileField id={id("audio")} label="Âm thanh mẫu" kind="audio" fileId={value.audioFileId} onChange={(fileId) => onChange({ ...value, audioFileId: fileId })} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <ContentFileField id={id("image")} label="Hình miệng (khẩu hình)" kind="image" fileId={value.imageFileId} onChange={(fileId) => onChange({ ...value, imageFileId: fileId })} disabled={disabled} />
      </div>
    </div>
  );
}
