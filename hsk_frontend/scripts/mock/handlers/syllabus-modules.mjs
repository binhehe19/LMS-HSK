// HSK online-learning GIẢ LẬP — CHỈ phần "module ôn luyện theo buổi" của màn Quản lý Syllabus (/learning-path/syllabus/manage):
//   GET    /api/hsk/online-learning/schedule-modules/by-schedule/{scheduleId}          (đã đăng nhập)
//   PUT    /api/hsk/online-learning/schedule-modules/by-schedule/{scheduleId}/reorder  {ids}  (ADMIN | TEACHER | MENTOR)
//   POST   /api/hsk/online-learning/schedule-modules                                   {scheduleId, moduleType, contentSetId, title, skillType?}
//   DELETE /api/hsk/online-learning/schedule-modules/{id}
//   GET    /api/hsk/online-learning/schedule-available-modules/{TYPE}?q=               (đã đăng nhập)
// Mọi đường dẫn khác dưới /api/hsk/online-learning/ (courses, leads, sync...) do gói khác xử lý => trả false. Hợp đồng: docs/api-requirements/syllabus-modules.md.
// Dữ liệu riêng trong bộ nhớ, seed LƯỜI từ chính giáo trình giả lập của backend chung (state.data.lmsSyllabuses()/lmsSyllabus(id).schedule[i].id) nên
// khớp cả hai hồ sơ (demo: `syl-<courseId>-sch-<n>`, e2e: `sch-<i>-<n>`). Thao tác ghi THAY ĐỔI bộ nhớ (lần đọc sau thấy khác); /mock-reset xoá để seed lại.
import { count, fail, ok, readBody, registerResettable, respondWithApiState, send, state } from "../core.mjs";

const MODULES = "/api/hsk/online-learning/schedule-modules";
const AVAILABLE = "/api/hsk/online-learning/schedule-available-modules";
const WRITE_ROLES = ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_MENTOR"];
/** Loại NỘI DUNG có kho (đường dẫn available-modules); VOCABULARY dùng kho FLASHCARD, AI_* dùng kho AI_PRACTICE (như frontend contentTypeOf). */
const CONTENT_TYPES = ["FLASHCARD", "WRITING", "KANJI", "PRONUNCIATION", "QUIZ", "LISTENING", "GRAMMAR", "AI_PRACTICE"];
const MODULE_TYPES = [...CONTENT_TYPES, "VOCABULARY", "AI_WRITING", "AI_SPEAKING", "AI_LISTENING", "AI_READING"];
const QUIZ_SKILLS = ["PRACTICE", "LISTENING", "READING", "WRITING", "SPEAKING", "PHONETICS", "TRANSLATION", "GRAMMAR_3_0"];
const contentTypeOf = (t) => (t === "VOCABULARY" ? "FLASHCARD" : t.startsWith("AI_") ? "AI_PRACTICE" : t);

const SET_NAMES = {
  FLASHCARD: (lvl, n) => [`Từ vựng HSK ${lvl} — Bài ${n}`, `Gói Từ vựng HSK ${lvl} / Thư mục Bài ${n}`, 18 + n * 2],
  WRITING: (lvl, n) => [`Luyện viết Hán tự HSK ${lvl} — Bài ${n}`, `Gói Luyện viết HSK ${lvl} / Thư mục Bài ${n}`, 10 + n],
  KANJI: (lvl, n) => [`Nguồn gốc Hán tự — Bộ ${n} (HSK ${lvl})`, `Gói Hán tự / Thư mục Bộ thủ ${n}`, 8 + n],
  PRONUNCIATION: (lvl, n) => [`Phát âm & thanh điệu — Bài ${n}`, `Gói Phát âm HSK ${lvl} / Thư mục Bài ${n}`, 6 + n],
  QUIZ: (lvl, n) => [`Bài tập HSK ${lvl} — Bài ${n}`, `Gói Bài tập HSK ${lvl} / Thư mục Bài ${n}`, 15 + n * 3],
  LISTENING: (lvl, n) => [`Luyện nghe — Bài ${n} (HSK ${lvl})`, `Gói Luyện nghe HSK ${lvl} / Thư mục Bài ${n}`, 5 + n],
  GRAMMAR: (lvl, n) => [`Ngữ pháp HSK ${lvl} — Điểm ngữ pháp ${n}`, `Gói Ngữ pháp HSK ${lvl} / Thư mục Chủ điểm ${n}`, 4 + n],
  AI_PRACTICE: (lvl, n) => [`Luyện tập AI — Chủ đề ${n} (HSK ${lvl})`, `Gói Luyện tập AI / Thư mục Chủ đề ${n}`, 3 + n],
};

