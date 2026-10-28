// Authentication_Frontend + Authentication_Backend GIẢ LẬP (/login, /mock-login, /api/auth/*). Mô phỏng HỢP ĐỒNG đọc từ Authentication_Backend
// (AuthController/AuthCookieService): cookie HttpOnly access_token/refresh_token; body có token chỉ khi "expose"; POST /refresh nhận body
// {refreshToken} hoặc cookie, thiếu cả hai => 400, sai/hết hạn => 401; POST /logout idempotent. KHÔNG thay cho kiểm chứng Auth thật.
import { PROFILE, ROLE_PRESETS, STATES, cookieHeaders, count, createSession, decodeToken, fail, issue, makeToken, ok, parseCookies, readBody, send, state } from "../core.mjs";

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Trang đăng nhập GIẢ LẬP hồ sơ e2e: form đầy đủ tham số kiểm thử (vai trò, transport, token, trạng thái API). */
const e2eLoginPage = (redirect) => `<!doctype html><html lang="vi"><meta charset="utf-8"><title>MOCK Auth</title>
<body style="font-family:system-ui;max-width:680px;margin:40px auto;padding:0 16px">
<h1>MOCK Authentication — KHÔNG phải hệ thống thật</h1>
<p>Chỉ để thử luồng chuyển hướng/phân quyền của frontend HSK ở local. Mô phỏng hợp đồng đọc từ code Auth, không thay cho kiểm chứng thật.</p>
<form method="GET" action="/mock-login">
  <input type="hidden" name="redirect" value="${esc(redirect)}">
  <p><b>Vai trò</b>${Object.keys(ROLE_PRESETS)
    .map((r, i) => `<label style="display:block"><input type="radio" name="role" value="${r}" ${i === 0 ? "checked" : ""}> ${r} (${ROLE_PRESETS[r].join(", ") || "không có role"})</label>`)
    .join("")}</p>
  <p><b>Chế độ (transport)</b>
    <label style="display:block"><input type="radio" name="transport" value="cookie" checked> cookie — như production: chỉ cookie HttpOnly, callback không có token</label>
    <label style="display:block"><input type="radio" name="transport" value="hash"> hash — như dev/staging khác miền gốc: callback kèm #access_token&amp;refresh_token, cookie không dùng được</label></p>
  <p>Access token ban đầu: <select name="access"><option>valid</option><option>expired</option></select>
     Refresh: <select name="refresh"><option>ok</option><option>fail</option><option>down</option></select>
     API danh sách lớp: <select name="state">${STATES.map((s) => `<option>${s}</option>`).join("")}</select></p>
  <button type="submit">Đăng nhập giả lập</button>
</form></body></html>`;

