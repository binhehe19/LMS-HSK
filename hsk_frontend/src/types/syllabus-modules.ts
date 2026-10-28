// DTO "module ôn luyện theo buổi" của giáo trình — HỢP ĐỒNG ĐỀ XUẤT (WAITING FOR BACKEND) qua hskClient, kế thừa OnlineScheduleModule /
// OnlineScheduleAvailableModule của HSK cũ (core/types/online-course.type.ts, service online-course.service.ts). Hợp đồng chi tiết:
// docs/api-requirements/syllabus-modules.md.
// Khác bản cũ có chủ đích (theo brief M5 W2-D): `order` thay `moduleOrder`; sắp xếp gửi `{ ids }` (thứ tự mới) thay `{ items: [{ id, newOrder }] }`;
// bỏ index signature `[key: string]: unknown` và các trường tiến độ học viên (isCompleted, my-progress) vì màn quản lý không dùng.

export type ScheduleModuleType =
  | "FLASHCARD"
  | "VOCABULARY"
  | "WRITING"
  | "KANJI"
  | "PRONUNCIATION"
  | "QUIZ"
  | "LISTENING"
  | "GRAMMAR"
  | "LESSON_MATERIAL"
  | "AI_PRACTICE"
  | "AI_WRITING"
  | "AI_SPEAKING"
  | "AI_LISTENING"
  | "AI_READING";

export interface ScheduleModule {
  id: string;
  /** id buổi học trong giáo trình (SyllabusScheduleItem.id của backend chung). */
  scheduleId: string;
  /** Backend có thể trả loại chưa có trong enum => hiển thị nguyên văn. */
  moduleType: ScheduleModuleType | string;
  /** id bộ nội dung (study set / quiz / bộ ngữ pháp...) của kho HSK. */
  contentSetId?: string;
  title?: string;
  /** Thứ tự học trong buổi, từ 1. */
  order: number;
  /** Chỉ QUIZ: kỹ năng (PRACTICE | LISTENING | READING | WRITING | SPEAKING | PHONETICS | TRANSLATION | GRAMMAR_3_0). */
  skillType?: string;
}

/** Bộ nội dung có sẵn trong kho HSK theo loại (GET /schedule-available-modules/{TYPE}). */
export interface ScheduleAvailableModule {
  id: string;
  title?: string;
  moduleType?: ScheduleModuleType | string;
  /** Gói / thư mục chứa bộ nội dung — dòng phụ khi chọn. */
  repoName?: string;
  itemCount?: number;
}

export interface CreateScheduleModuleRequest {
  scheduleId: string;
  moduleType: ScheduleModuleType;
  contentSetId: string;
  title: string;
  skillType?: string;
}

export interface ReorderScheduleModulesRequest {
  /** Toàn bộ id module của buổi theo thứ tự mới. */
  ids: string[];
}
