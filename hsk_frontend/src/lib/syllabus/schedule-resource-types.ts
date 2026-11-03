// "Module ôn luyện theo buổi" của giáo trình — thích nghi theo cơ chế THẬT của IELTS (xem docs/api-requirements/syllabus-modules.md): không có entity
// "module" riêng, chỉ là LearningResource được copy từ Kho HSK vào ContentPackage của CHÍNH giáo trình đó, tại sessionNo = vị trí buổi trong
// `schedule[]` + 1. Chỉ 3 loại có nội dung thật trong Kho (VOCABULARY/FLASHCARD, QUIZ, GRAMMAR) — các loại còn lại của bản đề xuất cũ (WRITING, KANJI,
// PRONUNCIATION, LISTENING, AI_*) chưa từng có nội dung backing, bỏ hẳn khỏi màn này.
// Giá trị của ScheduleResourceType TRÙNG NGUYÊN VĂN với ContentPackageType/LearningResourceType thật ở backend (VOCABULARY, ASSESSMENT, GRAMMAR)
// nên dùng thẳng làm tham số `type` khi gọi `/content-packages`, `/learning-resources`, không cần hàm chuyển đổi riêng.
export type ScheduleResourceType = "VOCABULARY" | "ASSESSMENT" | "GRAMMAR";

export const SCHEDULE_RESOURCE_TYPES: readonly ScheduleResourceType[] = ["VOCABULARY", "ASSESSMENT", "GRAMMAR"];

export const SCHEDULE_RESOURCE_TYPE_LABELS: Record<ScheduleResourceType, string> = {
  VOCABULARY: "Từ vựng",
  ASSESSMENT: "Bài tập (Quiz)",
  GRAMMAR: "Ngữ pháp",
};

/** Nhãn loại module thô từ ERP (`moduleOnLuyen[].moduleType`, vd "FLASHCARD", "WRITING") quy về 1 trong 3 loại có nội dung thật; null = chưa hỗ trợ. */
export function normalizeScheduleResourceType(raw: string | undefined | null): ScheduleResourceType | null {
  const t = (raw ?? "").trim().toUpperCase();
  if (t === "VOCABULARY" || t === "FLASHCARD") return "VOCABULARY";
  if (t === "QUIZ" || t === "ASSESSMENT") return "ASSESSMENT";
  if (t === "GRAMMAR") return "GRAMMAR";
  return null;
}

/** Nhãn hiển thị của loại module thô từ ERP; loại chưa hỗ trợ hiện nguyên văn. */
export function rawModuleTypeLabel(raw: string | undefined | null): string {
  const t = (raw ?? "").trim().toUpperCase();
  if (!t) return "—";
  const normalized = normalizeScheduleResourceType(t);
  return normalized ? SCHEDULE_RESOURCE_TYPE_LABELS[normalized] : t;
}

/** Loại module mà cột "Module ôn luyện" của giáo trình yêu cầu (duy nhất, viết hoa) — giữ nguyên văn ERP để hiển thị đối chiếu. */
export function requiredRawModuleTypes(item: { moduleOnLuyen?: { moduleType?: string }[] }): string[] {
  const types = (item.moduleOnLuyen ?? []).map((m) => (m.moduleType ?? "").trim().toUpperCase()).filter(Boolean);
  return [...new Set(types)];
}

/** Loại yêu cầu (nguyên văn ERP) chưa có resource tương ứng đã gắn trong buổi (so theo loại ĐÃ QUY VỀ 3 loại thật). */
export function missingRawModuleTypes(required: readonly string[], attachedCountByType: Partial<Record<ScheduleResourceType, number>>): string[] {
  return required.filter((raw) => {
    const normalized = normalizeScheduleResourceType(raw);
    return !normalized || !(attachedCountByType[normalized] ?? 0);
  });
}
