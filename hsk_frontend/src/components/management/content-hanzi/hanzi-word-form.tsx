"use client";

// Form MỘT chữ Hán của module Luyện viết — các cột của create-set-page.tsx cũ (Chữ Hán, Phiên âm, Ý nghĩa, Ví dụ) + Số nét, Bộ thủ, Hán Việt, Nghĩa ví dụ
// theo brief W2-E. Thuần: nhận/trả giá trị qua props (ContentItemFormProps). Không có ảnh/âm thanh: bản cũ cũng không cho tải tệp cho chữ luyện viết.
import type { ChangeEvent } from "react";
import { parseStrokeCount, STROKE_COUNT_MAX, STROKE_COUNT_MIN } from "@/lib/content/hanzi-word";
import type { ContentItemFormProps } from "@/types/content";
import type { HanziWord, HanziWordInput } from "@/types/content-writing";

const LABEL = "form-label small fw-700 text-muted mb-1";

type TextField = Exclude<keyof HanziWordInput, "strokeCount" | "index">;

export function HanziWordForm({ value, onChange, disabled, idPrefix }: ContentItemFormProps<HanziWord>) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const set = (field: TextField) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [field]: e.target.value });
  // Số nét là number | undefined trong input; ô rỗng => undefined (không gửi), chuỗi lạ => NaN để validate báo "Số nét phải là số nguyên...".
  const strokeValue = value.strokeCount === undefined || Number.isNaN(value.strokeCount) ? "" : String(value.strokeCount);

  return (
    <div className="row g-3" data-testid="hanzi-word-form">
      <div className="col-md-3">
        <label className={LABEL} htmlFor={id("hanzi")}>
          Chữ Hán <span className="text-danger">*</span>
        </label>
        <input id={id("hanzi")} type="text" className="form-control flashcard-term-cell" placeholder="VD: 我" value={value.hanzi} onChange={set("hanzi")} disabled={disabled} />
      </div>
      <div className="col-md-3">
        <label className={LABEL} htmlFor={id("pinyin")}>
          Phiên âm <span className="text-danger">*</span>
        </label>
        <input id={id("pinyin")} type="text" className="form-control" placeholder="VD: wǒ" value={value.pinyin ?? ""} onChange={set("pinyin")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("meaning")}>
          Nghĩa <span className="text-danger">*</span>
        </label>
        <input id={id("meaning")} type="text" className="form-control" placeholder="VD: tôi" value={value.meaning ?? ""} onChange={set("meaning")} disabled={disabled} />
      </div>
      <div className="col-md-3">
        <label className={LABEL} htmlFor={id("strokeCount")}>
          Số nét
        </label>
        <input id={id("strokeCount")} type="number" inputMode="numeric" min={STROKE_COUNT_MIN} max={STROKE_COUNT_MAX} className="form-control" placeholder="VD: 7" value={strokeValue} onChange={(e) => onChange({ ...value, strokeCount: parseStrokeCount(e.target.value) })} disabled={disabled} />
      </div>
      <div className="col-md-3">
        <label className={LABEL} htmlFor={id("radical")}>
          Bộ thủ
        </label>
        <input id={id("radical")} type="text" className="form-control flashcard-term-cell" placeholder="VD: 戈" value={value.radical ?? ""} onChange={set("radical")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("sinoVn")}>
          Hán Việt
        </label>
        <input id={id("sinoVn")} type="text" className="form-control" placeholder="VD: ngã" value={value.sinoVn ?? ""} onChange={set("sinoVn")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("example")}>
          Ví dụ
        </label>
        <textarea id={id("example")} className="form-control" rows={2} placeholder="VD: 我是学生。" value={value.example ?? ""} onChange={set("example")} disabled={disabled} />
      </div>
      <div className="col-md-6">
        <label className={LABEL} htmlFor={id("exampleMeaning")}>
          Nghĩa ví dụ
        </label>
        <textarea id={id("exampleMeaning")} className="form-control" rows={2} placeholder="VD: Tôi là học sinh." value={value.exampleMeaning ?? ""} onChange={set("exampleMeaning")} disabled={disabled} />
      </div>
    </div>
  );
}
