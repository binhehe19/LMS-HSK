// Lõi dùng chung của máy chủ GIẢ LẬP (MOCK / NOT INTEGRATED): trạng thái, phiên/token giả, helper HTTP.
// Tách khỏi mock-server.mjs cũ để mỗi miền nghiệp vụ có một file handler riêng (scripts/mock/handlers/*.mjs) và để
// dữ liệu có hai "hồ sơ" (profile): `e2e` giữ NGUYÊN hành vi/dữ liệu mà bộ kiểm thử trình duyệt đã đóng băng, `demo` là
// bộ dữ liệu nhất quán (lớp ↔ buổi ↔ học viên ↔ bài nộp) cho chế độ demo. Handler không biết profile nào đang chạy:
// chúng chỉ gọi `state.data` (provider, xem scripts/mock/data/*.mjs).
import { randomUUID } from "node:crypto";

export const PORT = Number(process.env.MOCK_PORT || 3190);
export const HOST = "127.0.0.1";
/** Hồ sơ dữ liệu: `e2e` (mặc định, Playwright) hoặc `demo` (npm run demo). Chỉ nhận đúng hai giá trị này. */
export const PROFILE = process.env.MOCK_PROFILE === "demo" ? "demo" : "e2e";

export const ROLE_PRESETS = {
  admin: ["ROLE_ADMIN"],
  teacher: ["ROLE_TEACHER"],
  mentor: ["ROLE_MENTOR"],
  "teacher-manager": ["ROLE_TEACHER_MANAGER"],
  manager: ["ROLE_MANAGER"],
  collaborator: ["ROLE_COLLABORATOR"],
  user: ["ROLE_USER"],
  none: [],
};
export const STATES = ["ok", "empty", "error", "slow", "invalid"];
export const DAY = 86_400_000;
export const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// classes401: off | once | always (mô phỏng token bị API nghiệp vụ từ chối). notif: ok | empty | error | slow. tickets: none | some | error.
// users/campaigns: ok | empty | error. send: ok | error | slow. fixedNow: đóng băng mốc thời gian (ms) để ảnh chuẩn không trôi.
const DEFAULT_CONTROLS = {
  meDown: false,
  classes401: "off",
  notif: "ok",
  unreadOverride: null,
  tickets: "some",
  fixedNow: null,
  notifTotal: 4,
  notifStepMin: 17,
  notifTarget: "/admin/class-management",
  users: "ok",
  usersTotal: 25,
  teacherCount: 25,
  lessonCount: 23,
  campaigns: "ok",
  campaignTotal: 3,
  send: "ok",
  /** Trạng thái chung cho các API nghiệp vụ mới (demo/màn mới): ok | error | slow. Riêng từng miền có thể ghi đè bằng khoá riêng. */
  api: "ok",
};
const COUNTER_KEYS = ["me", "refresh", "logout", "classes", "unread", "notifList", "notifRead", "tickets", "teacherClasses", "lessons", "users", "campaignList", "campaignSend"];

export const state = {
  sessions: new Map(), // sid -> phiên
  controls: { ...DEFAULT_CONTROLS },
  counters: Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0])),
  lastLessonsClassId: null, // classId của lời gọi buổi học gần nhất (để test kiểm tra contract tham số)
  campaignsSent: [], // thân yêu cầu gửi đã nhận (để test kiểm tra không gửi trùng / nội dung gửi)
  /** Provider dữ liệu theo profile; gán bởi server.mjs trước khi nhận request. */
  data: null,
};

export const nowMs = () => state.controls.fixedNow ?? Date.now();

/** Tăng bộ đếm (tạo khoá mới nếu chưa có, để miền mới không phải sửa danh sách ở đây). */
export const count = (key) => {
  state.counters[key] = (state.counters[key] ?? 0) + 1;
};

/** Các handler miền có dữ liệu riêng trong bộ nhớ đăng ký hàm reset ở đây (được gọi sau khi provider reset). */
const resettables = [];
export const registerResettable = (fn) => {
  resettables.push(fn);
};

export const reset = () => {
  state.sessions.clear();
  Object.assign(state.controls, DEFAULT_CONTROLS);
  for (const k of Object.keys(state.counters)) state.counters[k] = 0;
  state.lastLessonsClassId = null;
  state.campaignsSent = [];
  state.data?.reset();
  for (const fn of resettables) fn();
};

/** Gửi lỗi do provider/store ném ra (có `status` 404/409...) đúng mã HTTP; lỗi khác => 500. */
export const sendError = (ctx, error) => {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  send(ctx.req, ctx.res, status, fail(String(status), error?.message || "Lỗi máy chủ giả lập (MOCK)"));
};

