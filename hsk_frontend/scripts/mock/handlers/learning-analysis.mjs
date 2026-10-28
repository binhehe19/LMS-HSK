// quiz service GIẢ LẬP — màn Phân tích học tập (/api/quiz/grading/*): chuyên cần của học viên trong lớp, nhận xét giáo viên gửi học viên, gợi ý AI
// (cá nhân hoá) theo hợp đồng ĐỀ XUẤT docs/api-requirements/learning-analysis.md (B0 OPEN). Quyền: TEACHER/MENTOR, lớp mình sở hữu (`state.data.ownsClass`),
// buổi thuộc lớp, học viên thuộc lớp (`state.data.studentsOf`) — sai => 403/404, không 200 rỗng. Chuyên cần sinh XÁC ĐỊNH từ (userId, sessionNo) nên mọi lần
// chạy/mọi học viên đều nhất quán; nhận xét dùng kho chấm bài (`grading().sendNote/latestNote`); gợi ý AI giữ trong module và reset qua registerResettable.
import { count, fail, isoDay, nowMs, ok, readBody, registerResettable, send, sendError, state } from "../core.mjs";

const TEACHING_ROLES = ["ROLE_TEACHER", "ROLE_MENTOR"];
const SKILL_VI = { LISTENING: "Nghe", READING: "Đọc", WRITING: "Viết", SPEAKING: "Nói", TRANSLATION: "Dịch", PRACTICE: "Ôn tập", PHONETICS: "Ngữ âm", GRAMMAR_3_0: "Ngữ pháp 3.0" };
const MIN_USEFUL_ANSWERS = 4;
const WEAK_THRESHOLD = 0.7;
const MAX_NOTE_LENGTH = 2000;

// ---------- băm xác định (FNV-1a) ----------
const hash = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
};
const unit = (s) => hash(s) / 4294967296;
const pick = (arr, s) => arr[Math.floor(unit(s) * arr.length)];

// ---------- kho gợi ý AI trong bộ nhớ ----------
let personalization = new Map(); // `${classId}|${sessionId}|${userId}` -> { snapshot, report, tasks }
let seq = 0;
const nextId = (p) => `${p}-${(++seq).toString(36)}`;
const reset = () => {
  personalization = new Map();
  seq = 0;
};
registerResettable(reset);

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

/** Buổi thuộc lớp giảng viên sở hữu và học viên thuộc lớp; đã gửi 400/403/404 và trả null nếu không. */
const resolveScope = (ctx, s, scheduleId, classIdParam, userId) => {
  const { req, res } = ctx;
  if (!classIdParam) {
    send(req, res, 400, fail("VALIDATION_ERROR", "Thiếu classId (MOCK)"));
    return null;
  }
  const session = state.data.findSession(scheduleId);
  if (!session) {
    send(req, res, 404, fail("404", "Không tìm thấy buổi học (MOCK)"));
    return null;
  }
  if (session.classId !== classIdParam || !state.data.ownsClass(s, classIdParam)) {
    send(req, res, 403, fail("FORBIDDEN", "Buổi học không thuộc lớp của giảng viên (MOCK)"));
    return null;
  }
  const student = state.data.studentsOf(classIdParam).find((st) => st.userId === userId);
  if (!student) {
    send(req, res, 404, fail("404", "Học viên không thuộc lớp (MOCK)"));
    return null;
  }
  return { session, classId: classIdParam, student };
};

// ---------- chuyên cần (xác định theo userId + sessionNo) ----------
const ATTENDANCE_NOTE = {
  LATE: ["Đi muộn 10 phút", "Vào lớp trễ 5 phút", "Đi muộn, đã báo trước"],
  ABSENT: ["Vắng không phép", "Không có mặt, chưa báo lý do"],
  EXCUSED: ["Xin nghỉ trước (ốm)", "Nghỉ có phép (việc gia đình)"],
};
const statusFor = (userId, sessionNo) => {
  const u = unit(`att|${userId}|${sessionNo}`);
  return u < 0.75 ? "PRESENT" : u < 0.85 ? "LATE" : u < 0.95 ? "ABSENT" : "EXCUSED";
};
const attended = (status) => status === "PRESENT" || status === "LATE";

