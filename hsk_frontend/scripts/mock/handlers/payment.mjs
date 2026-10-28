// payment service GIẢ LẬP (/api/hsk/payment/*): sao kê (tổng quan + giao dịch phân trang/sắp xếp phía máy chủ) và CRUD gói thành viên — hợp đồng ĐỀ XUẤT
// kế thừa payment.service.ts / membership.service.ts của HSK cũ (docs/api-requirements/payment.md). Chỉ ROLE_ADMIN. Thao tác ghi đổi dữ liệu trong bộ nhớ;
// tổng quan được TÍNH từ cùng kho giao dịch nên luôn khớp bảng; /mock-reset đưa về seed. Đọc tôn trọng controls.api (ok|error|slow).
import { count, fail, nowMs, ok, readBody, registerResettable, respondWithApiState, send, state } from "../core.mjs";
import { createRng } from "../data/grading-model.mjs";

const DAY = 86_400_000;
const ADMIN = ["ROLE_ADMIN"];
/** Trường sắp xếp hợp lệ (Spring `sort=field,dir`); khác => 400. */
const SORTABLE = { createdAt: (t) => Date.parse(t.createdAt), paidAt: (t) => (t.paidAt ? Date.parse(t.paidAt) : 0), totalPrice: (t) => t.totalPrice, orderCode: (t) => t.orderCode };

let store = null;
const data = () => store ?? (store = seed());
registerResettable(() => {
  store = null;
});

const iso = (ms) => new Date(ms).toISOString();
const plan = (id, name, description, price, durationInDays, active, createdDaysAgo) => ({ id, name, description, price, durationInDays, active, createdAt: iso(nowMs() - createdDaysAgo * DAY), updatedAt: iso(nowMs() - createdDaysAgo * DAY) });
const planItem = (p) => ({ packageId: p.id, packageName: p.name, price: p.price, thumbnail: "", itemType: "MEMBERSHIP", durationInDays: p.durationInDays });