/** 6 bộ nội dung giả mỗi loại, trải trên HSK 1–3. */
function buildAvailable() {
  const out = {};
  for (const type of CONTENT_TYPES) {
    out[type] = Array.from({ length: 6 }, (_, i) => {
      const n = i + 1;
      const lvl = Math.ceil(n / 2);
      const [title, repoName, itemCount] = SET_NAMES[type](lvl, n);
      return { id: `set-${type.toLowerCase()}-${n}`, title, moduleType: type, repoName, itemCount };
    });
  }
  return out;
}

let store = null; // { schedules: Set<scheduleId>, modules: Map<id, module>, available: Record<TYPE, set[]>, seq }

const pick = (type, n) => store.available[type][(n - 1) % 6];

/** Buổi lẻ: Từ vựng + Quiz; buổi chia hết cho 3: thêm Ngữ pháp; buổi 2, 6, 10: Phát âm; buổi 4, 8: chưa có module (để demo "Cần bổ sung"). */
function seedModules(scheduleId, n) {
  const specs = [];
  if (n % 2 === 1) {
    const v = pick("FLASHCARD", n);
    const q = pick("QUIZ", n);
    specs.push({ moduleType: "VOCABULARY", contentSetId: v.id, title: `Từ vựng buổi ${n}` }, { moduleType: "QUIZ", contentSetId: q.id, title: `Bài tập buổi ${n}`, skillType: "PRACTICE" });
  }
  if (n % 3 === 0) specs.push({ moduleType: "GRAMMAR", contentSetId: pick("GRAMMAR", n).id, title: `Ngữ pháp buổi ${n}` });
  if (n % 4 === 2) specs.push({ moduleType: "PRONUNCIATION", contentSetId: pick("PRONUNCIATION", n).id, title: `Phát âm buổi ${n}` });
  specs.forEach((spec, i) => {
    const id = `sm-${scheduleId}-${i + 1}`;
    store.modules.set(id, { id, scheduleId, order: i + 1, ...spec });
  });
}

function seed() {
  store = { schedules: new Set(), modules: new Map(), available: buildAvailable(), seq: 0 };
  for (const summary of state.data.lmsSyllabuses()) {
    const detail = state.data.lmsSyllabus(summary.id);
    (detail?.schedule ?? []).forEach((item, i) => {
      store.schedules.add(item.id);
      seedModules(item.id, i + 1);
    });
  }
}
const ensure = () => store ?? (seed(), store);
registerResettable(() => {
  store = null;
});

