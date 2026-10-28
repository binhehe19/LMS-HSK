// ticket "phân công công việc" GIẢ LẬP (/api/tickets, /api/tickets/*): hợp đồng ĐỀ XUẤT kế thừa ticket.service.ts của HSK cũ (gốc /id/tickets) —
// docs/api-requirements/work-tickets.md. Thao tác ghi đổi dữ liệu trong bộ nhớ (lần đọc sau thấy khác); /mock-reset đưa về seed.
//
// PHỐI HỢP với handlers/tickets.mjs (GET /api/tickets cho toast chào mừng; dữ liệu đóng băng cho Playwright):
//   - hồ sơ `demo`: module này trả CẢ danh sách GET (cùng kho với các thao tác ghi => có module/mô tả/người được giao; vẫn tôn trọng controls.tickets
//     none|error và controls.api) => server.mjs phải đặt module này TRƯỚC `tickets` trong HANDLERS;
//   - hồ sơ `e2e`: GET danh sách trả false để tickets.mjs phục vụ như cũ (không đổi số liệu e2e đã đóng băng); các path còn lại vẫn do module này xử lý
//     (kho e2e khớp 4 ticket t1..t4 của ticketsFor cho vai trò teacher).
// Quyền: ADMIN quản lý (assignees, tạo/sửa/xoá/đóng); TEACHER/MENTOR/COLLABORATOR chỉ "done" ticket được giao cho CHÍNH mình (so với state.data.me(s).id).
import { count, fail, nowMs, ok, paginate, readBody, registerResettable, respondWithApiState, send, state } from "../core.mjs";

const MODULES = ["FLASHCARD", "QUIZ", "AI", "LISTENING_PRACTICE", "STORAGE", "DICTIONARY", "KANJI_ORIGIN", "LEARNING_PATH", "VIDEO_COURSE", "WRITING", "PRONUNCIATION", "ONLINE_COURSE", "GRAMMAR", "OTHER"];
const MANAGER_ROLES = ["ROLE_ADMIN"];
const ASSIGNEE_ROLES = ["ROLE_TEACHER", "ROLE_MENTOR", "ROLE_COLLABORATOR"];
const DAY = 86_400_000;

/** Kho dữ liệu của miền, seed lười (state.data chỉ có sau khi server.mjs gán provider) và bị xoá khi /mock-reset. */
let store = null;
const data = () => store ?? (store = seed());
registerResettable(() => {
  store = null;
});

const at = (daysAgo) => new Date(nowMs() - daysAgo * DAY).toISOString();
const person = (id, email, fullName, roles) => ({ id, email, fullName, roles });
const mk = (id, assignedId, module, status, description, daysAgo, createdBy) => ({ id, description, module, status, assignedId, createdBy, createdAt: at(daysAgo), updatedAt: at(Math.max(0, daysAgo - 1)) });

