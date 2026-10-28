// Tổng quan quản trị GIẢ LẬP (/api/hsk/management/dashboard/overview, /api/hsk/id/analytics/admin/overview): chỉ ĐỌC, chỉ ROLE_ADMIN,
// theo hợp đồng ĐỀ XUẤT docs/api-requirements/admin-overview.md (backend chung chưa có).
// Hồ sơ demo: TÍNH từ cùng bộ dữ liệu của các màn khác (state.data.raw: classes/students/teachers/users/courses + kho chấm bài) để không lệch nhau;
// doanh thu không có nguồn => sinh xác định (seeded) và ghi `revenue.note: "giả lập"`. Hồ sơ e2e: số cố định. Không có dữ liệu cá nhân thật.
import { DAY, count, fail, isoDay, nowMs, respondWithApiState, send, state } from "../core.mjs";
import { createRng } from "../data/grading-model.mjs";

const DASHBOARD_PATH = "/api/hsk/management/dashboard/overview";
const ANALYTICS_PATH = "/api/hsk/id/analytics/admin/overview";
const DEFAULT_DASHBOARD_DAYS = 30;
const DEFAULT_ANALYTICS_DAYS = 7;

/** `days` thiếu => mặc định; có mà không phải số nguyên 1..365 => null (400). */
const parseDays = (q, fallback) => {
  const raw = q.get("days");
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
};

// ---------- hồ sơ e2e: số cố định (ổn định cho kiểm thử trình duyệt) ----------
const E2E_DASHBOARD = {
  users: { total: 25, teachers: 8, teacherManagers: 2, students: 15 },
  classes: { total: 12, ongoing: 9, upcoming: 1, finished: 2 },
  grading: { pendingAttempts: 7, submittedThisWeek: 18, returnedThisWeek: 11 },
  revenue: {
    total: 185_000_000,
    videoCourse: 120_000_000,
    membership: 65_000_000,
    byChannel: [
      { label: "Khóa học Video", amount: 120_000_000 },
      { label: "Gói Thành viên", amount: 65_000_000 },
    ],
    note: "giả lập",
  },
  courseDistribution: [
    { label: "Khóa học Video", count: 4 },
    { label: "Khóa học Online", count: 6 },
  ],
};

// ---------- hồ sơ demo: suy từ dữ liệu gốc ----------
const roundTo = (n, unit) => Math.round(n / unit) * unit;

/** Doanh thu giả lập, xác định theo seed: mức/ngày cố định nhân với số ngày của cửa sổ. */
function seededRevenue(days) {
  const rng = createRng(20261027);
  const perDayVideo = roundTo(rng.int(2_500_000, 4_500_000), 10_000);
  const perDayMembership = roundTo(rng.int(1_200_000, 2_600_000), 10_000);
  const videoCourse = perDayVideo * days;
  const membership = perDayMembership * days;
  return {
    total: videoCourse + membership,
    videoCourse,
    membership,
    byChannel: [
      { label: "Khóa học Video", amount: videoCourse },
      { label: "Gói Thành viên", amount: membership },
    ],
    note: "giả lập",
  };
}

function demoDashboard(days) {
  const d = state.data.raw;
  const now = nowMs();
  const weekAgo = now - 7 * DAY;
  const hasRole = (u, role) => (u.roles ?? []).includes(role);
  const lifecycle = (c) => (c.actualEndDate || c.endMs < d.today ? "finished" : c.startMs > d.today ? "upcoming" : "ongoing");
  const byStatus = { ongoing: 0, upcoming: 0, finished: 0 };
  for (const c of d.classes) byStatus[lifecycle(c)] += 1;

  let submittedThisWeek = 0;
  let returnedThisWeek = 0;
  for (const s of d.sessions) {
    for (const a of d.grading.sessionAttempts(s.sessionId)) {
      if (Date.parse(a.submittedAt) >= weekAgo) submittedThisWeek += 1;
      if (a.gradingStatus === "RETURNED" && a.questions.some((q) => q.returnedAt && Date.parse(q.returnedAt) >= weekAgo)) returnedThisWeek += 1;
    }
  }

  // Phân bổ khóa học theo cấp độ (demo không có khóa video/online riêng; nhãn do backend quyết định, giao diện vẽ theo mảng).
  const byLevel = new Map();
  for (const c of d.courses) byLevel.set(c.level, (byLevel.get(c.level) ?? 0) + 1);

  return {
    users: {
      total: d.users.length,
      teachers: d.users.filter((u) => hasRole(u, "ROLE_TEACHER")).length,
      teacherManagers: d.users.filter((u) => hasRole(u, "ROLE_TEACHER_MANAGER")).length,
      students: d.users.filter((u) => hasRole(u, "ROLE_USER")).length,
    },
    classes: { total: d.classes.length, ...byStatus },
    grading: { pendingAttempts: d.grading.stats().pending, submittedThisWeek, returnedThisWeek },
    revenue: seededRevenue(days),
    courseDistribution: [...byLevel.entries()].map(([label, n]) => ({ label, count: n })),
  };
}

