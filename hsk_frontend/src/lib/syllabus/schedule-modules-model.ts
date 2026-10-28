// Hàm thuần cho "module ôn luyện theo buổi" (DTO types/syllabus-modules.ts): nhãn loại module, loại nội dung để tải kho, sắp thứ tự, tính module còn
// thiếu so với cột "Module ôn luyện" của giáo trình — NGUYÊN VĂN quy tắc của syllabus-management-modal.tsx HSK cũ (MODULE_TYPE_LABELS,
// getApiLabelByModuleType, getMissingPracticeTypes). Không import React/Next, không gọi API.
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import type { SyllabusScheduleItem } from "@/types/lms";
import type { ScheduleModule, ScheduleModuleType } from "@/types/syllabus-modules";

export const MODULE_TYPE_LABELS: Record<ScheduleModuleType, string> = {
  FLASHCARD: "Flashcard",
  VOCABULARY: "Từ vựng",
  WRITING: "Luyện Viết",
  KANJI: "Nguồn gốc Hán tự",
  PRONUNCIATION: "Phát âm",
  QUIZ: "Quiz",
  LISTENING: "Luyện nghe",
  GRAMMAR: "Ngữ pháp",
  LESSON_MATERIAL: "Tài liệu học tập",
  AI_PRACTICE: "Luyện tập với AI",
  AI_WRITING: "Luyện tập với AI",
  AI_SPEAKING: "Luyện tập với AI",
  AI_LISTENING: "Luyện tập với AI",
  AI_READING: "Luyện tập với AI",
};

/**
 * Loại module được THÊM từ màn này (hợp đồng brief W2-D). Không có LESSON_MATERIAL (gắn học liệu có màn Tài liệu học tập riêng), LISTENING (cần chọn
 * video từ kho — chưa chuyển) và AI_* (bản cũ đã tắt trong dropdown).
 */
export const ADDABLE_MODULE_TYPES: readonly ScheduleModuleType[] = ["VOCABULARY", "FLASHCARD", "WRITING", "KANJI", "PRONUNCIATION", "QUIZ", "GRAMMAR"];

/** Kỹ năng của QUIZ (QUIZ_SKILL_OPTIONS của bản cũ). */
export const QUIZ_SKILL_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "PRACTICE", label: "Ôn tập" },
  { value: "LISTENING", label: "Nghe" },
  { value: "READING", label: "Đọc" },
  { value: "WRITING", label: "Viết" },
  { value: "SPEAKING", label: "Nói" },
  { value: "PHONETICS", label: "Ngữ âm" },
  { value: "TRANSLATION", label: "Dịch" },
  { value: "GRAMMAR_3_0", label: "Ngữ pháp 3.0" },
];

function isKnownType(type: string): type is ScheduleModuleType {
  return type in MODULE_TYPE_LABELS;
}

/** Nhãn tiếng Việt của loại module; loại lạ hiện nguyên văn, rỗng => "—". */
export function moduleTypeLabel(type: string | undefined | null): string {
  const normalized = (type ?? "").trim().toUpperCase();
  if (!normalized) return "—";
  return isKnownType(normalized) ? MODULE_TYPE_LABELS[normalized] : normalized;
}

/** Loại NỘI DUNG để tải kho có sẵn: Từ vựng tái dùng study set của Flashcard; mọi AI_* dùng chung kho AI_PRACTICE (moduleType lưu xuống vẫn giữ nguyên). */
export function contentTypeOf(type: ScheduleModuleType | string): string {
  const normalized = type.trim().toUpperCase();
  if (normalized === "VOCABULARY") return "FLASHCARD";
  if (normalized.startsWith("AI_")) return "AI_PRACTICE";
  return normalized;
}

/** Theo `order` tăng dần, ổn định; `order` không phải số coi là 0 (như `Number(a.moduleOrder) || 0` của bản cũ). */
export function sortModules(list: readonly ScheduleModule[]): ScheduleModule[] {
  return list
    .map((m, i) => ({ m, i }))
    .sort((a, b) => (Number(a.m.order) || 0) - (Number(b.m.order) || 0) || a.i - b.i)
    .map(({ m }) => m);
}

/** Thứ tự id mới sau khi đưa một module lên (-1) / xuống (+1); không di chuyển được (đầu/cuối/không tồn tại) => null. */
export function movedIds(list: readonly ScheduleModule[], moduleId: string, direction: -1 | 1): string[] | null {
  const ordered = sortModules(list);
  const from = ordered.findIndex((m) => m.id === moduleId);
  if (from < 0) return null;
  const to = from + direction;
  if (to < 0 || to >= ordered.length) return null;
  const ids = ordered.map((m) => m.id);
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  return ids;
}

const normalizeRequired = (type: string): string => (type.startsWith("AI_") ? "AI_PRACTICE" : type);

/** Loại module mà cột "Module ôn luyện" của giáo trình yêu cầu (duy nhất, viết hoa, AI_* gộp thành AI_PRACTICE). */
export function requiredModuleTypes(item: Pick<SyllabusScheduleItem, "moduleOnLuyen">): string[] {
  const types = (item.moduleOnLuyen ?? []).map((m) => normalizeRequired((m.moduleType ?? "").trim().toUpperCase())).filter(Boolean);
  return [...new Set(types)];
}

/** Loại yêu cầu chưa có module tương ứng trong buổi. */
export function missingModuleTypes(required: readonly string[], modules: readonly ScheduleModule[]): string[] {
  const existing = new Set(modules.map((m) => normalizeRequired(String(m.moduleType ?? "").toUpperCase())));
  return required.filter((t) => !existing.has(t));
}

export const WRITE_NOT_INTEGRATED_MESSAGE = "Thao tác chưa được tích hợp với backend (WAITING FOR BACKEND).";

/** Thông điệp toast sau một thao tác ghi thất bại: công tắc đóng / chưa cấu hình => "chưa tích hợp"; ApiError => thông điệp của nó; lỗi lạ => câu dự phòng. */
export function moduleActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof WriteDisabledError || error instanceof ApiNotConfiguredError) return WRITE_NOT_INTEGRATED_MESSAGE;
  if (error instanceof ApiError && error.message) return error.message;
  return fallback;
}