// ---------- token giả (không ký, không dùng được ở nơi khác) ----------
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
export const makeToken = (payload) => `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.mock`;
export const decodeToken = (token) => {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};
export const issue = (s) => ({
  accessToken: makeToken({ sid: s.sid, k: "a", v: s.accessVersion }),
  refreshToken: makeToken({ sid: s.sid, k: "r", v: s.refreshVersion }),
});

export const createSession = (q) => {
  const role = ROLE_PRESETS[q.get("role")] ? q.get("role") : "admin";
  const s = {
    sid: randomUUID(),
    role,
    roles: ROLE_PRESETS[role],
    state: STATES.includes(q.get("state")) ? q.get("state") : "ok",
    transport: q.get("transport") === "hash" ? "hash" : "cookie",
    refreshMode: ["ok", "fail", "down"].includes(q.get("refresh")) ? q.get("refresh") : "ok",
    accessVersion: 1,
    refreshVersion: 1,
    accessExpired: q.get("access") === "expired",
  };
  state.sessions.set(s.sid, s);
  return s;
};

export const parseCookies = (req) =>
  Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => [c.slice(0, c.indexOf("=")), decodeURIComponent(c.slice(c.indexOf("=") + 1))]),
  );

/** Phiên hợp lệ từ Bearer hoặc cookie access_token (giống BearerTokenAuthenticationFilter: header trước, cookie sau). */
export const authenticate = (req) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : parseCookies(req).access_token;
  const payload = token ? decodeToken(token) : null;
  const s = payload ? state.sessions.get(payload.sid) : null;
  if (!s || payload.k !== "a" || payload.v !== s.accessVersion || s.accessExpired) return null;
  return s;
};

export const cookieHeaders = (s, clear = false) => {
  const attrs = "Path=/; HttpOnly; SameSite=Lax";
  if (clear) return [`access_token=; ${attrs}; Max-Age=0`, `refresh_token=; ${attrs}; Max-Age=0`];
  const t = issue(s);
  return [`access_token=${t.accessToken}; ${attrs}`, `refresh_token=${t.refreshToken}; ${attrs}`];
};

// ---------- HTTP ----------
export const cors = (req) => {
  const origin = req.headers.origin;
  const allowed = origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return allowed
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "content-type, authorization",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        vary: "Origin",
      }
    : {};
};

export const send = (req, res, status, body, extra = {}) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...cors(req), ...extra });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
export const ok = (data) => ({ success: true, data });
export const fail = (errorCode, errorMessage) => ({ success: false, errorCode, errorMessage });
export const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
  });

/**
 * Yêu cầu đã đăng nhập (401 nếu không) và, nếu có `roles`, có ít nhất một role trong danh sách (403 nếu không).
 * Trả về phiên, hoặc null sau khi đã gửi phản hồi lỗi.
 */
export const requireSession = (ctx, roles) => {
  const s = authenticate(ctx.req);
  if (!s) {
    send(ctx.req, ctx.res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)"));
    return null;
  }
  if (roles && !roles.some((r) => s.roles.includes(r))) {
    send(ctx.req, ctx.res, 403, fail("FORBIDDEN", "Không có quyền (MOCK)"));
    return null;
  }
  return s;
};

/** Phân trang kiểu Spring (page từ 0) trên mảng đã lọc: { items, totalElements, totalPages, page, size }. */
export const paginate = (all, q, defaultSize = 10) => {
  const size = Math.max(1, Number(q.get("size")) || defaultSize);
  const page = Math.max(0, Number(q.get("page")) || 0);
  return { items: all.slice(page * size, page * size + size), totalElements: all.length, totalPages: Math.ceil(all.length / size), page, size };
};

/**
 * Áp trạng thái mô phỏng chung của API nghiệp vụ (controls.api, hoặc khoá riêng `key`): error => 500, slow => trễ rồi trả; ok => trả ngay.
 * `produce()` được gọi muộn để dữ liệu phản ánh đúng thời điểm trả lời.
 */
export const respondWithApiState = (ctx, produce, key = "api") => {
  const mode = state.controls[key] ?? "ok";
  if (mode === "error") return send(ctx.req, ctx.res, 500, fail("500", "Lỗi máy chủ giả lập (MOCK)"));
  const respond = () => send(ctx.req, ctx.res, 200, ok(produce()));
  return mode === "slow" ? void setTimeout(respond, 2500) : respond();
};