function seed() {
  const d = state.data;
  const now = nowMs();
  if (d.profile === "demo") {
    const raw = d.raw;
    const rng = createRng(0x5151);
    const plans = [
      plan("mp-1", "VIP 1 tháng", "Truy cập toàn bộ kho luyện tập HSK, thẻ ghi nhớ và chấm bài AI trong 30 ngày.", 199000, 30, true, 220),
      plan("mp-2", "VIP 3 tháng", "Toàn bộ quyền lợi VIP trong 90 ngày, ưu tiên lịch chấm bài viết.", 499000, 90, true, 220),
      plan("mp-3", "VIP 12 tháng", "Tiết kiệm 20% khi đăng ký theo năm. Lộ trình học cá nhân hoá và chứng chỉ hoàn thành.", 1990000, 365, true, 220),
      plan("mp-4", "VIP Hè 2025", "Gói khuyến mãi mùa hè, đã ngừng bán (chưa có giao dịch nên xoá được).", 299000, 60, false, 160),
    ];
    const coursePrice = { "c-h30": 1200000, "c-h40": 1500000, "c-h50": 1800000, "c-gt1": 900000, "c-gt2": 1100000, "c-lt4": 1300000 };
    const courseItem = (c) => ({ packageId: c.id, packageName: c.name, price: coursePrice[c.id] ?? 1000000, thumbnail: "", itemType: "COURSE" });
    const STATUSES = ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "PENDING", "CANCELLED", "PAYING"];
    const transactions = Array.from({ length: 37 }, (_, i) => {
      const st = rng.pick(raw.students);
      const r = rng.next();
      const items = r < 0.5 ? [courseItem(rng.pick(raw.courses))] : r < 0.85 ? [planItem(rng.pick(plans.slice(0, 3)))] : [courseItem(rng.pick(raw.courses)), planItem(plans[0])];
      const status = rng.pick(STATUSES);
      const created = now - rng.int(0, 120) * DAY - rng.int(0, 86_399) * 1000;
      return {
        orderId: `ord-${String(i + 1).padStart(3, "0")}`,
        orderCode: 240001 + i,
        status,
        createdAt: iso(created),
        paidAt: status === "COMPLETED" ? iso(created + rng.int(60, 3 * 3600) * 1000) : undefined,
        totalPrice: items.reduce((sum, it) => sum + it.price, 0),
        buyer: { userId: st.userId, username: st.email.split("@")[0], fullName: st.name, email: st.email },
        courses: items,
      };
    });
    return { plans, transactions, seq: 10 };
  }
  // e2e: cố định, ít bản ghi (12 giao dịch => 2 trang với size 10).
  const plans = [
    plan("mock-plan-1", "VIP Monthly (DỮ LIỆU GIẢ)", "Gói giả lập 30 ngày.", 199000, 30, true, 30),
    plan("mock-plan-2", "VIP Yearly (DỮ LIỆU GIẢ)", "Gói giả lập 365 ngày.", 1990000, 365, true, 30),
    plan("mock-plan-3", "VIP Ẩn (DỮ LIỆU GIẢ)", "Gói giả lập đã ẩn.", 99000, 7, false, 30),
  ];
  const transactions = Array.from({ length: 12 }, (_, i) => {
    const membership = i % 3 === 0;
    const status = ["COMPLETED", "COMPLETED", "PENDING", "CANCELLED"][i % 4];
    const created = now - (i + 1) * DAY;
    const items = membership ? [planItem(plans[0])] : [{ packageId: `mock-course-${(i % 4) + 1}`, packageName: `Khoá học giả lập ${(i % 4) + 1}`, price: 1500000 + i * 10000, thumbnail: "", itemType: "COURSE" }];
    return {
      orderId: `mock-ord-${i + 1}`,
      orderCode: 100001 + i,
      status,
      createdAt: iso(created),
      paidAt: status === "COMPLETED" ? iso(created + 3_600_000) : undefined,
      totalPrice: items.reduce((sum, it) => sum + it.price, 0),
      buyer: { userId: `mock-user-${i + 1}`, username: `nguoidung${i + 1}`, fullName: `Người dùng giả lập ${i + 1}`, email: `nguoidung${i + 1}@mock.invalid` },
      courses: items,
    };
  });
  return { plans, transactions, seq: 10 };
}

/** PaymentSummary tính từ kho giao dịch: doanh thu/lượt bán chỉ đếm đơn COMPLETED; số giao dịch/người mua đếm mọi đơn (như fallback của bản cũ). */
const summaryOf = (txs) => {
  const completed = txs.filter((t) => t.status === "COMPLETED");
  const items = completed.flatMap((t) => t.courses);
  return {
    totalRevenue: completed.reduce((sum, t) => sum + t.totalPrice, 0),
    totalTransactions: txs.length,
    totalStudents: new Set(txs.map((t) => t.buyer.userId)).size,
    totalCoursesSold: items.filter((it) => it.itemType !== "MEMBERSHIP").length,
    totalMembershipsSold: items.filter((it) => it.itemType === "MEMBERSHIP").length,
  };
};

