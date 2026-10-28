// DTO khoá học trực tuyến + đăng ký tư vấn (lead) theo HỢP ĐỒNG ĐỀ XUẤT kế thừa `/online-learning/*` của HSK cũ (core/types/online-course.type.ts).
// Khác bản cũ có chủ đích: bỏ index signature `[key: string]: unknown` (bản cũ dùng để `as any`); chỉ giữ các cặp tên/bí danh mà màn hình thật sự
// đọc (name|title, thumbnail|thumbnailUrl, code|slug) vì backend HSK cũ trả lẫn hai kiểu — hợp đồng cuối do backend chốt (docs/api-requirements/online-course.md).

export interface OnlineCourseSummary {
  id: string;
  code?: string;
  slug?: string;
  name?: string;
  title?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  description?: string;
  shortDescription?: string;
  syllabusId?: string;
  price?: number;
  rating?: number;
  /** "Group" | "1-1" (bản cũ so khớp chuỗi chứa "group" / "one" / "1-1"). */
  courseType?: string;
  level?: string;
  totalLessons?: number;
  /** true = đồng bộ từ CMS; false/thiếu = tạo nội bộ. */
  cmsSynced?: boolean;
}

/** Thông tin giáo trình kèm khoá học (GET /online-learning/syllabuses/{id} hoặc `syllabusInfo` của full-detail). */
export interface OnlineSyllabusInfo {
  id?: string;
  name?: string;
  syllabus_description?: string;
  description?: string;
  content?: string;
}

export interface OnlineCourseDetail extends OnlineCourseSummary {
  /** Bí danh snake_case mà HSK cũ trả ở GET /courses/{id}. */
  syllabus_id?: string;
  syllabusInfo?: OnlineSyllabusInfo;
  syllabus_description?: string;
}

export interface OnlineCourseUpsertRequest {
  name?: string;
  thumbnail?: string;
  description?: string;
  price?: number;
  rating?: number;
  syllabusId?: string;
  courseType?: string;
  level?: string;
  totalLessons?: number;
}

export type OnlineSyncJobStatus = "RUNNING" | "SUCCESS" | "FAILED";

export interface OnlineSystemSyncJob {
  jobId: string;
  status: OnlineSyncJobStatus | string;
  currentStep?: string;
  progressPercent?: number;
  message?: string;
  startedAt?: string;
  finishedAt?: string | null;
}

export type OnlineCourseLeadStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";

export interface OnlineCourseLead {
  id: string;
  courseId?: string;
  courseCode: string;
  courseName?: string;
  courseType?: string;
  fullName: string;
  email: string;
  phone: string;
  note?: string;
  registeredAt?: string;
  status?: OnlineCourseLeadStatus | string;
}

export interface OnlineCourseLeadQuery {
  courseCode?: string;
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
  /** Trang từ 0 (Spring Page). */
  page: number;
  size: number;
}

/** Spring Page như HSK cũ: `number` là trang hiện tại (từ 0). */
export interface OnlineCourseLeadPage {
  content: OnlineCourseLead[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
