// notification service GIẢ LẬP theo HỢP ĐỒNG THẬT của repo-notification (backend chung, Go): /api/notification/notifications*, JSON TRẦN (không bọc
// {success,data}), không lọc phía server, read/seen trả 204, chỉ có seen/all (không có read/all). Phần Admin (lịch sử chiến dịch + gửi) là hợp đồng
// ĐỀ XUẤT qua /api/hsk/notification/admin/campaigns (bọc {success,data} như các dịch vụ HSK cũ).
import { count, fail, nowMs, ok, paginate, readBody, send, state } from "../core.mjs";

const raw = (req, res, status, body) => {
  res.writeHead(status, body === undefined ? {} : { "content-type": "application/json; charset=utf-8" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  const c = state.controls;
  const data = state.data;

  if (url.pathname.startsWith("/api/notification/notifications")) {
    const s = ctx.session();
    if (!s) return raw(req, res, 401, { success: false, errorCode: "UNAUTHORIZED", errorMessage: "Chưa đăng nhập (MOCK)" }), true;
    if (c.notif === "error") return raw(req, res, 500, { message: "Lỗi máy chủ giả lập (MOCK)" }), true;
    const sub = url.pathname.slice("/api/notification/notifications".length);

    if (sub === "/unread-count" && method === "GET") {
      count("unread");
      return raw(req, res, 200, { unreadCount: c.notif === "empty" ? 0 : data.unreadCount(s) }), true;
    }
    if ((sub === "" || sub === "/") && method === "GET") {
      count("notifList");
      const q = url.searchParams;
      // Backend chung: size tối đa 100, KHÔNG có bộ lọc readStatus/fromDate/toDate (client tự lọc).
      const size = Math.min(100, Math.max(1, Number(q.get("size")) || 20));
      const all = c.notif === "empty" ? [] : data.notifications(s);
      const page = paginate(all, new URLSearchParams({ page: q.get("page") ?? "0", size: String(size) }), size);
      const respond = () => raw(req, res, 200, { ...page, unreadCount: c.notif === "empty" ? 0 : data.unreadCount(s) });
      return c.notif === "slow" ? void setTimeout(respond, 2500) : respond(), true;
    }
    if (sub === "/seen/all" && method === "POST") {
      count("notifSeenAll");
      for (const n of data.notifications(s)) n.seen = true;
      return raw(req, res, 204), true;
    }
    const m = sub.match(/^\/([^/]+)\/(read|seen)$/);
    if (m && method === "POST") {
      count("notifRead");
      const id = decodeURIComponent(m[1]);
      const found = m[2] === "read" ? data.markRead(id, s) : data.notifications(s).find((n) => n.id === id);
      if (!found) return raw(req, res, 404, { message: "Không tìm thấy thông báo (MOCK)" }), true;
      if (m[2] === "seen") found.seen = true;
      c.unreadOverride = null;
      return raw(req, res, 204), true;
    }
    return raw(req, res, 404, { message: "Not Found" }), true;
  }

  // ---- Admin: chiến dịch thông báo (hợp đồng đề xuất, chỉ ROLE_ADMIN) ----
  if (url.pathname.startsWith("/api/hsk/notification/admin/campaigns")) {
    const s = ctx.require(["ROLE_ADMIN"]);
    if (!s) return true;
    const sub = url.pathname.slice("/api/hsk/notification/admin/campaigns".length);
    if ((sub === "" || sub === "/") && method === "GET") {
      count("campaignList");
      if (c.campaigns === "error") return send(req, res, 500, fail("500", "Lỗi lịch sử chiến dịch giả lập (MOCK)")), true;
      return send(req, res, 200, ok(paginate(c.campaigns === "empty" ? [] : data.campaigns(), url.searchParams))), true;
    }
    if (sub === "/send-now" && method === "POST") {
      count("campaignSend");
      const body = await readBody(req);
      if (!body || typeof body.title !== "string" || !body.title.trim() || typeof body.message !== "string" || !body.message.trim() || !Array.isArray(body.userIds) || body.userIds.length === 0) {
        return send(req, res, 400, fail("VALIDATION_ERROR", "Dữ liệu chiến dịch không hợp lệ (MOCK)")), true;
      }
      const respond = () => {
        if (c.send === "error") return send(req, res, 500, fail("500", "Gửi chiến dịch giả lập thất bại (MOCK)"));
        state.campaignsSent.push(body);
        return send(req, res, 200, ok(data.addCampaign(body)));
      };
      return c.send === "slow" ? void setTimeout(respond, 1500) : respond(), true;
    }
    return false;
  }
  return false;
}

/** Thời điểm hiện tại của mock (để handler khác tạo thông báo mới, vd. gửi nhận xét). */
export const now = () => new Date(nowMs()).toISOString();