function seed() {
  const d = state.data;
  if (d.profile === "demo") {
    const raw = d.raw;
    const admin = raw.accounts.admin.id;
    const people = [
      ...raw.teachers.map((t) => person(t.id, t.email, t.name, ["ROLE_TEACHER"])),
      person(raw.accounts.mentor.id, raw.accounts.mentor.email, raw.accounts.mentor.fullName, ["ROLE_MENTOR"]),
      person(raw.accounts.collaborator.id, raw.accounts.collaborator.email, raw.accounts.collaborator.fullName, ["ROLE_COLLABORATOR"]),
    ];
    // Giảng viên demo (demo-teacher): WRITING + QUIZ đang mở, FLASHCARD đã báo cáo — quyền sửa nội dung của giảng viên ở các màn nội dung dựa vào đây.
    const tickets = [
      mk("tk-201", "demo-teacher", "WRITING", "OPEN", "Biên soạn 20 bài luyện viết Hán tự cấp HSK 4 (bộ thủ, thứ tự nét) cho lớp H4006.", 6, admin),
      mk("tk-202", "demo-teacher", "QUIZ", "OPEN", "Rà soát và bổ sung ngân hàng câu hỏi trắc nghiệm HSK 4 — chủ đề 把字句, 50 câu.", 3, admin),
      mk("tk-203", "demo-teacher", "FLASHCARD", "DONE", "Cập nhật bộ thẻ ghi nhớ từ vựng HSK 4 bài 1–5 (có pinyin, câu ví dụ).", 12, admin),
      mk("tk-204", "t-02", "LISTENING_PRACTICE", "OPEN", "Chuẩn hoá audio bài nghe HSK 5 buổi 3–6, cắt theo từng câu hỏi.", 2, admin),
      mk("tk-205", "t-03", "DICTIONARY", "CLOSE", "Bổ sung 200 mục từ điển chủ đề giao tiếp (GT1) kèm câu ví dụ.", 30, admin),
      mk("tk-206", "demo-collab", "STORAGE", "OPEN", "Dọn kho lưu trữ đa phương tiện: gắn thẻ, xoá tệp trùng.", 1, admin),
      mk("tk-207", "demo-mentor", "OTHER", "DONE", "Soát lỗi giáo trình Giao tiếp 2 (GT2) phiên bản 2.", 8, admin),
      mk("tk-208", "t-02", "VIDEO_COURSE", "CLOSE", "Biên tập 3 video bài giảng HSK 5 — chương Thành ngữ.", 45, admin),
    ];
    return { people, tickets, seq: 300 };
  }
  // e2e: cố định. state.data.me(s).id = `mock-${role}`; khớp ticketsFor của tickets.mjs cho giảng viên (t1 OPEN mình, t2 OPEN người khác, t3 DONE mình, t4 CLOSE mình).
  const people = [
    person("mock-teacher", "teacher@mock.invalid", "Người dùng giả lập (teacher)", ["ROLE_TEACHER"]),
    person("mock-mentor", "mentor@mock.invalid", "Người dùng giả lập (mentor)", ["ROLE_MENTOR"]),
    person("someone-else", "khac@mock.invalid", "Giảng viên giả lập khác", ["ROLE_TEACHER"]),
    person("mock-collaborator", "ctv@mock.invalid", "Cộng tác viên giả lập", ["ROLE_COLLABORATOR"]),
  ];
  const tickets = [
    mk("t1", "mock-teacher", "FLASHCARD", "OPEN", "Ticket giả lập 1 (DỮ LIỆU GIẢ)", 3, "mock-admin"),
    mk("t2", "someone-else", "QUIZ", "OPEN", "Ticket giả lập 2 (DỮ LIỆU GIẢ)", 2, "mock-admin"),
    mk("t3", "mock-teacher", "WRITING", "DONE", "Ticket giả lập 3 (DỮ LIỆU GIẢ)", 10, "mock-admin"),
    mk("t4", "mock-teacher", "STORAGE", "CLOSE", "Ticket giả lập 4 (DỮ LIỆU GIẢ)", 20, "mock-admin"),
  ];
  return { people, tickets, seq: 10 };
}

/** TicketResponse: thêm tên/email người được giao từ danh bạ (backend cũ trả `assignedName`/`assignedEmail`). */
const toResponse = (s, t) => {
  const p = s.people.find((x) => x.id === t.assignedId);
  return { ...t, assignedName: p?.fullName, assignedEmail: p?.email };
};

