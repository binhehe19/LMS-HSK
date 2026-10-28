// Danh sách người dùng GIẢ LẬP (/api/admin/users): chỉ đọc, chỉ ROLE_ADMIN. Dùng cho bộ chọn người nhận thông báo (HSK cũ: `/id/admin/users`).
import { count, fail, ok, paginate, send, state } from "../core.mjs";

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (url.pathname !== "/api/admin/users" || method !== "GET") return false;
  count("users");
  const s = ctx.require(["ROLE_ADMIN"]);
  if (!s) return true;
  if (state.controls.users === "error") return send(req, res, 500, fail("500", "Lỗi danh sách người dùng giả lập (MOCK)")), true;
  const q = url.searchParams;
  const search = (q.get("search") || "").toLowerCase();
  const role = q.get("role");
  const everyone = state.controls.users === "empty" ? [] : state.data.users();
  const matched = everyone.filter((u) => (!role || u.roles.includes(role)) && (!search || (u.fullName || "").toLowerCase().includes(search) || u.email.toLowerCase().includes(search)));
  return send(req, res, 200, ok(paginate(matched, q))), true;
}
