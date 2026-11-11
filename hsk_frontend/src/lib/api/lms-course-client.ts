"use client";

// Màn "Khoá học" học viên chỉ dùng API CÓ SẴN của repo-lms (không thêm endpoint/bảng mới):
//   - danh mục khoá  = GET /syllabuses            (SyllabusController — giáo trình từ ERP, học viên đã đăng nhập đọc được)
//   - sở hữu/tiến độ = GET /me/classes + /me/classes/{id} (MeController — lớp của chính người gọi; completedSessions/totalSessions)
//   - chi tiết khoá  = GET /syllabuses/{id}       (lộ trình buổi học + tài liệu)
// Ghép tại frontend: khoá = giáo trình; học viên "sở hữu" khoá khi có lớp dùng giáo trình đó. Lớp có giáo trình không nằm trong danh
// sách vẫn hiện (thẻ dựng từ thông tin lớp) để học viên không mất khoá đang học.
import { listSyllabuses, getSyllabus } from "@/lib/api/lms-syllabus-client";
import { studentApi, type StudentClass } from "@/lib/api/student-client";
import type { SyllabusDetailResponse, SyllabusSummaryResponse } from "@/types/lms";
import type { EnrollmentSource, StudentCourseApi, StudentCourseCatalog, StudentCourseDetailApi } from "@/types/student-course";

const CLASS_ONLY_PREFIX = "class:";
const PREVIEW_SESSIONS = 5;

/** Lớp của học viên kèm số buổi (chi tiết từng lớp); /me/classes lỗi => UNAVAILABLE, chi tiết một lớp lỗi thì dùng thông tin tóm tắt. */
async function loadMyClasses(): Promise<{ classes: StudentClass[]; source: EnrollmentSource }> {
  let classes: StudentClass[];
  try {
    classes = await studentApi.classes();
  } catch {
    return { classes: [], source: "UNAVAILABLE" };
  }
  const details = await Promise.allSettled(classes.map((c) => studentApi.classDetail(c.id)));
  return { classes: classes.map((c, i) => (details[i].status === "fulfilled" ? { ...c, ...details[i].value } : c)), source: "LIVE" };
}

const progressOf = (c: StudentClass): { progress: number; done: number; total: number | null } => {
  const total = typeof c.totalSessions === "number" && c.totalSessions > 0 ? c.totalSessions : null;
  const completed = typeof c.completedSessions === "number" && c.completedSessions > 0 ? c.completedSessions : 0;
  if (total === null) return { progress: c.lifecycleStatus?.toUpperCase() === "COMPLETED" ? 100 : 0, done: completed, total };
  const done = Math.min(completed, total);
  return { progress: Math.round((done * 1000) / total) / 10, done, total };
};

/** Mỗi giáo trình một lớp đại diện: lớp tiến độ cao nhất (học viên có thể học lại cùng giáo trình ở nhiều lớp). */
function classBySyllabus(classes: StudentClass[]): Map<string, StudentClass> {
  const map = new Map<string, StudentClass>();
  for (const c of classes) {
    const key = c.syllabusId?.trim();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev || progressOf(c).progress > progressOf(prev).progress) map.set(key, c);
  }
  return map;
}

function courseFrom(s: SyllabusSummaryResponse, cls: StudentClass | undefined): StudentCourseApi {
  const p = cls ? progressOf(cls) : null;
  return {
    id: s.id,
    code: s.code?.trim() || s.name?.trim() || s.id,
    name: s.name?.trim() || s.code?.trim() || "Khoá học",
    courseType: s.type ?? null,
    levelOut: s.educationLevelCode ?? null,
    totalSessions: p?.total ?? null,
    releasedAt: s.createdAt ?? null,
    owned: !!cls,
    progress: p?.progress ?? 0,
    doneSessions: p?.done ?? 0,
    progressStatus: cls?.lifecycleStatus ?? null,
  };
}

/** Hàm thuần: ghép danh sách giáo trình với lớp của học viên thành danh mục khoá học. */
export function buildCourseCatalog(syllabi: SyllabusSummaryResponse[], classes: StudentClass[], source: EnrollmentSource): StudentCourseCatalog {
  const owned = classBySyllabus(classes);
  const items = syllabi.filter((s) => s?.id).map((s) => courseFrom(s, owned.get(s.id)));
  const known = new Set(items.map((c) => c.id));
  for (const c of classes) {
    const key = c.syllabusId?.trim();
    if (key && known.has(key)) continue;
    if (key && owned.get(key) !== c) continue;
    const id = key || `${CLASS_ONLY_PREFIX}${c.id}`;
    known.add(id);
    items.push(courseFrom({ id, code: c.code, name: c.syllabusName || c.code, educationLevelCode: c.educationLevelCode, createdAt: c.startDate }, c));
  }
  return { items, enrollmentSource: source };
}

export async function listStudentCourses(): Promise<StudentCourseCatalog> {
  const [syllabi, mine] = await Promise.all([listSyllabuses(), loadMyClasses()]);
  return buildCourseCatalog(syllabi, mine.classes, mine.source);
}

/** Hàm thuần: giáo trình -> dữ liệu modal chi tiết. Lộ trình trả đủ; modal chỉ mở nội dung cho khoá đã sở hữu, chưa sở hữu chỉ thấy tên buổi. */
export function buildCourseDetail(id: string, syllabus: SyllabusDetailResponse | null): StudentCourseDetailApi {
  const schedule = syllabus?.schedule ?? [];
  const course: StudentCourseApi = {
    id,
    code: syllabus?.code ?? id,
    name: syllabus?.name ?? "",
    description: syllabus?.description ?? null,
    totalSessions: schedule.length || null,
    owned: false,
    progress: 0,
    doneSessions: 0,
  };
  return {
    course,
    syllabusStatus: syllabus ? "OK" : "NONE",
    sessions: schedule.map((s, i) => ({ id: s.id, sessionNo: i + 1, topic: s.topic ?? null, content: s.content ?? null })),
    materials: (syllabus?.materials ?? []).filter((m) => m.title?.trim()).map((m) => ({ id: m.id, title: m.title!.trim(), type: m.type ?? null })),
    previewTopics: schedule.map((s) => s.topic?.trim() ?? "").filter(Boolean).slice(0, PREVIEW_SESSIONS),
    enrollmentSource: "LIVE",
  };
}

export async function getStudentCourse(id: string): Promise<StudentCourseDetailApi> {
  if (id.startsWith(CLASS_ONLY_PREFIX)) return buildCourseDetail(id, null);
  return buildCourseDetail(id, await getSyllabus(id));
}
