// Hàm thuần của màn Quản lý khoá học trực tuyến (online-course-management-page.tsx cũ): đọc bí danh trường, lọc/sắp xếp phía client, thống kê,
// form sửa, gộp chi tiết + mô tả giáo trình, trạng thái tiến trình đồng bộ. Không import React, không gọi API.
import type { OnlineCourseDetail, OnlineCourseSummary, OnlineCourseUpsertRequest, OnlineSyllabusInfo, OnlineSystemSyncJob } from "@/types/online-course";

export const COURSE_FALLBACK_THUMBNAIL = "/assets/hocba/hocba2co.png";

export function courseName(course: OnlineCourseSummary): string {
  return String(course.name || course.title || "");
}

export function courseCode(course: OnlineCourseSummary): string {
  return String(course.code || course.slug || "");
}

/** URL ảnh bìa; rỗng => dùng ảnh dự phòng (bản cũ: MediaUploadService.normalizeUrl chỉ viết lại URL localhost — không cần ở app mới). */
export function courseThumbnail(course: OnlineCourseSummary): string {
  return String(course.thumbnail || course.thumbnailUrl || "");
}

export function isGroupCourse(course: OnlineCourseSummary): boolean {
  return String(course.courseType || "").toLowerCase().includes("group");
}

export function isOneToOneCourse(course: OnlineCourseSummary): boolean {
  const type = String(course.courseType || "");
  return type.toLowerCase().includes("one") || type.includes("1-1");
}

/** Nhãn huy hiệu loại khoá trên card: có courseType thì "Khóa Nhóm"/"Khóa 1-1" (mọi giá trị không chứa "group" là 1-1, như bản cũ); không có => null. */
export function courseTypeBadge(course: OnlineCourseSummary): string | null {
  if (!course.courseType) return null;
  return isGroupCourse(course) ? "Khóa Nhóm" : "Khóa 1-1";
}