/** Luỹ kế từ buổi 1 tới buổi đang xem (chỉ buổi đã diễn ra), kèm trung bình lớp cùng mốc; buổi thiếu sessionNo bị bỏ qua. */
const attendanceAnalysis = (session, classId, userId) => {
  const todayIso = isoDay(nowMs());
  const limit = typeof session.sessionNo === "number" ? session.sessionNo : Infinity;
  const past = state.data
    .classSchedules(classId)
    .filter((x) => typeof x.sessionNo === "number" && x.sessionNo <= limit)
    .filter((x) => {
      const d = x.date ?? x.sessionDate;
      return !d || d <= todayIso;
    })
    .sort((a, b) => a.sessionNo - b.sessionNo);
  const students = state.data.studentsOf(classId);
  const classAttended = new Map(students.map((st) => [st.userId, 0]));
  let mine = 0;
  const trend = [];
  const log = [];
  past.forEach((x, i) => {
    const n = i + 1;
    for (const st of students) if (attended(statusFor(st.userId, x.sessionNo))) classAttended.set(st.userId, classAttended.get(st.userId) + 1);
    const status = statusFor(userId, x.sessionNo);
    if (attended(status)) mine++;
    const classTotal = [...classAttended.values()].reduce((sum, v) => sum + v, 0);
    trend.push({ sessionNo: x.sessionNo, sessionLabel: `Buổi ${x.sessionNo}`, studentRate: Math.round((mine / n) * 100), classAverageRate: students.length ? Math.round((classTotal / students.length / n) * 100) : null });
    log.push({ sessionLabel: `Buổi ${x.sessionNo}`, date: x.date ?? x.sessionDate, status, note: status === "PRESENT" ? undefined : pick(ATTENDANCE_NOTE[status], `note|${userId}|${x.sessionNo}`) });
  });
  return { trend, log };
};

// ---------- gợi ý AI (suy từ bài làm đã nộp của học viên trong buổi) ----------
const analyse = (session, userId) => {
  const grading = state.data.grading();
  const attempts = grading.studentAttempts(session.sessionId, userId);
  const quizzes = grading.sessionQuizzes(session.sessionId);
  const bySkill = new Map();
  let score = 0;
  let max = 0;
  for (const a of attempts) {
    const s = a.finalScore ?? a.autoScore ?? 0;
    const agg = bySkill.get(a.skillType) ?? { score: 0, max: 0 };
    agg.score += s;
    agg.max += a.totalPoints || 0;
    bySkill.set(a.skillType, agg);
    score += s;
    max += a.totalPoints || 0;
  }
  const weakAreas = [...bySkill]
    .filter(([, g]) => g.max > 0 && g.score / g.max < WEAK_THRESHOLD)
    .map(([skill, g]) => ({ label: `Kỹ năng ${SKILL_VI[skill] ?? skill}`, mastery: Math.round((g.score / g.max) * 100) / 100 }));
  const usefulAnswers = attempts.reduce((n, a) => n + (a.totalQuestions || 0), 0);
  return { attempts, quizzes, weakAreas, usefulAnswers, distinct: bySkill.size, percent: max ? Math.round((score / max) * 100) : 0, insufficient: usefulAnswers < MIN_USEFUL_ANSWERS };
};

const summaryText = (session, student, a) =>
  `Học viên ${student.name} đã nộp ${a.attempts.length}/${a.quizzes.length} bài tập của buổi ${session.sessionNo ?? ""}, đạt ${a.percent}% tổng điểm. ` +
  (a.weakAreas.length ? `Nên luyện thêm ${a.weakAreas.length} nội dung: ${a.weakAreas.map((w) => w.label).join(", ")}.` : "Chưa có nội dung cần chú ý.");