const dashboardOverview = (days) => ({ ...(state.data.profile === "demo" ? demoDashboard(days) : { ...E2E_DASHBOARD, revenue: { ...E2E_DASHBOARD.revenue } }), generatedAt: new Date(nowMs()).toISOString() });

// ---------- phân tích hành vi: chuỗi ngày xác định theo NGÀY (cửa sổ 7 ngày là đuôi của cửa sổ 30 ngày) ----------
const EVENT_WEIGHTS = [
  ["page_view", 0.34],
  ["flashcard_flip", 0.14],
  ["lesson_start", 0.12],
  ["video_play", 0.09],
  ["quiz_start", 0.07],
  ["quiz_submit", 0.06],
  ["lesson_complete", 0.06],
  ["flashcard_study_complete", 0.04],
  ["ai_practice_start", 0.03],
  ["search", 0.03],
  ["video_complete", 0.02],
];
const MODULE_WEIGHTS = [
  ["navigation", 0.3],
  ["flashcard", 0.22],
  ["quiz", 0.15],
  ["video-course", 0.13],
  ["ai-practice", 0.08],
  ["search", 0.05],
  ["pronunciation", 0.04],
  ["writing", 0.03],
];

/** Chia `total` theo trọng số; phần dư (do làm tròn) dồn vào mục đầu để tổng khớp. Sắp giảm theo count như backend HSK cũ. */
const split = (total, weights, key) => {
  const items = weights.map(([name, w]) => ({ [key]: name, count: Math.floor(total * w) }));
  items[0].count += total - items.reduce((s, i) => s + i.count, 0);
  return items.sort((a, b) => b.count - a.count);
};

function analyticsOverview(days) {
  const todayStart = Math.floor(nowMs() / DAY) * DAY;
  const demo = state.data.profile === "demo";
  const scale = demo ? Math.max(1, Math.round(state.data.raw.students.length / 10)) : 1;
  const dailyTrend = Array.from({ length: days }, (_, i) => {
    const dayMs = todayStart - (days - 1 - i) * DAY;
    const dayIndex = Math.floor(dayMs / DAY);
    const weekday = new Date(dayMs).getUTCDay();
    const base = weekday === 0 || weekday === 6 ? 60 : 110;
    return { date: isoDay(dayMs), count: (base + ((dayIndex * 37) % 71)) * scale };
  });
  const totalEvents = dailyTrend.reduce((s, d) => s + d.count, 0);
  const activeUsers = demo ? Math.min(state.data.raw.students.length, Math.round(state.data.raw.students.length * (0.55 + 0.4 * Math.min(days, 30) / 30))) : Math.round(totalEvents / 40);
  return {
    period: { from: isoDay(todayStart - (days - 1) * DAY), to: isoDay(todayStart), days },
    totalEvents,
    activeUsers,
    eventBreakdown: split(totalEvents, EVENT_WEIGHTS, "eventType"),
    moduleBreakdown: split(totalEvents, MODULE_WEIGHTS, "module"),
    dailyTrend,
  };
}

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (url.pathname !== DASHBOARD_PATH && url.pathname !== ANALYTICS_PATH) return false;
  if (method !== "GET") return send(req, res, 405, fail("405", "Chỉ hỗ trợ GET (MOCK)")), true;
  const s = ctx.require(["ROLE_ADMIN"]);
  if (!s) return true;
  const dashboard = url.pathname === DASHBOARD_PATH;
  const days = parseDays(url.searchParams, dashboard ? DEFAULT_DASHBOARD_DAYS : DEFAULT_ANALYTICS_DAYS);
  if (days === null) return send(req, res, 400, fail("VALIDATION_ERROR", "Tham số days phải là số nguyên từ 1 đến 365 (MOCK)")), true;
  count(dashboard ? "dashboardOverview" : "analyticsOverview");
  return respondWithApiState(ctx, () => (dashboard ? dashboardOverview(days) : analyticsOverview(days))), true;
}
