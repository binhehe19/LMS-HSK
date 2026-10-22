"use client";
import { lmsClient } from "./lms-client";
import { studentApi, type StudentClass } from "./student-client";
import type { EnrollmentSource, StudentCourseApi, StudentCourseCatalog, StudentCourseDetailApi } from "@/types/student-course";
import type { SyllabusDetailResponse } from "@/types/lms";
interface CatalogCourse {
    id: string;
    code: string;
    name: string;
    description?: string;
    price?: number;
    class_type?: string;
    education_level_code?: string;
    total_sessions?: number;
    banner_url?: string;
    created_at?: string;
    preview_sessions?: {
        sessionNo: number;
        topic: string;
    }[];
}
const fromCourse = (c: CatalogCourse): StudentCourseApi => ({ id: c.id, code: c.code, name: c.name, description: c.description, price: c.price, courseType: c.class_type, levelOut:c.education_level_code, totalSessions: c.total_sessions, thumbnail: c.banner_url, releasedAt: c.created_at, owned: false, progress: 0, doneSessions: 0 });
export function buildCourseCatalog(courses: CatalogCourse[], classes: StudentClass[], source: EnrollmentSource): StudentCourseCatalog {
    return { items: courses.map(c => ({ ...fromCourse(c), registered: source === "UNAVAILABLE" ? null : classes.some(cls => cls.courseId === c.id) })), enrollmentSource: source };
}
export async function listStudentCourses(mode: "all" | "mine" = "all", params: {
    page?: number;
    allPages?: boolean;
    keyword?: string;
    sort?: string;
    classType?: string;
    maxPrice?: string;
} = {}): Promise<StudentCourseCatalog> {
    const mine = await studentApi.classes().then(classes => ({ classes, source: "LIVE" as EnrollmentSource })).catch(() => ({ classes: [] as StudentClass[], source: "UNAVAILABLE" as EnrollmentSource }));
    if (mode === "mine") {
        if (mine.source === "UNAVAILABLE")
            throw Error("Không tải được lớp học của bạn.");
        const details = await Promise.allSettled(mine.classes.map(c => studentApi.classDetail(c.id)));
        return { enrollmentSource: mine.source, items: mine.classes.map((c, i) => {
                const result = details[i];
                if (result.status !== "fulfilled")
                    throw Error("Không tải được chi tiết lớp " + (c.code || c.id));
                const cls = { ...c, ...result.value };
                const total = cls.totalSessions ?? 0, done = cls.completedSessions ?? 0;
                return { id: "class:" + cls.id, code: cls.code || cls.id, name: cls.courseName || cls.learningPlan?.courseName || cls.syllabusName || cls.code || "Lớp học", thumbnail: cls.courseBannerUrl || cls.learningPlan?.courseBannerUrl, courseType: cls.classType, levelOut: cls.educationLevelCode, totalSessions: total, owned: true, registered: true, progress: total ? Math.min(100, done * 100 / total) : 0, doneSessions: done, releasedAt: cls.startDate };
            }) };
    }
    const q = new URLSearchParams({ page: String(params.page ?? 0), size: "20", sort: params.sort || "newest" });
    if (params.keyword)
        q.set("keyword", params.keyword);
    if (params.classType)
        q.set("classType", params.classType);
    if (params.maxPrice)
        q.set("maxPrice", params.maxPrice);
    const result = await lmsClient.get<{
        items: CatalogCourse[];
        total_pages: number;
    }>("/course-catalog?" + q);
    const items = [...result.items];
    // The grouped layout filters the whole catalog, not just the first API page.
    if (params.allPages) {
        for (let page = (params.page ?? 0) + 1; page < result.total_pages; page++) {
            q.set("page", String(page));
            const next = await lmsClient.get<{items: CatalogCourse[]}>("/course-catalog?" + q);
            items.push(...next.items);
        }
    }
    return { ...buildCourseCatalog(items, mine.classes, mine.source), totalPages: result.total_pages };
}
export function buildCourseDetail(id: string, syllabus: SyllabusDetailResponse | null): StudentCourseDetailApi {
    const schedule = syllabus?.schedule ?? [];
    return { course: { id, code: syllabus?.code || id, name: syllabus?.name || "", description: syllabus?.description, owned: id.startsWith("class:"), progress: 0, doneSessions: 0, totalSessions: schedule.length }, syllabusStatus: syllabus ? "OK" : "NONE", sessions: schedule.map((s, i) => ({ id: s.id, sessionNo: s.sessionNo ?? i + 1, topic: s.topic, content: s.content })), materials: schedule.flatMap(s => (s.studentMaterials ?? []).filter(m => m.materialTitle && m.materialLink).map(m => ({ title: m.materialTitle!, url: m.materialLink }))), previewTopics: schedule.map(s => s.topic || ""), enrollmentSource: "LIVE" };
}
export async function getStudentCourse(id: string): Promise<StudentCourseDetailApi> {
    if (id.startsWith("class:")) {
        const c = await studentApi.classDetail(id.slice(6));
        return buildCourseDetail(id, c.learningPlan ? { id: c.syllabusId || id, name: c.learningPlan.courseName || c.courseName || c.syllabusName, code: c.code, schedule: c.learningPlan.schedule } : null);
    }
    const c = await lmsClient.get<CatalogCourse>("/course-catalog/" + encodeURIComponent(id));
    return { course: fromCourse(c), syllabusStatus: "OK", sessions: [], materials: [], previewTopics: (c.preview_sessions ?? []).map(s => s.topic), enrollmentSource: "LIVE" };
}
