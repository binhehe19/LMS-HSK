// Dịch vụ khoá học trực tuyến GIẢ LẬP (/api/hsk/online-learning/*) theo HỢP ĐỒNG ĐỀ XUẤT kế thừa online-course.service.ts HSK cũ: danh sách/chi tiết/
// sửa/xoá khoá học, giáo trình, đồng bộ CMS có tiến trình, và danh sách đăng ký (lead) phân trang. MỌI endpoint chỉ ROLE_ADMIN — kể cả /leads
// (HSK cũ mở công khai, lỗ hổng U5). Dữ liệu seed theo state.data.profile: "demo" suy từ state.data.raw.courses/students; "e2e" vài bản ghi cố định.
import { count, fail, nowMs, ok, paginate, readBody, registerResettable, send, sendError, state } from "../core.mjs";

const SYNC_TOTAL_MS = 12_000;
const SYNC_STEPS = ["Thời khóa biểu", "Syllabus", "Khóa học"];
const LEAD_STATUSES = ["PENDING", "PENDING", "IN_PROGRESS", "COMPLETED", "PENDING", "CANCELED"];
const LEAD_NOTES = ["", "Muốn học buổi tối", "", "Đã gọi tư vấn lần 1", "", "Hỏi về học phí trả góp", ""];

let db = null;
registerResettable(() => {
  db = null;
});

const syllabusDescription = (level, sessions) =>
  `Đối tượng: Học viên muốn đạt ${level} trong 3–4 tháng.\nMục tiêu: Nắm vững từ vựng và ngữ pháp trọng tâm của cấp độ, luyện đủ 4 kỹ năng.\nNội dung cốt lõi: ${sessions} buổi học trực tuyến, mỗi buổi 90 phút, có bài tập và chấm bài.\nKỹ năng thực chiến: Nghe – nói tình huống, đọc hiểu đoạn văn, viết đoạn ngắn theo chuẩn HSK.`;

function seedDemo(raw) {
  const prices = [2_500_000, 3_200_000, 3_900_000, 1_800_000, 2_200_000, 2_900_000];
  const courses = raw.courses.map((c, i) => ({
    id: `oc-${c.id}`,
    code: c.code,
    slug: c.code.toLowerCase(),
    name: `${c.name} — Trực tuyến`,
    thumbnail: "",
    description: `<p>Kh&oacute;a ${c.name} trực tuyến (${c.level}): ${c.sessions} buổi, k&egrave;m b&agrave;i tập v&agrave; chấm b&agrave;i.</p>`,
    syllabusId: `syl-${c.id}`,
    price: prices[i % prices.length],
    rating: Math.round((4.2 + (i % 4) * 0.2) * 10) / 10,
    courseType: i % 3 === 2 ? "1-1" : "Group",
    level: c.level,
    totalLessons: c.sessions,
    cmsSynced: i !== 3,
    createdAt: new Date(nowMs() - (60 - i * 7) * 86_400_000).toISOString(),
  }));
  const syllabi = new Map(raw.courses.map((c, i) => [`syl-${c.id}`, { id: `syl-${c.id}`, name: `Giáo trình ${c.name}`, syllabus_description: i === 4 ? "" : syllabusDescription(c.level, c.sessions) }]));
  const leads = Array.from({ length: 37 }, (_, i) => {
    const st = raw.students[i % raw.students.length];
    const course = courses[i % courses.length];
    return {
      id: `lead-${String(i + 1).padStart(3, "0")}`,
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      courseType: course.courseType,
      fullName: st.name,
      email: st.email,
      phone: st.phone,
      note: LEAD_NOTES[i % LEAD_NOTES.length],
      registeredAt: new Date(nowMs() - i * 37 * 3_600_000).toISOString(),
      status: LEAD_STATUSES[i % LEAD_STATUSES.length],
    };
  });
  return { courses, syllabi, leads, jobs: new Map() };
}