const createSnapshot = (scope, version, a) => {
  const now = new Date(nowMs()).toISOString();
  const snapshot = {
    id: nextId("snap"),
    version,
    generatedAt: now,
    dataSufficiency: { insufficient_data: a.insufficient, useful_answers: a.usefulAnswers, distinct_supported_kcs: a.distinct },
    weakAreas: a.weakAreas,
  };
  const report = { id: nextId("rep"), state: "DRAFT", generatedAt: now, summary: a.insufficient ? null : summaryText(scope.session, scope.student, a), snapshotWeakAreas: a.weakAreas };
  return { snapshot, report, tasks: [] };
};

const recordKey = (scope) => `${scope.classId}|${scope.session.sessionId}|${scope.student.userId}`;

/**
 * Bản ghi hiện có; lần đầu gọi, học viên ở vị trí CHẴN trong roster lớp và có đủ dữ liệu đã có snapshot v1 ở trạng thái DRAFT (demo thấy ngay nút Duyệt),
 * các học viên còn lại chưa có (nút Tạo). Quy tắc xác định theo roster nên /mock-reset đưa về đúng trạng thái này.
 */
const recordOf = (scope) => {
  const key = recordKey(scope);
  if (!personalization.has(key)) {
    const a = analyse(scope.session, scope.student.userId);
    const index = state.data.studentsOf(scope.classId).findIndex((st) => st.userId === scope.student.userId);
    personalization.set(key, a.attempts.length > 0 && !a.insufficient && index % 2 === 0 ? createSnapshot(scope, 1, a) : null);
  }
  return personalization.get(key);
};

