// Backend chung LMS_IELTS/backend/repo-lms GIẢ LẬP (/api/lms/*): hình dạng phản hồi khớp DTO thật (đọc source 2026-10-27, types/lms.ts):
// bọc {success,data}; PageResponse snake_case {items,total_elements,total_pages,page,size}; /classes/** cần ROLE_ADMIN; /syllabuses chỉ cần đăng nhập.
// Mã lỗi theo repo-lms: 401 UNAUTHORIZED, 403 FORBIDDEN, 404 "227", 503 "235" (ERP không phản hồi — mô phỏng bằng controls.api=error? không: dùng 500 chung).
import { count, fail, ok, send, state } from "../core.mjs";

const pageOf = (all, q, defaultSize = 20) => {
  const size = Math.max(1, Math.min(200, Number(q.get("size")) || defaultSize));
  const page = Math.max(0, Number(q.get("page")) || 0);
  return { items: all.slice(page * size, page * size + size), total_elements: all.length, total_pages: Math.ceil(all.length / size), page, size };
};

const respond = (ctx, produce) => {
  const mode = state.controls.api;
  if (mode === "error") return send(ctx.req, ctx.res, 503, fail("235", "ERP/CMS không phản hồi (MOCK)"));
  const go = () => send(ctx.req, ctx.res, 200, ok(produce()));
  return mode === "slow" ? void setTimeout(go, 2500) : go();
};

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (!url.pathname.startsWith("/api/lms/")) return false;
  const sub = url.pathname.slice("/api/lms".length);
  const q = url.searchParams;
  const data = state.data;

  if (sub.startsWith("/classes")) {
    const s = ctx.require(["ROLE_ADMIN"]);
    if (!s) return true;
    if (sub === "/classes" && method === "GET") {
      count("lmsClasses");
      const keyword = (q.get("keyword") || "").toLowerCase();
      const status = q.get("lifecycleStatus");
      const teacherId = q.get("teacherId");
      const all = data.lmsClasses().filter((c) => (!keyword || [c.code, c.name, c.courseName, c.teacher?.fullName].some((v) => (v || "").toLowerCase().includes(keyword))) && (!status || c.lifecycleStatus === status) && (!teacherId || c.teacherId === teacherId));
      return respond(ctx, () => pageOf(all, q)), true;
    }
    const m = sub.match(/^\/classes\/([^/]+)(\/(sessions|enrollments|feedback))?$/);
    if (m && method === "GET") {
      const classId = decodeURIComponent(m[1]);
      const cls = data.lmsClass(classId);
      if (!cls) return send(req, res, 404, fail("227", "Không tìm thấy lớp (MOCK)")), true;
      if (!m[3]) return count("lmsClassDetail"), respond(ctx, () => cls), true;
      if (m[3] === "sessions") return count("lmsClassSessions"), respond(ctx, () => data.lmsSessions(classId)), true;
      if (m[3] === "enrollments") return count("lmsEnrollments"), respond(ctx, () => pageOf(data.lmsEnrollments(classId), q, 100)), true;
      if (m[3] === "feedback") return respond(ctx, () => ({ classId, classCode: cls.code, className: cls.name, teacherId: cls.teacherId, teacherName: cls.teacher?.fullName, totalLessons: 10, checkpoints: [], students: [] })), true;
    }
    return false;
  }

  if (sub.startsWith("/syllabuses")) {
    const s = ctx.session();
    if (!s) return send(req, res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)")), true;
    if (sub === "/syllabuses" && method === "GET") return count("lmsSyllabuses"), respond(ctx, () => data.lmsSyllabuses()), true;
    const m = sub.match(/^\/syllabuses\/([^/]+)(\/versions)?$/);
    if (m && method === "GET") {
      const detail = data.lmsSyllabus(decodeURIComponent(m[1]));
      if (!detail) return send(req, res, 404, fail("227", "Không tìm thấy giáo trình (MOCK)")), true;
      return count("lmsSyllabusDetail"), respond(ctx, () => (m[2] ? detail.versions : detail)), true;
    }
    return false;
  }

  return false;
}