function seedE2e() {
  const mk = (i, over) => ({ id: `mock-oc-${i}`, code: `MOCK-OC${i}`, slug: `mock-oc${i}`, name: `Khóa HSK ${i} trực tuyến (DỮ LIỆU GIẢ)`, thumbnail: "", description: `Mô tả khóa giả lập ${i}.`, syllabusId: `mock-syl-${i}`, price: 1_500_000 * i, rating: 4.5, courseType: "Group", level: `HSK ${i}`, totalLessons: 10, cmsSynced: true, createdAt: "2026-09-01T00:00:00.000Z", ...over });
  const courses = [mk(1), mk(2, { courseType: "1-1", cmsSynced: false }), mk(3)];
  const syllabi = new Map([1, 2, 3].map((i) => [`mock-syl-${i}`, { id: `mock-syl-${i}`, name: `Giáo trình HSK ${i} (DỮ LIỆU GIẢ)`, syllabus_description: i === 2 ? "" : syllabusDescription(`HSK ${i}`, 10) }]));
  const leads = Array.from({ length: 5 }, (_, i) => ({ id: `mock-lead-${i + 1}`, courseId: courses[i % 3].id, courseCode: courses[i % 3].code, courseName: courses[i % 3].name, courseType: courses[i % 3].courseType, fullName: `Người đăng ký giả lập ${i + 1}`, email: `dangky${i + 1}@mock.invalid`, phone: `0900 000 00${i + 1}`, note: i === 0 ? "Ghi chú giả lập" : "", registeredAt: new Date(Date.UTC(2026, 9, 20 - i, 8, 0, 0)).toISOString(), status: LEAD_STATUSES[i] }));
  return { courses, syllabi, leads, jobs: new Map() };
}

const ensure = () => (db ??= state.data?.profile === "demo" ? seedDemo(state.data.raw) : seedE2e());

const withApiState = (ctx, produce, status = 200) => {
  const mode = state.controls.api;
  if (mode === "error") return send(ctx.req, ctx.res, 500, fail("500", "Lỗi máy chủ giả lập (MOCK)"));
  const respond = () => {
    try {
      send(ctx.req, ctx.res, status, ok(produce()));
    } catch (error) {
      sendError(ctx, error);
    }
  };
  return mode === "slow" ? void setTimeout(respond, 2500) : respond();
};

const UPSERT_FIELDS = ["name", "thumbnail", "description", "price", "rating", "syllabusId", "courseType", "level", "totalLessons"];
const applyUpsert = (target, body) => {
  for (const key of UPSERT_FIELDS) if (body[key] !== undefined && body[key] !== null) target[key] = body[key];
  return target;
};

