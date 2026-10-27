// Hàm thuần của module Luyện phát âm: form mục, kiểm tra, chuẩn hoá, tên ngắn. Không import React/Next.
// Bản cũ (manage-pronunciation.tsx) chỉ bắt buộc `symbol` ("Vui lòng nhập symbol"); ở đây là `text` theo hợp đồng đề xuất.
import type { PronunciationItem, PronunciationItemInput } from "@/types/content-pronunciation";

export function emptyPronunciationInput(): PronunciationItemInput {
  return { text: "", pinyin: "", tip: "", audioFileId: undefined, imageFileId: undefined };
}

export function pronunciationToInput(item: PronunciationItem): PronunciationItemInput {
  return {
    text: item.text,
    pinyin: item.pinyin ?? "",
    tip: item.tip ?? "",
    audioFileId: item.audioFileId || undefined,
    imageFileId: item.imageFileId || undefined,
    index: item.index,
  };
}

export function validatePronunciationInput(input: PronunciationItemInput): string | null {
  if (!input.text.trim()) return "Vui lòng nhập ký hiệu hoặc từ cần phát âm";
  return null;
}

const clean = (value: string | undefined): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};

export function normalizePronunciationInput(input: PronunciationItemInput): PronunciationItemInput {
  return {
    text: input.text.trim(),
    pinyin: clean(input.pinyin),
    tip: clean(input.tip),
    audioFileId: clean(input.audioFileId),
    imageFileId: clean(input.imageFileId),
    index: input.index,
  };
}

/** Tên ngắn cho hộp xác nhận/toast: "妈 (mā)" hoặc chỉ ký hiệu khi không có pinyin. */
export function pronunciationSummary(item: PronunciationItem): string {
  const pinyin = item.pinyin?.trim();
  return pinyin && pinyin !== item.text ? `${item.text} (${pinyin})` : item.text;
}
