// quiz service GIẢ LẬP (/api/quiz/grading/*): lớp cho Admin, lớp của giảng viên, buổi học (M1 → M4B) và luồng chấm bài (học viên của buổi, bài làm,
// thao tác chấm/gửi, chi tiết bài học) theo hợp đồng ĐỀ XUẤT cho backend chung (B0 OPEN). Quyền: TEACHER/MENTOR chỉ với lớp mình sở hữu
// (`state.data.ownsClass`), Admin với /admin/*. Dữ liệu từ provider (data/legacy.mjs, data/demo.mjs) + kho chấm bài (data/grading-model.mjs).
import { count, fail, nowMs, ok, readBody, send, sendError, state } from "../core.mjs";

const TEACHING_ROLES = ["ROLE_TEACHER", "ROLE_MENTOR"];

/** Trả theo trạng thái của phiên (state=ok|empty|error|slow|invalid), dùng chung cho ba endpoint cũ. */
const respondByState = (ctx, s, produce) => {
  const { req, res } = ctx;
  if (s.state === "error") return send(req, res, 500, fail("500", "Lỗi máy chủ giả lập (MOCK)"));
  if (s.state === "invalid") return send(req, res, 200, ok({ items: [] }));
  if (s.state === "empty") return send(req, res, 200, ok([]));
  const data = produce();
  if (s.state === "slow") return void setTimeout(() => send(req, res, 200, ok(data)), 4000);
  return send(req, res, 200, ok(data));
};

/** Buổi học theo scheduleId (syllabusScheduleId hoặc sessionId) thuộc lớp giảng viên sở hữu; gửi 404/403 và trả null nếu không. */
const resolveOwnedSession = (ctx, s, scheduleId, classIdParam) => {
  const { req, res } = ctx;
  const session = state.data.findSession(scheduleId);
  if (!session) {
    send(req, res, 404, fail("404", "Không tìm thấy buổi học (MOCK)"));
    return null;
  }
  const classId = classIdParam || session.classId;
  if (session.classId !== classId || !state.data.ownsClass(s, classId)) {
    send(req, res, 403, fail("FORBIDDEN", "Buổi học không thuộc lớp của giảng viên (MOCK)"));
    return null;
  }
  return session;
};

/** Bài làm thuộc lớp giảng viên sở hữu; gửi 404/403 và trả null nếu không. */
const resolveOwnedAttempt = (ctx, s, attemptId) => {
  const { req, res } = ctx;
  const classId = state.data.grading().attemptClassOf(attemptId);
  if (!classId) {
    send(req, res, 404, fail("404", "Không tìm thấy bài làm (MOCK)"));
    return null;
  }
  if (!state.data.ownsClass(s, classId)) {
    send(req, res, 403, fail("FORBIDDEN", "Bài làm không thuộc lớp của giảng viên (MOCK)"));
    return null;
  }
  return classId;
};