function validateTicketBody(body, creating, s) {
  if (!body || typeof body !== "object") return "Thiếu nội dung yêu cầu (MOCK)";
  const has = (k) => body[k] !== undefined;
  if ((creating || has("description")) && (typeof body.description !== "string" || !body.description.trim())) return "Mô tả công việc không được trống (MOCK)";
  if ((creating || has("module")) && !MODULES.includes(body.module)) return "Module không hợp lệ (MOCK)";
  if ((creating || has("assignedId")) && (typeof body.assignedId !== "string" || !s.people.some((p) => p.id === body.assignedId))) return "Người được giao không tồn tại (MOCK)";
  return null;
}

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (url.pathname !== "/api/tickets" && !url.pathname.startsWith("/api/tickets/")) return false;
  const sub = url.pathname.slice("/api/tickets".length).replace(/\/+$/, "");
  const q = url.searchParams;
  const s = data();
  const now = () => new Date(nowMs()).toISOString();

  if (sub === "" && method === "GET") {
    if (state.data.profile !== "demo") return false; // e2e: tickets.mjs giữ dữ liệu đóng băng
    count("tickets");
    const session = ctx.session();
    if (!session) return send(req, res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)")), true;
    if (state.controls.tickets === "error") return send(req, res, 500, fail("500", "Lỗi máy chủ giả lập (MOCK)")), true;
    const me = state.data.me(session).id;
    const visible = state.controls.tickets === "none" ? [] : session.roles.includes("ROLE_ADMIN") ? s.tickets : s.tickets.filter((t) => t.assignedId === me);
    const sorted = [...visible].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return respondWithApiState(ctx, () => paginate(sorted.map((t) => toResponse(s, t)), q, 100)), true;
  }

  if (sub === "/assignees" && method === "GET") {
    count("ticketAssignees");
    if (!ctx.require(MANAGER_ROLES)) return true;
    const kw = (q.get("q") || "").trim().toLowerCase();
    const list = s.people.filter((p) => !kw || p.fullName.toLowerCase().includes(kw) || p.email.toLowerCase().includes(kw));
    return respondWithApiState(ctx, () => list), true;
  }

  if (sub === "" && method === "POST") {
    count("ticketCreate");
    const session = ctx.require(MANAGER_ROLES);
    if (!session) return true;
    const body = await readBody(req);
    const error = validateTicketBody(body, true, s);
    if (error) return send(req, res, 400, fail("VALIDATION_ERROR", error)), true;
    const ticket = { id: `tk-${++s.seq}`, description: body.description.trim(), module: body.module, status: "OPEN", assignedId: body.assignedId, createdBy: state.data.me(session).id, createdAt: now(), updatedAt: now() };
    s.tickets.unshift(ticket);
    return send(req, res, 201, ok(toResponse(s, ticket))), true;
  }

  const m = sub.match(/^\/([^/]+)(?:\/(close|done))?$/);
  if (!m) return false;
  const id = decodeURIComponent(m[1]);
  const action = m[2];
  const ticket = s.tickets.find((t) => t.id === id);
  const notFound = () => send(req, res, 404, fail("404", "Không tìm thấy ticket (MOCK)"));
  const conflict = (msg) => send(req, res, 409, fail("CONFLICT", msg));

  if (!action && method === "PUT") {
    count("ticketUpdate");
    if (!ctx.require(MANAGER_ROLES)) return true;
    if (!ticket) return notFound(), true;
    if (ticket.status !== "OPEN") return conflict("Chỉ sửa được ticket đang mở (MOCK)"), true;
    const body = await readBody(req);
    const error = validateTicketBody(body, false, s);
    if (error) return send(req, res, 400, fail("VALIDATION_ERROR", error)), true;
    if (typeof body.description === "string") ticket.description = body.description.trim();
    if (body.module) ticket.module = body.module;
    if (body.assignedId) ticket.assignedId = body.assignedId;
    ticket.updatedAt = now();
    return send(req, res, 200, ok(toResponse(s, ticket))), true;
  }

  if (!action && method === "DELETE") {
    count("ticketDelete");
    if (!ctx.require(MANAGER_ROLES)) return true;
    if (!ticket) return notFound(), true;
    if (ticket.status !== "CLOSE") return conflict("Chỉ xoá được ticket đã đóng (MOCK)"), true;
    s.tickets = s.tickets.filter((t) => t.id !== id);
    return send(req, res, 200, ok(true)), true;
  }

  if (action === "close" && method === "POST") {
    count("ticketClose");
    if (!ctx.require(MANAGER_ROLES)) return true;
    if (!ticket) return notFound(), true;
    if (ticket.status === "CLOSE") return conflict("Ticket đã đóng (MOCK)"), true;
    ticket.status = "CLOSE";
    ticket.updatedAt = now();
    return send(req, res, 200, ok(toResponse(s, ticket))), true;
  }

  if (action === "done" && method === "POST") {
    count("ticketDone");
    const session = ctx.require(ASSIGNEE_ROLES);
    if (!session) return true;
    if (!ticket) return notFound(), true;
    if (ticket.assignedId !== state.data.me(session).id) return send(req, res, 403, fail("FORBIDDEN", "Ticket không được giao cho bạn (MOCK)")), true;
    if (ticket.status !== "OPEN") return conflict("Chỉ báo cáo hoàn thành được ticket đang mở (MOCK)"), true;
    ticket.status = "DONE";
    ticket.updatedAt = now();
    return send(req, res, 200, ok(toResponse(s, ticket))), true;
  }

  return false;
}
