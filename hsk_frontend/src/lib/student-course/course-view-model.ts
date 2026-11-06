// Hàm thuần của màn "Khoá học" học viên (/student/student-courses): ghép dữ liệu API với dữ liệu biên tập tĩnh, lọc/sắp xếp,
// số liệu hero. Giữ nguyên quy tắc của HSK cũ (features/student/student-course/student-course.tsx), bỏ các số minh hoạ giả
// (tiến độ 65% cho "đang học", trình độ cố định 0 → HSK2 → HSK5, danh sách khoá mẫu khi API rỗng).
import {
  AUDIENCES,
  CATALOG_COURSES,
  CATEGORY_FALLBACK_IMAGE,
  COURSE_CATEGORIES,
  inferCategory,
  PRICE_MAX,
  STUDY_FORMS,
  type AudienceId,
  type CategoryId,
  type StudyFormId,
} from "@/components/student/course/data/catalog-courses";
import { stripHtml } from "@/components/student/course/html-utils";
import type { StudentCourseApi, StudentCourseDetailApi, SyllabusStatus } from "@/types/student-course";

export type ViewMode = "all" | "mine";
export type SortId = "newest" | "oldest" | "price-asc" | "price-desc";

export interface CourseVM {
  id: string;
  code: string;
  /** Chữ đứng sau "KHOÁ" trên thẻ */
  cardLabel: string;
  title: string;
  category: CategoryId;
  audiences: AudienceId[];
  studyForm: StudyFormId;
  price: number;
  levelIn: string;
  levelOut: string;
  totalSessions: number;
  months: number;
  hoursPerSession: number;
  description: string;
  image: string;
  releasedAt: string;
  order: number | null;
  owned: boolean;
  progress: number;
  doneSessions: number;
}

export interface CourseFilterState {
  /** rỗng = "Tất cả" */
  categories: CategoryId[];
  audience: AudienceId | "all";
  studyForms: StudyFormId[];
  /** null = không giới hạn giá */
  maxPrice: number | null;
}

export const DEFAULT_FILTERS: CourseFilterState = { categories: [], audience: "all", studyForms: [], maxPrice: null };

const CATEGORY_IDS = new Set<string>(COURSE_CATEGORIES.map((c) => c.id));
const AUDIENCE_IDS = new Set<string>(AUDIENCES.map((a) => a.id));
const STUDY_FORM_IDS = new Set<string>(STUDY_FORMS.map((f) => f.id));
const EDITORIAL_BY_CODE = new Map(CATALOG_COURSES.map((c) => [c.code.toUpperCase(), c]));

const isCategory = (v: unknown): v is CategoryId => typeof v === "string" && CATEGORY_IDS.has(v);
const isAudience = (v: unknown): v is AudienceId => typeof v === "string" && AUDIENCE_IDS.has(v);
const isStudyForm = (v: unknown): v is StudyFormId => typeof v === "string" && STUDY_FORM_IDS.has(v);
const positive = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** Ảnh bìa lỗi (vd. ảnh còn nằm ở storage cũ đã gỡ) => đổi sang ảnh mặc định của danh mục, chỉ đổi một lần để không lặp vô hạn. */
export function fallbackCourseImage(event: { currentTarget: HTMLImageElement }, category: CategoryId) {
  const img = event.currentTarget;
  const fallback = CATEGORY_FALLBACK_IMAGE[category];
  if (img.dataset.fallback === "1" || img.getAttribute("src") === fallback) return;
  img.dataset.fallback = "1";
  img.src = fallback;
}

/** Chỉ nhận URL http(s) hoặc đường dẫn nội bộ "/..." (không nhận "//host", "javascript:"...). */
export function safeUrl(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  return v.startsWith("/") && !v.startsWith("//") ? v : undefined;
}

export function toCourseVM(raw: StudentCourseApi): CourseVM {
  const code = raw.code?.trim() || raw.id;
  const editorial = EDITORIAL_BY_CODE.get(code.toUpperCase());
  const category = isCategory(raw.category) ? raw.category : editorial?.category ?? inferCategory(code, raw.name);
  const audiences = (raw.audiences ?? []).filter(isAudience);
  // courseType thật từ ERP là "GROUP" / "1-1" — 1-1 tính là "Online kết hợp" như bản cũ.
  const studyForm = isStudyForm(raw.studyForm)
    ? raw.studyForm
    : /1\s*-?\s*1|one/i.test(raw.courseType ?? "")
      ? "online-ket-hop"
      : editorial?.studyForm ?? "online-tu-hoc";
  return {
    id: raw.id,
    code,
    cardLabel: code,
    title: raw.name?.trim() || "Khoá học",
    category,
    audiences: audiences.length > 0 ? audiences : editorial?.audiences ?? [],
    studyForm,
    price: positive(Number(raw.price)),
    levelIn: raw.levelIn?.trim() || editorial?.levelIn || "0",
    levelOut: raw.levelOut?.trim() || editorial?.levelOut || "",
    totalSessions: positive(raw.totalSessions) || editorial?.totalSessions || 0,
    months: positive(raw.months) || editorial?.months || 0,
    hoursPerSession: positive(raw.hoursPerSession) || editorial?.hoursPerSession || 0,
    description: stripHtml(raw.description ?? "") || editorial?.description || "",
    image: safeUrl(raw.thumbnail) ?? editorial?.image ?? CATEGORY_FALLBACK_IMAGE[category],
    releasedAt: raw.releasedAt ?? "",
    order: typeof raw.displayOrder === "number" ? raw.displayOrder : null,
    owned: raw.owned === true,
    progress: Math.min(100, Math.max(0, Number(raw.progress) || 0)),
    doneSessions: Math.max(0, Math.round(Number(raw.doneSessions) || 0)),
  };
}