function validatePlanBody(body, creating) {
  if (!body || typeof body !== "object") return "Thiếu nội dung yêu cầu (MOCK)";
  const has = (k) => body[k] !== undefined;
  if ((creating || has("name")) && (typeof body.name !== "string" || !body.name.trim())) return "Tên gói không được trống (MOCK)";
  if ((creating || has("price")) && (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price <= 0)) return "Giá gói phải là số lớn hơn 0 (MOCK)";
  if ((creating || has("durationInDays")) && (!Number.isInteger(body.durationInDays) || body.durationInDays < 1)) return "Thời hạn phải là số ngày nguyên, tối thiểu 1 (MOCK)";
  if (has("active") && typeof body.active !== "boolean") return "active phải là boolean (MOCK)";
  if (has("description") && typeof body.description !== "string") return "description phải là chuỗi (MOCK)";
  return null;
}

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (!url.pathname.startsWith("/api/hsk/payment/")) return false;
  const sub = url.pathname.slice("/api/hsk/payment".length).replace(/\/+$/, "");
  const q = url.searchParams;
  const s = data();
  const now = () => new Date(nowMs()).toISOString();

  if (sub === "/reports/summary" && method === "GET") {
    count("paymentSummary");
    if (!ctx.require(ADMIN)) return true;
    return respondWithApiState(ctx, () => summaryOf(s.transactions)), true;
  }

  if (sub === "/reports/transactions" && method === "GET") {
    count("paymentTransactions");
    if (!ctx.require(ADMIN)) return true;
    const sort = q.get("sort") || "createdAt,desc";
    const [field, dir = "asc"] = sort.split(",");
    const key = SORTABLE[field];
    if (!key || (dir !== "asc" && dir !== "desc")) return send(req, res, 400, fail("VALIDATION_ERROR", `Tham số sort không hợp lệ: ${sort} (MOCK)`)), true;
    const sorted = [...s.transactions].sort((a, b) => key(a) - key(b) || a.orderCode - b.orderCode);
    if (dir === "desc") sorted.reverse();
    const size = Math.max(1, Math.min(100, Number(q.get("size")) || 10));
    const page = Math.max(0, Number(q.get("page")) || 0);
    return respondWithApiState(ctx, () => ({ content: sorted.slice(page * size, page * size + size), totalElements: sorted.length, totalPages: Math.ceil(sorted.length / size), page, size })), true;
  }

  if (sub === "/membership-plans/admin/all" && method === "GET") {
    count("membershipPlans");
    if (!ctx.require(ADMIN)) return true;
    return respondWithApiState(ctx, () => s.plans), true;
  }

  if (sub === "/membership-plans/admin" && method === "POST") {
    count("membershipPlanCreate");
    if (!ctx.require(ADMIN)) return true;
    const body = await readBody(req);
    const error = validatePlanBody(body, true);
    if (error) return send(req, res, 400, fail("VALIDATION_ERROR", error)), true;
    const created = { id: `mp-new-${++s.seq}`, name: body.name.trim(), description: typeof body.description === "string" ? body.description.trim() : "", price: body.price, durationInDays: body.durationInDays, active: body.active ?? true, createdAt: now(), updatedAt: now() };
    s.plans.push(created);
    return send(req, res, 201, ok(created)), true;
  }

  const m = sub.match(/^\/membership-plans\/admin\/([^/]+)$/);
  if (m && (method === "PUT" || method === "DELETE")) {
    count(method === "PUT" ? "membershipPlanUpdate" : "membershipPlanDelete");
    if (!ctx.require(ADMIN)) return true;
    const id = decodeURIComponent(m[1]);
    const idx = s.plans.findIndex((p) => p.id === id);
    if (idx < 0) return send(req, res, 404, fail("404", "Không tìm thấy gói thành viên (MOCK)")), true;
    const target = s.plans[idx];
    if (method === "PUT") {
      const body = await readBody(req);
      const error = validatePlanBody(body, false);
      if (error) return send(req, res, 400, fail("VALIDATION_ERROR", error)), true;
      if (body.name !== undefined) target.name = body.name.trim();
      if (body.description !== undefined) target.description = body.description.trim();
      if (body.price !== undefined) target.price = body.price;
      if (body.durationInDays !== undefined) target.durationInDays = body.durationInDays;
      if (body.active !== undefined) target.active = body.active;
      target.updatedAt = now();
      return send(req, res, 200, ok(target)), true;
    }
    // Gói đã bán (có đơn COMPLETED) không xoá được — chỉ ẩn; mô phỏng ràng buộc toàn vẹn để màn hình có đường lỗi 409 thật.
    if (s.transactions.some((t) => t.status === "COMPLETED" && t.courses.some((c) => c.itemType === "MEMBERSHIP" && c.packageId === id))) {
      return send(req, res, 409, fail("CONFLICT", "Gói đã có giao dịch hoàn thành nên không xoá được; hãy ẩn gói (bỏ Kích hoạt bán gói) (MOCK)")), true;
    }
    s.plans.splice(idx, 1);
    return send(req, res, 200, ok(true)), true;
  }

  return false;
}
