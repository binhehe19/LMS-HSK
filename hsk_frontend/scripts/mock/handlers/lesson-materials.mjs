// Dịch vụ tài liệu học tập GIẢ LẬP (/api/hsk/lesson-materials/*) theo HỢP ĐỒNG ĐỀ XUẤT kế thừa lesson-materials.service.ts HSK cũ: bộ tài liệu
// (CRUD + lưu trữ/khôi phục), tài liệu (danh sách phân trang, tạo một, tạo hàng loạt, đổi trạng thái có kiểm tra chuyển trạng thái). Chỉ ROLE_ADMIN
// (bản cũ: manager-only). Byte tệp nằm ở repo-storage giả lập (handlers/storage.mjs): tài liệu chỉ giữ fileId, metadata lấy từ kho; fileId không tồn tại => 400.
import { count, fail, ok, paginate, readBody, registerResettable, send, sendError, state } from "../core.mjs";
import { getStoredFile, registerSeedFile } from "./storage.mjs";

const CATEGORIES = ["LESSON", "COURSE"];
const TYPES = ["SLIDE", "GRAMMAR", "GRAMMAR_3_0", "TEXTBOOK"];
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const TRANSITIONS = { DRAFT: ["PUBLISHED", "ARCHIVED"], PUBLISHED: ["DRAFT", "ARCHIVED"], ARCHIVED: ["DRAFT"] };
const MIME = { pdf: "application/pdf", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

let db = null;
registerResettable(() => {
  db = null;
});

const normalize = (name) => String(name || "").trim().toLocaleLowerCase("vi-VN");
const ts = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

function material(seq, { title, type, groupId, status, ext, sizeKb, description, daysAgo }) {
  const id = `lm-${String(seq).padStart(3, "0")}`;
  const filename = `${title.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
  const fileId = registerSeedFile({ fileId: `file-${id}`, filename, mimeType: MIME[ext], sizeBytes: sizeKb * 1024 });
  return { id, title, description: description ?? null, type, category: type === "TEXTBOOK" ? "COURSE" : "LESSON", status, groupId: groupId ?? null, fileId, filename, mimeType: MIME[ext], sizeBytes: sizeKb * 1024, createdAt: ts(daysAgo), updatedAt: ts(daysAgo) };
}

function seedDemo() {
  const groups = [
    { id: "lmg-hsk3", name: "HSK 3", description: "Slide và ngữ pháp 10 buổi HSK 3", displayOrder: 1, status: "ACTIVE", createdAt: ts(120), updatedAt: ts(5) },
    { id: "lmg-hsk4", name: "HSK 4", description: "Bộ tài liệu khoá H40", displayOrder: 2, status: "ACTIVE", createdAt: ts(100), updatedAt: ts(9) },
    { id: "lmg-hsk5", name: "HSK 5", description: null, displayOrder: 3, status: "ACTIVE", createdAt: ts(80), updatedAt: ts(30) },
    { id: "lmg-gt", name: "Giao tiếp", description: "Tình huống giao tiếp GT1/GT2", displayOrder: 4, status: "ACTIVE", createdAt: ts(60), updatedAt: ts(2) },
    { id: "lmg-hsk2", name: "HSK 2 (cũ)", description: "Bộ cũ, đã lưu trữ", displayOrder: 5, status: "ARCHIVED", createdAt: ts(300), updatedAt: ts(45) },
  ];
  let seq = 0;
  const materials = [
    ...[1, 2, 3, 4].map((i) => material(++seq, { title: `Slide buổi ${i} HSK 3`, type: "SLIDE", groupId: "lmg-hsk3", status: i === 4 ? "DRAFT" : "PUBLISHED", ext: i % 2 ? "pdf" : "pptx", sizeKb: 1800 + i * 310, daysAgo: 40 - i * 3 })),
    material(++seq, { title: "Ngữ pháp 把字句", type: "GRAMMAR", groupId: "lmg-hsk3", status: "PUBLISHED", ext: "png", sizeKb: 420, description: "Sơ đồ câu chữ 把", daysAgo: 25 }),
    material(++seq, { title: "Ngữ pháp bổ ngữ kết quả", type: "GRAMMAR", groupId: "lmg-hsk3", status: "PUBLISHED", ext: "jpg", sizeKb: 380, daysAgo: 24 }),
    material(++seq, { title: "Ngữ pháp 3.0 — so sánh 比", type: "GRAMMAR_3_0", groupId: "lmg-hsk3", status: "DRAFT", ext: "webp", sizeKb: 250, daysAgo: 6 }),
    ...[1, 2, 3].map((i) => material(++seq, { title: `Slide buổi ${i} HSK 4`, type: "SLIDE", groupId: "lmg-hsk4", status: "PUBLISHED", ext: "pdf", sizeKb: 2100 + i * 150, daysAgo: 30 - i * 2 })),
    material(++seq, { title: "Ngữ pháp 虽然…但是…", type: "GRAMMAR", groupId: "lmg-hsk4", status: "ARCHIVED", ext: "png", sizeKb: 390, daysAgo: 50 }),
    ...[1, 2].map((i) => material(++seq, { title: `Slide buổi ${i} HSK 5`, type: "SLIDE", groupId: "lmg-hsk5", status: "DRAFT", ext: "pptx", sizeKb: 3400 + i * 200, daysAgo: 10 - i })),
    material(++seq, { title: "Tình huống: gọi món ở nhà hàng", type: "SLIDE", groupId: "lmg-gt", status: "PUBLISHED", ext: "pdf", sizeKb: 980, daysAgo: 3 }),
    material(++seq, { title: "Giáo trình HSK Standard Course 3", type: "TEXTBOOK", groupId: null, status: "PUBLISHED", ext: "pdf", sizeKb: 15_300, description: "Bản PDF giáo trình chính", daysAgo: 90 }),
    material(++seq, { title: "Slide giới thiệu khoá học", type: "SLIDE", groupId: null, status: "DRAFT", ext: "pdf", sizeKb: 640, daysAgo: 1 }),
  ];
  return { groups, materials, seq };
}

function seedE2e() {
  const groups = [
    { id: "mock-lmg-1", name: "Bộ giả lập 1", description: "Bộ tài liệu giả lập đang dùng", displayOrder: 1, status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
    { id: "mock-lmg-2", name: "Bộ giả lập 2", description: null, displayOrder: 2, status: "ARCHIVED", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z" },
  ];
  let seq = 0;
  const materials = [
    material(++seq, { title: "Slide giả lập 1", type: "SLIDE", groupId: "mock-lmg-1", status: "PUBLISHED", ext: "pdf", sizeKb: 1024, daysAgo: 10 }),
    material(++seq, { title: "Ngữ pháp giả lập 1", type: "GRAMMAR", groupId: "mock-lmg-1", status: "DRAFT", ext: "png", sizeKb: 300, daysAgo: 5 }),
    material(++seq, { title: "Slide chưa phân loại", type: "SLIDE", groupId: null, status: "DRAFT", ext: "pdf", sizeKb: 512, daysAgo: 1 }),
  ];
  return { groups, materials, seq };
}

const ensure = () => (db ??= state.data?.profile === "demo" ? seedDemo() : seedE2e());

const withApiState = (ctx, produce, status = 200) => {
  const mode = state.controls.api;
  if (mode === "error") return send(ctx.req, ctx.res, 500, fail("500", "Lỗi máy chủ giả lập (MOCK)"));
  const respond = () => {
    try {
      send(ctx.req, ctx.res, status, ok(produce()));
    } catch (error) {
      sendError(ctx, error);
    }
  };
  return mode === "slow" ? void setTimeout(respond, 2500) : respond();
};

const groupedByType = (list) => {
  const byType = {};
  for (const m of list) (byType[m.type] ??= []).push(m);
  return byType;
};

/** Kiểm tra body tạo tài liệu; trả { error: {code, message} } hoặc { value }. */
function validateMaterial(d, body) {
  if (!body || typeof body.title !== "string" || !body.title.trim()) return { error: ["VALIDATION_ERROR", "Tên tài liệu là bắt buộc"] };
  if (!CATEGORIES.includes(body.category)) return { error: ["VALIDATION_ERROR", "Danh mục không hợp lệ"] };
  if (!TYPES.includes(body.type)) return { error: ["VALIDATION_ERROR", "Loại tài liệu không hợp lệ"] };
  if ((body.type === "TEXTBOOK") !== (body.category === "COURSE")) return { error: ["VALIDATION_ERROR", "Loại tài liệu không khớp danh mục (TEXTBOOK thuộc COURSE)"] };
  const file = getStoredFile(body.fileId);
  if (!file) return { error: ["FILE_NOT_FOUND", "fileId không tồn tại trong kho lưu trữ hoặc chưa tải xong"] };
  let group = null;
  if (body.groupId) {
    group = d.groups.find((g) => g.id === body.groupId);
    if (!group) return { error: ["GROUP_NOT_FOUND", "Không tìm thấy bộ tài liệu"] };
    if (group.status === "ARCHIVED") return { error: ["GROUP_ARCHIVED", "Bộ tài liệu đã lưu trữ, không thể thêm tài liệu"] };
  }
  const now = new Date().toISOString();
  return {
    value: { id: `lm-${String(++d.seq).padStart(3, "0")}`, title: body.title.trim(), description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null, type: body.type, category: body.category, status: "DRAFT", groupId: group?.id ?? null, fileId: file.fileId, filename: file.filename, mimeType: file.mimeType, sizeBytes: file.sizeBytes, createdAt: now, updatedAt: now },
  };
}

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (!url.pathname.startsWith("/api/hsk/lesson-materials/")) return false;
  const sub = url.pathname.slice("/api/hsk/lesson-materials".length);
  const q = url.searchParams;
  const s = ctx.require(["ROLE_ADMIN"]);
  if (!s) return true;
  const d = ensure();

  // ---- bộ tài liệu ----
  if (sub === "/groups" && method === "GET") {
    count("lmGroups");
    const status = q.get("status");
    const search = (q.get("search") || "").trim().toLowerCase();
    return withApiState(ctx, () => d.groups.filter((g) => (!status || g.status === status) && (!search || g.name.toLowerCase().includes(search)))), true;
  }
  if (sub === "/groups" && method === "POST") {
    count("lmGroupCreate");
    const body = (await readBody(req)) ?? {};
    if (typeof body.name !== "string" || !body.name.trim()) return send(req, res, 400, fail("VALIDATION_ERROR", "Tên bộ tài liệu là bắt buộc (MOCK)")), true;
    if (d.groups.some((g) => normalize(g.name) === normalize(body.name))) return send(req, res, 409, fail("LESSON_MATERIAL_GROUP_DUPLICATE_NAME", "Tên bộ tài liệu đã tồn tại (MOCK)")), true;
    const now = new Date().toISOString();
    const group = { id: `lmg-new-${d.groups.length + 1}`, name: body.name.trim(), description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null, displayOrder: d.groups.length + 1, status: "ACTIVE", createdAt: now, updatedAt: now };
    d.groups.push(group);
    return send(req, res, 201, ok(group)), true;
  }

  const group = sub.match(/^\/groups\/([^/]+)(\/materials)?$/);
  if (group) {
    const found = d.groups.find((g) => g.id === decodeURIComponent(group[1]));
    if (!found) return send(req, res, 404, fail("404", "Không tìm thấy bộ tài liệu (MOCK)")), true;
    if (group[2] && method === "GET") return count("lmGroupMaterials"), withApiState(ctx, () => ({ group: found, materialsByType: groupedByType(d.materials.filter((m) => m.groupId === found.id)) })), true;
    if (!group[2] && method === "PATCH") {
      count("lmGroupUpdate");
      const body = (await readBody(req)) ?? {};
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || !body.name.trim()) return send(req, res, 400, fail("VALIDATION_ERROR", "Tên bộ tài liệu không hợp lệ (MOCK)")), true;
        if (d.groups.some((g) => g !== found && normalize(g.name) === normalize(body.name))) return send(req, res, 409, fail("LESSON_MATERIAL_GROUP_DUPLICATE_NAME", "Tên bộ tài liệu đã tồn tại (MOCK)")), true;
        found.name = body.name.trim();
      }
      if (body.description !== undefined) found.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
      if (body.status !== undefined) {
        if (!["ACTIVE", "ARCHIVED"].includes(body.status)) return send(req, res, 400, fail("VALIDATION_ERROR", "Trạng thái bộ không hợp lệ (MOCK)")), true;
        found.status = body.status;
      }
      if (Number.isInteger(body.displayOrder)) found.displayOrder = body.displayOrder;
      found.updatedAt = new Date().toISOString();
      return send(req, res, 200, ok(found)), true;
    }
    if (!group[2] && method === "DELETE") {
      count("lmGroupArchive");
      found.status = "ARCHIVED";
      found.updatedAt = new Date().toISOString();
      return send(req, res, 200, ok(found)), true;
    }
    return false;
  }

  // ---- tài liệu ----
  if (sub === "/materials" && method === "GET") {
    count("lmMaterials");
    const keyword = (q.get("keyword") || "").trim().toLowerCase();
    const filters = { category: q.get("category"), type: q.get("type"), status: q.get("status"), groupId: q.get("groupId") };
    const all = d.materials
      .filter((m) => (!keyword || m.title.toLowerCase().includes(keyword)) && (!filters.category || m.category === filters.category) && (!filters.type || m.type === filters.type) && (!filters.status || m.status === filters.status) && (!filters.groupId || m.groupId === filters.groupId))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return withApiState(ctx, () => {
      const page = paginate(all, q, 20);
      return { content: page.items, totalElements: page.totalElements, totalPages: page.totalPages, size: page.size, number: page.page };
    }), true;
  }
  if (sub === "/materials" && method === "POST") {
    count("lmMaterialCreate");
    const checked = validateMaterial(d, await readBody(req));
    if (checked.error) return send(req, res, checked.error[0] === "GROUP_NOT_FOUND" ? 404 : 400, fail(checked.error[0], `${checked.error[1]} (MOCK)`)), true;
    d.materials.unshift(checked.value);
    return send(req, res, 201, ok(checked.value)), true;
  }
  if (sub === "/materials/bulk" && method === "POST") {
    count("lmMaterialBulk");
    const body = await readBody(req);
    if (!body || !Array.isArray(body.items) || body.items.length === 0) return send(req, res, 400, fail("VALIDATION_ERROR", "items phải là mảng không rỗng (MOCK)")), true;
    const created = [];
    const errors = [];
    body.items.forEach((item, index) => {
      const checked = validateMaterial(d, item);
      if (checked.error) errors.push({ index, title: String(item?.title ?? ""), errorCode: checked.error[0], message: `${checked.error[1]} (MOCK)` });
      else {
        d.materials.unshift(checked.value);
        created.push(checked.value);
      }
    });
    return send(req, res, 200, ok({ created, errors: errors.length ? errors : null, totalRequested: body.items.length, totalCreated: created.length, totalFailed: errors.length })), true;
  }
  const status = sub.match(/^\/materials\/([^/]+)\/status$/);
  if (status && method === "PATCH") {
    count("lmMaterialStatus");
    const found = d.materials.find((m) => m.id === decodeURIComponent(status[1]));
    if (!found) return send(req, res, 404, fail("404", "Không tìm thấy tài liệu (MOCK)")), true;
    const body = (await readBody(req)) ?? {};
    if (!STATUSES.includes(body.status)) return send(req, res, 400, fail("VALIDATION_ERROR", "Trạng thái không hợp lệ (MOCK)")), true;
    if (!TRANSITIONS[found.status].includes(body.status)) return send(req, res, 409, fail("LESSON_MATERIAL_INVALID_STATUS_TRANSITION", `Không thể chuyển ${found.status} → ${body.status} (MOCK)`)), true;
    found.status = body.status;
    found.updatedAt = new Date().toISOString();
    return send(req, res, 200, ok(found)), true;
  }

  return false;
}
