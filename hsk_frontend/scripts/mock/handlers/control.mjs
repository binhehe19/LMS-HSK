// Điều khiển/quan sát cho kiểm thử và cho nút "Reset dữ liệu demo" (không thuộc hợp đồng của ứng dụng): /mock-reset, /mock-state,
// /mock-expire, /mock-control. Giữ nguyên tên tham số của mock-server.mjs cũ vì e2e/support/mock.ts gọi chúng.
import { PROFILE, ok, reset, send, state } from "../core.mjs";

const ENUM_CONTROLS = {
  classes401: ["off", "once", "always"],
  notif: ["ok", "empty", "error", "slow"],
  users: ["ok", "empty", "error"],
  campaigns: ["ok", "empty", "error"],
  send: ["ok", "error", "slow"],
  tickets: ["none", "some", "error"],
  api: ["ok", "error", "slow"],
};
const DEFAULT_OF = { classes401: "off", notif: "ok", users: "ok", campaigns: "ok", send: "ok", tickets: "some", api: "ok" };

export async function handle(ctx) {
  const { req, res, url } = ctx;
  if (url.pathname === "/mock-reset") {
    reset();
    return send(req, res, 200, ok(true)), true;
  }
  if (url.pathname === "/mock-state") {
    return send(req, res, 200, ok({ profile: PROFILE, counters: state.counters, sessions: state.sessions.size, controls: state.controls, campaignsSent: state.campaignsSent, lastLessonsClassId: state.lastLessonsClassId })), true;
  }
  if (url.pathname === "/mock-expire") {
    state.sessions.forEach((s) => (s.accessExpired = true));
    return send(req, res, 200, ok(true)), true;
  }
  if (url.pathname === "/mock-control") {
    const q = url.searchParams;
    const c = state.controls;
    if (q.has("meDown")) c.meDown = q.get("meDown") === "1";
    for (const [key, allowed] of Object.entries(ENUM_CONTROLS)) {
      if (q.has(key)) c[key] = allowed.includes(q.get(key)) ? q.get(key) : DEFAULT_OF[key];
    }
    if (q.has("unread")) c.unreadOverride = q.get("unread") === "" ? null : Number(q.get("unread"));
    if (q.has("now")) {
      const t = Date.parse(q.get("now") || "");
      c.fixedNow = Number.isFinite(t) ? t : null;
      state.data.resetNotifications(); // tạo lại thông báo theo mốc thời gian mới
      state.data.resetCampaigns();
    }
    for (const [key, name] of [["notifTotal", "total"], ["notifStepMin", "stepMin"]]) {
      if (q.has(key)) {
        const n = Number(q.get(key));
        if (Number.isInteger(n) && n >= 0 && n <= (name === "total" ? 500 : 10_000)) c[key] = n;
      }
    }
    if (q.has("notifTarget")) {
      const target = q.get("notifTarget");
      if (target.startsWith("/") && !target.startsWith("//")) c.notifTarget = target; // đích nội bộ của thông báo số 1
    }
    if (["notifTotal", "notifStepMin", "notifTarget"].some((k) => q.has(k))) state.data.resetNotifications();
    for (const key of ["usersTotal", "campaignTotal", "teacherCount", "lessonCount"]) {
      if (q.has(key)) {
        const n = Number(q.get(key));
        if (Number.isInteger(n) && n >= 0 && n <= 500) c[key] = n;
      }
    }
    if (q.has("campaignTotal")) state.data.resetCampaigns();
    return send(req, res, 200, ok(c)), true;
  }
  return false;
}