/** Trang đăng nhập hồ sơ demo: chọn nhanh tài khoản demo (Admin / Giảng viên / Mentor). Vẫn là Auth GIẢ LẬP. */
const demoLoginPage = (redirect) => {
  const btn = (role, label, desc) =>
    `<form method="GET" action="/mock-login" style="margin:0"><input type="hidden" name="redirect" value="${esc(redirect)}"><input type="hidden" name="role" value="${role}">
     <button type="submit" style="width:100%;text-align:left;padding:14px 16px;border:1px solid #d9dce3;border-radius:10px;background:#fff;cursor:pointer;font:inherit">
       <b style="display:block;font-size:16px">${label}</b><span style="color:#64748b;font-size:13px">${desc}</span></button></form>`;
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Đăng nhập DEMO · LMS HSK</title>
<body style="font-family:system-ui;background:#f4f6fb;margin:0"><main style="max-width:560px;margin:48px auto;padding:0 16px">
<div style="background:#fff3cd;border:1px solid #ffe69c;color:#664d03;border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:16px">
  <b>CHẾ ĐỘ DEMO</b> — Authentication và dữ liệu đều là GIẢ LẬP, chỉ chạy trên máy này. Không phải hệ thống Học Bá thật.</div>
<h1 style="font-size:22px;margin:0 0 6px">Chọn tài khoản demo</h1>
<p style="color:#64748b;margin:0 0 18px;font-size:14px">Sau khi chọn, bạn được chuyển về <code>${esc(redirect || "/")}</code> với phiên demo tương ứng.</p>
<div style="display:grid;gap:10px">
${btn("admin", "Quản trị viên (Admin)", "Toàn bộ khu Admin: tổng quan, lớp học, giảng viên, nội dung, thông báo…")}
${btn("teacher", "Giảng viên (Teacher)", "Lớp được phân công, bài nộp, chấm bài, phân tích học tập…")}
${btn("mentor", "Trợ giảng (Mentor)", "Cùng khu Giảng viên theo HSK cũ")}
${btn("user", "Học viên (không có quyền quản lý)", "Để xem màn 'Không có quyền truy cập'")}
</div>
<p style="color:#64748b;font-size:12px;margin-top:18px">Cần thử các tình huống kỹ thuật (token hết hạn, refresh lỗi…)? Dùng <a href="/login?redirect=${encodeURIComponent(redirect)}&amp;full=1">trang đăng nhập đầy đủ</a>.</p>
</main></body></html>`;
};

export async function handle(ctx) {
  const { req, res, url, method } = ctx;

  if (url.pathname === "/login") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    const redirect = url.searchParams.get("redirect") || "";
    return res.end(PROFILE === "demo" && !url.searchParams.has("full") ? demoLoginPage(redirect) : e2eLoginPage(redirect)), true;
  }
  if (url.pathname === "/mock-login") {
    const q = url.searchParams;
    const s = createSession(q);
    const redirect = q.get("redirect");
    const target = redirect && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(redirect) ? new URL(redirect) : null;
    if (!target) {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      return res.end("MOCK: đã tạo phiên giả lập nhưng không có redirect hợp lệ (chỉ chấp nhận http://localhost:* hoặc http://127.0.0.1:*)."), true;
    }
    const headers = { location: target.toString() };
    if (s.transport === "cookie") {
      headers["set-cookie"] = cookieHeaders(s);
    } else {
      const t = q.get("bad") ? { accessToken: makeToken({ sid: "forged", k: "a", v: 1 }), refreshToken: makeToken({ sid: "forged", k: "r", v: 1 }) } : issue(s);
      const hash = new URLSearchParams(target.hash.replace(/^#/, ""));
      hash.set("access_token", t.accessToken);
      hash.set("refresh_token", t.refreshToken);
      target.hash = hash.toString();
      headers.location = target.toString();
    }
    res.writeHead(302, headers);
    return res.end(), true;
  }

  if (url.pathname === "/api/auth/users/me" && method === "GET") {
    count("me");
    if (state.controls.meDown) return send(req, res, 500, fail("500", "Auth giả lập đang lỗi (MOCK)")), true;
    const s = ctx.session();
    if (!s) return send(req, res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)")), true;
    return send(req, res, 200, ok(state.data.me(s))), true;
  }
  if (url.pathname === "/api/auth/refresh" && method === "POST") {
    count("refresh");
    const body = await readBody(req);
    const token = body?.refreshToken || parseCookies(req).refresh_token;
    if (!token) return send(req, res, 400, fail("243", "Required parameter missing: refreshToken")), true;
    const payload = decodeToken(token);
    const s = payload ? state.sessions.get(payload.sid) : null;
    if (!s || payload.k !== "r" || payload.v !== s.refreshVersion) return send(req, res, 401, fail("248", "Invalid refreshToken")), true;
    if (s.refreshMode === "down") return send(req, res, 500, fail("500", "Refresh giả lập đang lỗi (MOCK)")), true;
    if (s.refreshMode === "fail") return send(req, res, 401, fail("248", "Invalid refreshToken")), true;
    s.accessVersion++;
    s.refreshVersion++;
    s.accessExpired = false;
    const t = issue(s);
    const session = { expiresInSeconds: 900, user: { id: state.data.me(s).id, roles: s.roles } };
    if (s.transport === "hash") return send(req, res, 200, ok({ ...session, accessToken: t.accessToken, refreshToken: t.refreshToken })), true;
    return send(req, res, 200, ok(session), { "set-cookie": cookieHeaders(s) }), true;
  }
  if (url.pathname === "/api/auth/logout" && method === "POST") {
    count("logout");
    const body = await readBody(req);
    const token = body?.refreshToken || parseCookies(req).refresh_token;
    const payload = token ? decodeToken(token) : null;
    if (payload) state.sessions.delete(payload.sid);
    return send(req, res, 200, ok(null), { "set-cookie": cookieHeaders({}, true) }), true;
  }
  return false;
}