const byOrderThenCode = (a: CourseVM, b: CourseVM) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.code.localeCompare(b.code);

export function filterAndSort(all: CourseVM[], mode: ViewMode, filters: CourseFilterState, sort: SortId): CourseVM[] {
  let list = mode === "mine" ? all.filter((c) => c.owned) : all;
  if (filters.categories.length > 0) list = list.filter((c) => filters.categories.includes(c.category));
  if (filters.audience !== "all") {
    const audience = filters.audience;
    list = list.filter((c) => c.audiences.includes(audience));
  }
  if (filters.studyForms.length > 0) list = list.filter((c) => filters.studyForms.includes(c.studyForm));
  if (filters.maxPrice !== null) {
    const max = filters.maxPrice;
    list = list.filter((c) => c.price <= max);
  }
  const sorted = [...list];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => a.releasedAt.localeCompare(b.releasedAt) || byOrderThenCode(a, b));
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price || byOrderThenCode(a, b));
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price || byOrderThenCode(a, b));
    default:
      return sorted.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt) || byOrderThenCode(a, b));
  }
}

export function studyFormCounts(all: CourseVM[], mode: ViewMode): Record<StudyFormId, number> {
  const counts: Record<StudyFormId, number> = { "online-tu-hoc": 0, "online-ket-hop": 0, offline: 0 };
  (mode === "mine" ? all.filter((c) => c.owned) : all).forEach((c) => {
    counts[c.studyForm] += 1;
  });
  return counts;
}

export function activeFilterCount(f: CourseFilterState): number {
  return f.categories.length + f.studyForms.length + (f.audience === "all" ? 0 : 1) + (f.maxPrice === null ? 0 : 1);
}

/** Đầu thanh kéo giá: tối thiểu 2 triệu như bản cũ, nới lên theo khoá đắt nhất (làm tròn 100 nghìn) để không khoá nào bị ẩn mặc định. */
export function priceCeiling(all: CourseVM[]): number {
  const max = all.reduce((m, c) => Math.max(m, c.price), 0);
  return Math.max(PRICE_MAX, Math.ceil(max / 100_000) * 100_000);
}

/** Khoá đang học hiện trên hero: ưu tiên khoá học dở, không có thì khoá sở hữu đầu tiên. */
export function currentCourse(all: CourseVM[]): CourseVM | undefined {
  const owned = all.filter((c) => c.owned);
  return owned.find((c) => c.progress > 0 && c.progress < 100) ?? owned[0];
}

const levelRank = (level: string) => {
  const m = /(\d+(?:\.\d+)?)/.exec(level);
  return m ? Number(m[1]) : -1;
};

/**
 * Trình độ trên hero, suy từ các khoá đã sở hữu (bản cũ để cố định "0 → HSK2 → HSK5" cho mọi học viên):
 * đầu vào = đầu vào thấp nhất; hiện tại = đầu ra cao nhất của khoá đã hoàn thành, chưa hoàn thành khoá nào thì bằng đầu vào;
 * mục tiêu = đầu ra của khoá đang học. Chưa sở hữu khoá nào => "0" / "0" / "—".
 */
export function heroLevels(all: CourseVM[]): { levelIn: string; levelCurrent: string; levelGoal: string } {
  const owned = all.filter((c) => c.owned);
  if (owned.length === 0) return { levelIn: "0", levelCurrent: "0", levelGoal: "—" };
  const lowestIn = owned.map((c) => c.levelIn).filter(Boolean).sort((a, b) => levelRank(a) - levelRank(b))[0] ?? "0";
  const completedOut = owned.filter((c) => c.progress >= 100 && c.levelOut).map((c) => c.levelOut).sort((a, b) => levelRank(b) - levelRank(a))[0];
  const goal = currentCourse(all)?.levelOut || "—";
  return { levelIn: lowestIn, levelCurrent: completedOut ?? lowestIn, levelGoal: goal };
}

export interface DetailSession {
  id: string | number;
  label: string;
  topic: string;
  content: string;
}

export interface DetailMaterial {
  id: string | number;
  title: string;
  url?: string;
}

export interface CourseDetailData {
  sessions: DetailSession[];
  materials: DetailMaterial[];
  previewTopics: string[];
  syllabusStatus: SyllabusStatus;
  title?: string;
  description?: string;
  totalSessions?: number;
}

export function toDetailData(d: StudentCourseDetailApi): CourseDetailData {
  return {
    sessions: (d.sessions ?? []).map((s, i) => ({
      id: s.id ?? i,
      label: `Buổi ${s.sessionNo ?? i + 1}`,
      topic: stripHtml(s.topic ?? ""),
      content: stripHtml(s.content ?? ""),
    })),
    materials: (d.materials ?? []).filter((m) => m.title?.trim()).map((m, i) => ({ id: m.id ?? `m-${i}`, title: m.title.trim(), url: safeUrl(m.url) })),
    previewTopics: (d.previewTopics ?? []).map((t) => stripHtml(t)).filter(Boolean),
    syllabusStatus: d.syllabusStatus ?? "NONE",
    title: d.course?.name?.trim() || undefined,
    description: stripHtml(d.course?.description ?? "") || undefined,
    totalSessions: positive(d.course?.totalSessions) || undefined,
  };
}
