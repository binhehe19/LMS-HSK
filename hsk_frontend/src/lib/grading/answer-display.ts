// Hàm thuần đọc câu trả lời của học viên ở nhiều hình dạng (HSK cũ: components/question-grading-card.tsx, `any` đổi thành `unknown`). Backend lưu
// studentAnswer theo từng loại câu: id đáp án (trắc nghiệm), { pairMatches: [...] } (nối cặp), { blankAnswers: [...] } (điền khuyết), mảng id mảnh
// (ghép câu), văn bản (tự luận). Các hàm này chỉ chuẩn hoá để hiển thị, không tính điểm (tính điểm ở grading-helpers.ts).

export const isEmptyAnswer = (v: unknown): boolean => v === null || v === undefined || v === "";

export const textify = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(textify).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const row = v as Record<string, unknown>;
    const pick = row.answer ?? row.value ?? row.text ?? row.content ?? row.id;
    return pick !== undefined ? textify(pick) : JSON.stringify(v);
  }
  return String(v);
};

export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Id các đáp án học viên đã chọn (trắc nghiệm): chuỗi, mảng chuỗi, mảng object {optionId|id|selectedOptionId}, hoặc object {selectedOptionIds|...}. */
export const selectedOptionIds = (sa: unknown): string[] => {
  if (sa === null || sa === undefined) return [];
  if (Array.isArray(sa)) {
    return sa
      .map((x) => (isRecord(x) ? (x.optionId ?? x.id ?? x.selectedOptionId) : x))
      .filter((x) => x != null)
      .map(String);
  }
  if (isRecord(sa)) {
    if (Array.isArray(sa.selectedOptionIds)) return sa.selectedOptionIds.map(String);
    const single = sa.selectedOptionId ?? sa.optionId ?? sa.id;
    return single != null ? [String(single)] : [];
  }
  return [String(sa)];
};

/** Bản đồ promptId -> answerId mà học viên đã nối. */
export const studentPairMap = (sa: unknown): Record<string, string> => {
  const map: Record<string, string> = {};
  let items: unknown = sa;
  if (isRecord(sa)) {
    if (Array.isArray(sa.pairMatches)) items = sa.pairMatches;
    else if (Array.isArray(sa.matchAnswers)) items = sa.matchAnswers;
    else {
      Object.entries(sa).forEach(([k, v]) => {
        map[String(k)] = textify(v);
      });
      return map;
    }
  }
  asArray(items).forEach((it) => {
    if (!isRecord(it)) return;
    const p = it.promptId ?? it.leftItemId ?? it.leftId ?? it.left;
    const a = it.answerId ?? it.rightItemId ?? it.rightId ?? it.right ?? it.answer;
    if (p != null) map[String(p)] = a != null ? String(a) : "";
  });
  return map;
};

/**
 * Câu trả lời của học viên cho ô trống thứ `idx` (FILL_IN_BLANK). Backend trả dạng bọc { blankAnswers: [{ blankIndex, answer }] } — phải mở gói trước
 * khi tra theo index, nếu không sẽ luôn tìm không thấy và hiện trống dù học viên đã trả lời (lỗi đã gặp ở HSK cũ).
 */
export const studentBlankAnswer = (student: unknown, idx: number): string => {
  let items: unknown = student;
  if (isRecord(items) && Array.isArray(items.blankAnswers)) items = items.blankAnswers;
  if (Array.isArray(items)) {
    const f = items.find((x) => isRecord(x) && (x.blankIndex ?? x.index) === idx);
    return isRecord(f) ? textify(f.answer ?? f.value ?? f) : "";
  }
  if (isRecord(items)) return textify(items[idx] ?? items[String(idx)] ?? "");
  return idx === 0 ? textify(items) : "";
};

/** Thứ tự id mảnh câu học viên đã ghép (SENTENCE_BUILDER). */
export const studentChunkOrder = (sa: unknown): string[] => asArray(sa).map((x) => (isRecord(x) ? (x.id ?? x.chunkId) : x)).map(String);

/** Tách "chữ Hán / pinyin" (hoặc nhiều dòng) của một vế nối cặp thành dòng chính + dòng phụ. */
export const parseGradingMatchText = (text?: string | null): { primary: string; secondary: string } => {
  if (!text) return { primary: "", secondary: "" };
  const trimmed = text.trim();
  if (!trimmed) return { primary: "", secondary: "" };

  let parts: string[] = [];
  if (trimmed.includes("\n")) {
    parts = trimmed.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  } else if (trimmed.includes("/")) {
    parts = trimmed.split("/").map((s) => s.trim()).filter(Boolean);
  } else {
    parts = [trimmed];
  }

  if (parts.length <= 1) return { primary: trimmed, secondary: "" };
  return { primary: parts[0], secondary: parts.slice(1).join(" / ") };
};