/** Tiến trình đồng bộ suy từ thời gian đã trôi (Date.now(), không dùng fixedNow để job luôn tiến). Hoàn tất => mọi khoá cmsSynced = true. */
const jobSnapshot = (d, job) => {
  if (job.status !== "RUNNING") return { ...job, startMs: undefined };
  const elapsed = Date.now() - job.startMs;
  const percent = Math.min(100, Math.round((elapsed / SYNC_TOTAL_MS) * 100));
  if (percent >= 100) {
    job.status = "SUCCESS";
    job.progressPercent = 100;
    job.currentStep = "Hoàn tất";
    job.finishedAt = new Date().toISOString();
    for (const c of d.courses) c.cmsSynced = true;
  } else {
    job.progressPercent = percent;
    job.currentStep = `Đang đồng bộ ${SYNC_STEPS[Math.min(SYNC_STEPS.length - 1, Math.floor(percent / (100 / SYNC_STEPS.length)))]}...`;
  }
  return { ...job, startMs: undefined };
};

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (!url.pathname.startsWith("/api/hsk/online-learning/")) return false;
  const sub = url.pathname.slice("/api/hsk/online-learning".length);
  const q = url.searchParams;
  const s = ctx.require(["ROLE_ADMIN"]);
  if (!s) return true;
  const d = ensure();

  // ---- khoá học ----
  if (sub === "/courses" && method === "GET") return count("onlineCourses"), withApiState(ctx, () => d.courses), true;

  if (sub === "/courses" && method === "POST") {
    count("onlineCourseCreate");
    const body = (await readBody(req)) ?? {};
    if (typeof body.name !== "string" || !body.name.trim()) return send(req, res, 400, fail("VALIDATION_ERROR", "Tên khóa học là bắt buộc (MOCK)")), true;
    const created = applyUpsert({ id: `oc-new-${d.courses.length + 1}`, code: `OC-NEW-${d.courses.length + 1}`, thumbnail: "", cmsSynced: false, totalLessons: 0, price: 0, rating: 0, createdAt: new Date(nowMs()).toISOString() }, body);
    d.courses.unshift(created);
    return send(req, res, 201, ok(created)), true;
  }

  const course = sub.match(/^\/courses\/([^/]+)(\/full-detail)?$/);
  if (course) {
    const found = d.courses.find((c) => c.id === decodeURIComponent(course[1]));
    if (!found) return send(req, res, 404, fail("404", "Không tìm thấy khóa học (MOCK)")), true;
    if (method === "GET" && course[2]) {
      count("onlineCourseFullDetail");
      const syllabus = d.syllabi.get(found.syllabusId);
      return withApiState(ctx, () => ({ ...found, syllabusInfo: syllabus ?? undefined, syllabus_description: syllabus?.syllabus_description || undefined })), true;
    }
    if (method === "GET") return count("onlineCourseDetail"), withApiState(ctx, () => ({ ...found, syllabus_id: found.syllabusId })), true;
    if (method === "PUT" && !course[2]) {
      count("onlineCourseUpdate");
      const body = (await readBody(req)) ?? {};
      if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) return send(req, res, 400, fail("VALIDATION_ERROR", "Tên khóa học không hợp lệ (MOCK)")), true;
      applyUpsert(found, body);
      return send(req, res, 200, ok(found)), true;
    }
    if (method === "DELETE" && !course[2]) {
      count("onlineCourseDelete");
      d.courses = d.courses.filter((c) => c !== found);
      return send(req, res, 200, ok(null)), true;
    }
    return false;
  }

  const syllabus = sub.match(/^\/syllabuses\/([^/]+)$/);
  if (syllabus && method === "GET") {
    count("onlineSyllabus");
    const found = d.syllabi.get(decodeURIComponent(syllabus[1]));
    if (!found) return send(req, res, 404, fail("404", "Không tìm thấy giáo trình (MOCK)")), true;
    return withApiState(ctx, () => found), true;
  }

  // ---- đồng bộ CMS ----
  if (sub === "/sync/all" && method === "POST") {
    count("onlineSyncStart");
    const running = [...d.jobs.values()].find((j) => jobSnapshot(d, j).status === "RUNNING");
    if (running) return send(req, res, 409, fail("SYNC_IN_PROGRESS", "Đang có tiến trình đồng bộ, vui lòng chờ hoàn tất (MOCK)")), true;
    const job = { jobId: `sync-${d.jobs.size + 1}`, status: "RUNNING", currentStep: "Đang kết nối CMS...", progressPercent: 0, message: undefined, startedAt: new Date().toISOString(), finishedAt: null, startMs: Date.now() };
    d.jobs.set(job.jobId, job);
    return send(req, res, 200, ok(jobSnapshot(d, job))), true;
  }
  const job = sub.match(/^\/sync\/all\/([^/]+)$/);
  if (job && method === "GET") {
    count("onlineSyncJob");
    const found = d.jobs.get(decodeURIComponent(job[1]));
    if (!found) return send(req, res, 404, fail("404", "Không tìm thấy tiến trình đồng bộ (MOCK)")), true;
    return send(req, res, 200, ok(jobSnapshot(d, found))), true;
  }

  // ---- đăng ký khoá học (lead), chỉ đọc, ADMIN ----
  if (sub === "/leads" && method === "GET") {
    count("onlineLeads");
    const code = (q.get("courseCode") || "").trim().toLowerCase();
    const from = q.get("from") || "";
    const to = q.get("to") || "";
    const all = d.leads
      .filter((l) => (!code || l.courseCode.toLowerCase().includes(code)) && (!from || l.registeredAt.slice(0, 10) >= from) && (!to || l.registeredAt.slice(0, 10) <= to))
      .sort((a, b) => (a.registeredAt < b.registeredAt ? 1 : -1));
    return withApiState(ctx, () => {
      const page = paginate(all, q, 20);
      return { content: page.items, totalElements: page.totalElements, totalPages: page.totalPages, size: page.size, number: page.page };
    }), true;
  }

  return false;
}