const modulesOf = (scheduleId) => [...store.modules.values()].filter((m) => m.scheduleId === scheduleId).sort((a, b) => a.order - b.order);
const renumber = (scheduleId) => modulesOf(scheduleId).map((m, i) => Object.assign(m, { order: i + 1 }));
const text = (v) => (typeof v === "string" ? v.trim() : "");
const bad = (ctx, message, status = 400, code = "VALIDATION_ERROR") => send(ctx.req, ctx.res, status, fail(code, `${message} (MOCK)`));

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  const path = url.pathname;
  if (!path.startsWith(MODULES) && !path.startsWith(AVAILABLE)) return false;

  // ---- kho bộ nội dung có sẵn theo loại ----
  const avail = path.match(/^\/api\/hsk\/online-learning\/schedule-available-modules\/([^/]+)$/);
  if (avail && method === "GET") {
    count("availableModules");
    if (!ctx.session()) return send(req, res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)")), true;
    const type = decodeURIComponent(avail[1]).toUpperCase();
    if (!CONTENT_TYPES.includes(type)) return bad(ctx, `Loại nội dung không hỗ trợ: ${type}. Hợp lệ: ${CONTENT_TYPES.join(", ")}`), true;
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const list = ensure().available[type].filter((s) => !q || s.title.toLowerCase().includes(q) || s.repoName.toLowerCase().includes(q));
    return respondWithApiState(ctx, () => list), true;
  }

  // ---- module của một buổi ----
  const bySchedule = path.match(/^\/api\/hsk\/online-learning\/schedule-modules\/by-schedule\/([^/]+)(\/reorder)?$/);
  if (bySchedule && !bySchedule[2] && method === "GET") {
    count("scheduleModules");
    if (!ctx.session()) return send(req, res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)")), true;
    const scheduleId = decodeURIComponent(bySchedule[1]);
    if (!ensure().schedules.has(scheduleId)) return bad(ctx, "Không tìm thấy buổi học", 404, "404"), true;
    return respondWithApiState(ctx, () => modulesOf(scheduleId)), true;
  }

  if (bySchedule && bySchedule[2] && method === "PUT") {
    count("scheduleModuleReorder");
    if (!ctx.require(WRITE_ROLES)) return true;
    const scheduleId = decodeURIComponent(bySchedule[1]);
    if (!ensure().schedules.has(scheduleId)) return bad(ctx, "Không tìm thấy buổi học", 404, "404"), true;
    const body = await readBody(req);
    const ids = Array.isArray(body?.ids) ? body.ids : null;
    const current = modulesOf(scheduleId).map((m) => m.id);
    const sameSet = ids && ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
    if (!sameSet) return bad(ctx, "ids phải là toàn bộ id module của buổi theo thứ tự mới"), true;
    ids.forEach((id, i) => (store.modules.get(id).order = i + 1));
    return send(req, res, 200, ok(modulesOf(scheduleId))), true;
  }

  if (path === MODULES && method === "POST") {
    count("scheduleModuleCreate");
    if (!ctx.require(WRITE_ROLES)) return true;
    const body = (await readBody(req)) ?? {};
    const scheduleId = text(body.scheduleId);
    const moduleType = text(body.moduleType).toUpperCase();
    const contentSetId = text(body.contentSetId);
    const title = text(body.title);
    if (!scheduleId) return bad(ctx, "scheduleId là bắt buộc"), true;
    if (!ensure().schedules.has(scheduleId)) return bad(ctx, "Không tìm thấy buổi học", 404, "404"), true;
    if (!MODULE_TYPES.includes(moduleType)) return bad(ctx, `moduleType không hợp lệ: ${moduleType || "(trống)"}. Hợp lệ: ${MODULE_TYPES.join(", ")}`), true;
    if (!contentSetId) return bad(ctx, "contentSetId là bắt buộc"), true;
    if (!store.available[contentTypeOf(moduleType)].some((s) => s.id === contentSetId)) return bad(ctx, `Bộ nội dung ${contentSetId} không có trong kho ${contentTypeOf(moduleType)}`, 404, "404"), true;
    if (!title) return bad(ctx, "title là bắt buộc"), true;
    if (title.length > 200) return bad(ctx, "title tối đa 200 ký tự"), true;
    const skillType = moduleType === "QUIZ" ? text(body.skillType) || "PRACTICE" : undefined;
    if (skillType && !QUIZ_SKILLS.includes(skillType)) return bad(ctx, `skillType không hợp lệ: ${skillType}`), true;
    const created = { id: `sm-new-${++store.seq}`, scheduleId, moduleType, contentSetId, title, order: modulesOf(scheduleId).length + 1, ...(skillType ? { skillType } : {}) };
    store.modules.set(created.id, created);
    return send(req, res, 201, ok(created)), true;
  }

  const one = path.match(/^\/api\/hsk\/online-learning\/schedule-modules\/([^/]+)$/);
  if (one && method === "DELETE") {
    count("scheduleModuleDelete");
    if (!ctx.require(WRITE_ROLES)) return true;
    const id = decodeURIComponent(one[1]);
    const existing = ensure().modules.get(id);
    if (!existing) return bad(ctx, "Không tìm thấy module", 404, "404"), true;
    store.modules.delete(id);
    renumber(existing.scheduleId);
    return send(req, res, 204), true;
  }

  // Đường dẫn khác cùng tiền tố (vd /schedule-modules/courses/{id}/my-skill-progress của học viên) không thuộc màn này.
  return false;
}