export function formatPrice(value: number | undefined | null): string {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

export function formatRating(value: number | undefined | null): string {
  return Number(value || 0).toFixed(1);
}

export type CourseTypeFilter = "all" | "group" | "1-1";
export type CourseSyncFilter = "all" | "synced" | "local";
export type CoursePriceSort = "none" | "asc" | "desc";

export interface CourseFilters {
  search: string;
  type: CourseTypeFilter;
  sync: CourseSyncFilter;
  priceSort: CoursePriceSort;
}

export const DEFAULT_COURSE_FILTERS: CourseFilters = { search: "", type: "all", sync: "all", priceSort: "none" };

export function hasActiveCourseFilters(filters: CourseFilters): boolean {
  return filters.search !== "" || filters.type !== "all" || filters.sync !== "all" || filters.priceSort !== "none";
}

/** Lọc theo tên/mã (không phân biệt hoa thường), loại, nguồn; sắp theo giá khi được chọn — đúng thứ tự bước của bản cũ. */
export function filterCourses(courses: readonly OnlineCourseSummary[], filters: CourseFilters): OnlineCourseSummary[] {
  const term = filters.search.trim().toLowerCase();
  let result = courses.filter((c) => {
    if (term && !courseName(c).toLowerCase().includes(term) && !courseCode(c).toLowerCase().includes(term)) return false;
    if (filters.type === "group" && !isGroupCourse(c)) return false;
    if (filters.type === "1-1" && !isOneToOneCourse(c)) return false;
    if (filters.sync === "synced" && !c.cmsSynced) return false;
    if (filters.sync === "local" && c.cmsSynced) return false;
    return true;
  });
  if (filters.priceSort !== "none") {
    result = [...result].sort((a, b) => (filters.priceSort === "asc" ? 1 : -1) * (Number(a.price || 0) - Number(b.price || 0)));
  }
  return result;
}

export interface CourseStats {
  total: number;
  synced: number;
  group: number;
  oneToOne: number;
}

export function courseStats(courses: readonly OnlineCourseSummary[]): CourseStats {
  return {
    total: courses.length,
    synced: courses.filter((c) => c.cmsSynced).length,
    group: courses.filter(isGroupCourse).length,
    oneToOne: courses.filter(isOneToOneCourse).length,
  };
}

// ---- form sửa khoá học ----

export interface CourseFormValues {
  name: string;
  thumbnail: string;
  description: string;
  syllabusId: string;
  price: string;
  rating: string;
  courseType: string;
  level: string;
  totalLessons: string;
}

export function formFromCourse(course: OnlineCourseSummary): CourseFormValues {
  return {
    name: courseName(course),
    thumbnail: courseThumbnail(course),
    description: stripHtmlText(course.description || course.shortDescription || ""),
    syllabusId: String(course.syllabusId || ""),
    price: course.price ? String(course.price) : "",
    rating: course.rating ? String(course.rating) : "",
    courseType: String(course.courseType || ""),
    level: String(course.level || ""),
    totalLessons: course.totalLessons ? String(course.totalLessons) : "",
  };
}

/** Thông điệp lỗi hoặc null khi hợp lệ (bản cũ chỉ bắt buộc tên; thêm kiểm tra số không âm cho giá/số bài). */
export function validateCourseForm(form: CourseFormValues): string | null {
  if (!form.name.trim()) return "Vui lòng nhập tên khóa học";
  if (form.price && (Number.isNaN(Number(form.price)) || Number(form.price) < 0)) return "Học phí không hợp lệ";
  if (form.totalLessons && (!Number.isInteger(Number(form.totalLessons)) || Number(form.totalLessons) < 0)) return "Số bài học không hợp lệ";
  return null;
}

/** Trường rỗng => bỏ (undefined) để không ghi đè dữ liệu bằng chuỗi rỗng, như `toPayload` của bản cũ. */
export function toUpsertPayload(form: CourseFormValues): OnlineCourseUpsertRequest {
  return {
    name: form.name.trim() || undefined,
    thumbnail: form.thumbnail.trim() || undefined,
    description: form.description.trim() || undefined,
    syllabusId: form.syllabusId.trim() || undefined,
    price: form.price ? Number(form.price) : undefined,
    rating: form.rating ? Number(form.rating) : undefined,
    courseType: form.courseType || undefined,
    level: form.level.trim() || undefined,
    totalLessons: form.totalLessons ? Number(form.totalLessons) : undefined,
  };
}

// ---- chi tiết khoá học ----

// Bảng thực thể của html-utils.ts cũ (CMS trả `&oacute;`, `&agrave;`... cho tiếng Việt) + ký tự thông dụng.
const NAMED_ENTITIES: Record<string, string> = {
  agrave: "à", aacute: "á", atilde: "ã", acirc: "â", egrave: "è", eacute: "é", ecirc: "ê", igrave: "ì", iacute: "í",
  ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ugrave: "ù", uacute: "ú", ygrave: "ỳ", yacute: "ý",
  Agrave: "À", Aacute: "Á", Atilde: "Ã", Acirc: "Â", Egrave: "È", Eacute: "É", Ecirc: "Ê", Igrave: "Ì", Iacute: "Í",
  Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ugrave: "Ù", Uacute: "Ú", Ygrave: "Ỳ", Yacute: "Ý",
  nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", bull: "•", copy: "©", reg: "®", trade: "™",
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
};

/**
 * Bỏ thẻ HTML + giải mã thực thể cơ bản → văn bản thuần (rút gọn từ html-utils.ts cũ; CMS trả mô tả dạng rich-text). Màn hình mới KHÔNG dùng
 * dangerouslySetInnerHTML nên chỉ cần văn bản thuần.
 */
export function stripHtmlText(html: string | null | undefined): string {
  if (!html) return "";
  const text = String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? match);
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Mô tả giáo trình từ một đối tượng giáo trình (ba tên trường CMS từng trả), đã bỏ HTML; "" nếu không có. */
export function pickSyllabusDescription(info: OnlineSyllabusInfo | undefined | null): string {
  if (!info) return "";
  return stripHtmlText(info.syllabus_description || info.description || info.content || "");
}

/** Gộp GET /courses/{id} với GET /courses/{id}/full-detail (full-detail ghi đè; mô tả giáo trình lấy từ bất kỳ nguồn nào có), như openDetail cũ. */
export function mergeCourseDetail(detail: OnlineCourseDetail | null, full: OnlineCourseDetail | null): OnlineCourseDetail | null {
  if (!detail && !full) return null;
  const merged: OnlineCourseDetail = { ...(detail ?? {}), ...(full ?? {}) } as OnlineCourseDetail;
  const description = stripHtmlText(full?.syllabus_description || detail?.syllabus_description || "") || pickSyllabusDescription(full?.syllabusInfo ?? detail?.syllabusInfo);
  merged.syllabus_description = description || undefined;
  merged.syllabusId = String(full?.syllabusId || detail?.syllabusId || full?.syllabus_id || detail?.syllabus_id || "") || undefined;
  return merged;
}

export type DescriptionSegment = { kind: "heading" | "text"; value: string };

const DESCRIPTION_HEADINGS = /(Đối tượng:|Mục tiêu:|Nội dung cốt lõi:|Kỹ năng thực chiến:)/gi;

/** Tách mô tả giáo trình thành đoạn thường và tiêu đề con (bản cũ bọc <strong> qua innerHTML; ở đây render bằng React). */
export function splitSyllabusDescription(text: string): DescriptionSegment[] {
  return text
    .split(DESCRIPTION_HEADINGS)
    .filter((part) => part !== "")
    .map((part) => ({ kind: /^(Đối tượng:|Mục tiêu:|Nội dung cốt lõi:|Kỹ năng thực chiến:)$/i.test(part) ? "heading" : "text", value: part }));
}

// ---- tiến trình đồng bộ ----

export type SyncTone = "syncing" | "success" | "failed";

export interface SyncJobView {
  tone: SyncTone;
  icon: string;
  title: string;
  description: string;
  progress: number;
  step: string;
  finished: boolean;
}

export function syncJobView(job: OnlineSystemSyncJob | null): SyncJobView {
  const status = String(job?.status || "").toUpperCase();
  if (status === "SUCCESS") {
    return { tone: "success", icon: "isax isax-tick-circle", title: "Đồng Bộ Thành Công", description: "Dữ liệu khóa học đã được cập nhật mới nhất từ hệ thống quản trị nội dung.", progress: 100, step: job?.currentStep || "Hoàn tất", finished: true };
  }
  if (status === "FAILED") {
    return { tone: "failed", icon: "isax isax-info-circle", title: "Đồng Bộ Thất Bại", description: job?.message || "Đã có lỗi xảy ra trong quá trình đồng bộ dữ liệu. Vui lòng thử lại sau.", progress: job?.progressPercent || 0, step: job?.currentStep || "", finished: true };
  }
  return {
    tone: "syncing",
    icon: "isax isax-refresh",
    title: "Đang Đồng Bộ Dữ Liệu",
    description: "Hệ thống đang thực hiện kết nối và tải dữ liệu từ CMS. Quá trình này có thể mất vài phút.",
    progress: job?.progressPercent || 15, // bản cũ: thanh tối thiểu 15% khi chưa có số liệu
    step: job?.currentStep || "Đang kết nối...",
    finished: false,
  };
}
