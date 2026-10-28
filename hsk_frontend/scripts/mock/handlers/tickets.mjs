// ticket service GIẢ LẬP (/api/tickets): danh sách ticket cho toast chào mừng ở sidebar (M3A).
import { count, fail, ok, send, state } from "../core.mjs";

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (url.pathname !== "/api/tickets" || method !== "GET") return false;
  count("tickets");
  const s = ctx.session();
  if (!s) return send(req, res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)")), true;
  if (state.controls.tickets === "error") return send(req, res, 500, fail("500", "Lỗi máy chủ giả lập (MOCK)")), true;
  return send(req, res, 200, ok(state.controls.tickets === "none" ? [] : state.data.ticketsFor(state.data.me(s).id))), true;
}