const withApiState = (ctx, produce) => {
  const mode = state.controls.api;
  if (mode === "error") return send(ctx.req, ctx.res, 500, fail("500", "Lỗi máy chủ giả lập (MOCK)"));
  const respond = () => {
    try {
      send(ctx.req, ctx.res, 200, ok(produce()));
    } catch (error) {
      sendError(ctx, error);
    }
  };
  return mode === "slow" ? void setTimeout(respond, 2500) : respond();
};

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (!url.pathname.startsWith("/api/quiz/grading/")) return false;
  const sub = url.pathname.slice("/api/quiz/grading".length);
  const q = url.searchParams;

  if (sub === "/admin/classes" && method === "GET") {
    count("classes");
    const s = ctx.session();
    if (!s) return send(req, res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)")), true;
    if (state.controls.classes401 === "always" || state.controls.classes401 === "once") {
      if (state.controls.classes401 === "once") state.controls.classes401 = "off";
      return send(req, res, 401, fail("UNAUTHORIZED", "Token bị từ chối (MOCK)")), true;
    }
    if (!s.roles.includes("ROLE_ADMIN")) return send(req, res, 403, fail("FORBIDDEN", "Không có quyền (MOCK)")), true;
    return respondByState(ctx, s, () => state.data.adminClasses()), true;
  }

  const adminStudents = sub.match(/^\/admin\/classes\/([^/]+)\/students$/);
  if (adminStudents && method === "GET") {
    count("adminClassStudents");
    const s = ctx.require(["ROLE_ADMIN"]);
    if (!s) return true;
    const classId = decodeURIComponent(adminStudents[1]);
    if (!state.data.classOf(classId)) return send(req, res, 404, fail("404", "Không tìm thấy lớp (MOCK)")), true;
    return withApiState(ctx, () => state.data.adminClassStudents(classId)), true;
  }

  if (sub === "/classes" && method === "GET") {
    count("teacherClasses");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    // như backend cũ: lớp còn bài chờ chấm lên trước
    return respondByState(ctx, s, () => [...state.data.teacherClasses(s)].sort((a, b) => Number(b.hasPendingGrading) - Number(a.hasPendingGrading))), true;
  }

  const lessonsMatch = sub.match(/^\/classes\/([^/]+)\/schedules$/);
  if (lessonsMatch && method === "GET") {
    count("lessons");
    state.lastLessonsClassId = decodeURIComponent(lessonsMatch[1]);
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    if (!state.data.ownsClass(s, state.lastLessonsClassId)) return send(req, res, 403, fail("FORBIDDEN", "Lớp này không thuộc giảng viên (MOCK)")), true;
    return respondByState(ctx, s, () => state.data.classSchedules(state.lastLessonsClassId)), true;
  }

  // ---- luồng chấm bài (TEACHER/MENTOR, lớp sở hữu) ----
  const students = sub.match(/^\/schedules\/([^/]+)\/students$/);
  if (students && method === "GET") {
    count("scheduleStudents");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const session = resolveOwnedSession(ctx, s, decodeURIComponent(students[1]), q.get("classId"));
    if (!session) return true;
    return withApiState(ctx, () => state.data.grading().scheduleStudents(session.sessionId, state.data.studentsOf(session.classId))), true;
  }

  const attempts = sub.match(/^\/schedules\/([^/]+)\/students\/([^/]+)\/attempts$/);
  if (attempts && method === "GET") {
    count("studentAttempts");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const session = resolveOwnedSession(ctx, s, decodeURIComponent(attempts[1]), q.get("classId"));
    if (!session) return true;
    return withApiState(ctx, () => state.data.grading().studentAttempts(session.sessionId, decodeURIComponent(attempts[2]))), true;
  }

  const sendStudent = sub.match(/^\/schedules\/([^/]+)\/students\/([^/]+)\/send$/);
  if (sendStudent && method === "POST") {
    count("sendStudentResults");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const session = resolveOwnedSession(ctx, s, decodeURIComponent(sendStudent[1]), q.get("classId"));
    if (!session) return true;
    return withApiState(ctx, () => ({ sent: state.data.grading().sendStudentResults(session.sessionId, decodeURIComponent(sendStudent[2]), new Date(nowMs()).toISOString()) })), true;
  }

  const lessonDetail = sub.match(/^\/schedules\/([^/]+)\/lesson-detail$/);
  if (lessonDetail && (method === "GET" || method === "PUT")) {
    count(method === "GET" ? "lessonDetail" : "lessonDetailSave");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const session = resolveOwnedSession(ctx, s, decodeURIComponent(lessonDetail[1]), q.get("classId"));
    if (!session) return true;
    if (method === "GET") {
      const title = q.get("title") || `Buổi ${session.sessionNo ?? ""}: ${session.title ?? ""}`.trim();
      return withApiState(ctx, () => state.data.grading().lessonDetail(session.sessionId, title)), true;
    }
    const body = await readBody(req);
    if (!body || typeof body.lessonTitle !== "string" || !Array.isArray(body.modules)) return send(req, res, 400, fail("VALIDATION_ERROR", "Nội dung bài học không hợp lệ (MOCK)")), true;
    return withApiState(ctx, () => state.data.grading().saveLessonDetail(session.sessionId, body)), true;
  }

  const attemptGet = sub.match(/^\/attempts\/([^/]+)$/);
  if (attemptGet && method === "GET") {
    count("attemptDetail");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const attemptId = decodeURIComponent(attemptGet[1]);
    if (!resolveOwnedAttempt(ctx, s, attemptId)) return true;
    return withApiState(ctx, () => state.data.grading().attempt(attemptId)), true;
  }

  const answerPut = sub.match(/^\/answers\/([^/]+)$/);
  if (answerPut && method === "PUT") {
    count("gradeAnswer");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const answerId = decodeURIComponent(answerPut[1]);
    const attemptId = state.data.grading().attemptIdOfAnswer(answerId);
    if (!attemptId) return send(req, res, 404, fail("404", "Không tìm thấy câu trả lời (MOCK)")), true;
    if (!resolveOwnedAttempt(ctx, s, attemptId)) return true;
    const body = (await readBody(req)) ?? {};
    return withApiState(ctx, () => state.data.grading().gradeAnswer(answerId, body)), true;
  }

  const questionPut = sub.match(/^\/attempts\/([^/]+)\/questions\/([^/]+)$/);
  if (questionPut && method === "PUT") {
    count("gradeQuestion");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const attemptId = decodeURIComponent(questionPut[1]);
    if (!resolveOwnedAttempt(ctx, s, attemptId)) return true;
    const body = (await readBody(req)) ?? {};
    return withApiState(ctx, () => state.data.grading().gradeQuestion(attemptId, decodeURIComponent(questionPut[2]), body)), true;
  }

  const finalize = sub.match(/^\/attempts\/([^/]+)\/finalize$/);
  if (finalize && method === "PUT") {
    count("finalizeAttempt");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const attemptId = decodeURIComponent(finalize[1]);
    if (!resolveOwnedAttempt(ctx, s, attemptId)) return true;
    const body = (await readBody(req)) ?? {};
    return withApiState(ctx, () => state.data.grading().finalizeAttempt(attemptId, body)), true;
  }

  const sendOne = sub.match(/^\/attempts\/([^/]+)\/send$/);
  if (sendOne && method === "POST") {
    count("sendAttempt");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const attemptId = decodeURIComponent(sendOne[1]);
    if (!resolveOwnedAttempt(ctx, s, attemptId)) return true;
    const body = (await readBody(req)) ?? {};
    return withApiState(ctx, () => state.data.grading().sendAttempt(attemptId, body, new Date(nowMs()).toISOString())), true;
  }

  return false;
}