const personalizationView = (scope, scheduleId) => {
  const a = analyse(scope.session, scope.student.userId);
  const rec = recordOf(scope);
  const insufficient = rec ? rec.snapshot.dataSufficiency.insufficient_data : a.insufficient;
  const approved = rec?.report.state === "APPROVED";
  return {
    available: true,
    dataSufficiency: insufficient ? "INSUFFICIENT" : "SUFFICIENT",
    dataSufficiencyMessage: insufficient ? `Mới có ${a.usefulAnswers} câu trả lời hữu ích; cần ít nhất ${MIN_USEFUL_ANSWERS} câu để AI nhận xét đáng tin cậy.` : null,
    report: rec?.report ?? null,
    historicalSnapshot: rec?.snapshot ?? null,
    recommendations: rec ? rec.snapshot.weakAreas.map((w) => ({ label: `Luyện thêm ${w.label}`, reason: `Mức nắm vững ${Math.round(w.mastery * 100)}% (dưới ${WEAK_THRESHOLD * 100}%)`, status: approved ? "ASSIGNED" : "PENDING" })) : [],
    tasks: rec ? rec.tasks.map((t) => ({ ...t, sourceLmsScheduleId: scheduleId })) : [],
    currentTasks: [],
  };
};

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (!url.pathname.startsWith("/api/quiz/grading/")) return false;
  const sub = url.pathname.slice("/api/quiz/grading".length);
  const q = url.searchParams;

  // ---- chuyên cần + nhận xét: /classes/{classId}/schedules/{scheduleId}/students/{userId}/(attendance-analysis | notes/latest | notes) ----
  const byClass = sub.match(/^\/classes\/([^/]+)\/schedules\/([^/]+)\/students\/([^/]+)\/(attendance-analysis|notes\/latest|notes)$/);
  if (byClass) {
    const [, rawClassId, rawScheduleId, rawUserId, action] = byClass;
    if (!((action === "notes" && method === "POST") || (action !== "notes" && method === "GET"))) return false;
    count(action === "attendance-analysis" ? "attendanceAnalysis" : action === "notes/latest" ? "latestNote" : "sendNote");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const scope = resolveScope(ctx, s, decodeURIComponent(rawScheduleId), decodeURIComponent(rawClassId), decodeURIComponent(rawUserId));
    if (!scope) return true;
    const { session, classId, student } = scope;
    if (action === "attendance-analysis") return withApiState(ctx, () => attendanceAnalysis(session, classId, student.userId)), true;
    if (action === "notes/latest") return withApiState(ctx, () => state.data.grading().latestNote(classId, session.sessionId, student.userId)), true;
    const body = await readBody(req);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content || content.length > MAX_NOTE_LENGTH) return send(req, res, 400, fail("VALIDATION_ERROR", `Nội dung nhận xét phải từ 1 đến ${MAX_NOTE_LENGTH} ký tự (MOCK)`)), true;
    const author = state.data.me(s).fullName;
    return withApiState(ctx, () => state.data.grading().sendNote(classId, session.sessionId, student.userId, content, author, new Date(nowMs()).toISOString())), true;
  }

  // ---- gợi ý AI: /schedules/{scheduleId}/students/{userId}/personalization[/snapshot | /reports/{reportId}/approve]?classId= ----
  const ai = sub.match(/^\/schedules\/([^/]+)\/students\/([^/]+)\/personalization(?:\/(snapshot)|\/reports\/([^/]+)\/(approve))?$/);
  if (ai) {
    const [, rawScheduleId, rawUserId, snapshotAction, rawReportId, approveAction] = ai;
    const isGet = !snapshotAction && !approveAction;
    if (!((isGet && method === "GET") || (!isGet && method === "POST"))) return false;
    count(isGet ? "personalization" : snapshotAction ? "personalizationSnapshot" : "personalizationApprove");
    const s = ctx.require(TEACHING_ROLES);
    if (!s) return true;
    const scheduleId = decodeURIComponent(rawScheduleId);
    const scope = resolveScope(ctx, s, scheduleId, q.get("classId"), decodeURIComponent(rawUserId));
    if (!scope) return true;

    if (isGet) return withApiState(ctx, () => personalizationView(scope, scheduleId)), true;

    if (snapshotAction) {
      const force = q.get("forceNewVersion") === "true";
      return withApiState(ctx, () => {
        const existing = recordOf(scope);
        if (existing && !force) return { result: "EXISTING", snapshot: { id: existing.snapshot.id, version: existing.snapshot.version } };
        const created = createSnapshot(scope, (existing?.snapshot.version ?? 0) + 1, analyse(scope.session, scope.student.userId));
        personalization.set(recordKey(scope), created);
        return { result: "CREATED", snapshot: { id: created.snapshot.id, version: created.snapshot.version } };
      }), true;
    }

    const reportId = decodeURIComponent(rawReportId);
    return withApiState(ctx, () => {
      const rec = recordOf(scope);
      if (!rec || rec.report.id !== reportId) throw Object.assign(new Error("Không tìm thấy báo cáo AI (MOCK)"), { status: 404 });
      if (rec.report.state !== "DRAFT") throw Object.assign(new Error("Báo cáo AI đã được duyệt trước đó (MOCK)"), { status: 409 });
      if (rec.snapshot.dataSufficiency.insufficient_data) throw Object.assign(new Error("Chưa đủ dữ liệu để duyệt nhận xét AI (MOCK)"), { status: 409 });
      const now = new Date(nowMs()).toISOString();
      rec.report = { ...rec.report, state: "APPROVED", approvedAt: now };
      rec.tasks = rec.snapshot.weakAreas.map((w, i) => ({
        id: nextId("task"),
        title: `Bài củng cố: ${w.label}`,
        description: `Luyện tập theo gợi ý AI sau buổi ${scope.session.sessionNo ?? ""}.`,
        status: "ASSIGNED",
        deadline: new Date(nowMs() + 7 * 86_400_000).toISOString(),
        assignedAt: now,
        completedAt: null,
        sourceSnapshotId: rec.snapshot.id,
        materialUrl: `https://exam.demo.invalid/practice?sessionCode=CNH-${hash(`${rec.snapshot.id}|${i}`).toString(36).toUpperCase()}`,
        kcLabel: w.label,
      }));
      return { reportId, state: "APPROVED", approvedAt: now };
    }), true;
  }

  return false;
}
