// Dịch vụ định danh GIẢ LẬP — quản lý giảng viên (/api/hsk/id/teachers/*), theo hợp đồng ĐỀ XUẤT docs/api-requirements/teacher-management.md
// (kế thừa đường dẫn teacher-management.service.ts của HSK cũ). Chỉ ROLE_ADMIN (401 chưa đăng nhập, 403 sai role).
// Dữ liệu riêng trong bộ nhớ, seed theo hồ sơ: `demo` lấy state.data.raw.teachers + 6 giảng viên giả; `e2e` 5 bản ghi cố định.
// Thao tác ghi THAY ĐỔI dữ liệu (tạo → có trong danh sách và recently-created; block → BLOCKED; sync → job PROCESSING rồi DONE sau vài giây
// và thêm giảng viên "từ CMS"). Import chỉ đọc được CSV UTF-8 (file mẫu của màn hình); file Excel nhị phân bị bỏ qua có lý do (cần backend thật).
import { count, fail, nowMs, ok, readBody, registerResettable, respondWithApiState, send, state } from "../core.mjs";

const PREFIX = "/api/hsk/id/teachers";
const SYNC_DURATION_MS = 4000;
const RECENT_WINDOW_MS = 24 * 3_600_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { shortDescription: 500, fullDescription: 5000, teachingStyle: 300, qualification: 500 };
const PROFILE_FIELDS = ["avatarUrl", "shortDescription", "fullDescription", "teachingStyle", "qualification", "videoIntroLink"];

let teachers = [];
let job = null; // { jobId, type: "SYNC"|"IMPORT", status, message, updatedAt, timer }
let seq = 0;

const iso = (ms) => new Date(ms).toISOString();
const hoursAgo = (h) => iso(nowMs() - h * 3_600_000);
const daysAgo = (d) => iso(nowMs() - d * 86_400_000);

const mk = (over) => ({
  id: over.id,
  email: over.email,
  fullName: over.fullName,
  avatarUrl: null,
  status: "ACTIVE",
  roles: ["ROLE_TEACHER"],
  shortDescription: null,
  fullDescription: null,
  teachingStyle: null,
  qualification: null,
  videoIntroLink: null,
  createdAt: daysAgo(200),
  ...over,
});

/** Giảng viên "có trong CMS nhưng chưa có ở LMS": lần đồng bộ đầu thêm vào, các lần sau không có gì mới. */
const cmsOnly = (domain) => mk({ id: "cms-gv-01", email: `giakhanh.cms@${domain}`, fullName: "Hoàng Gia Khánh", shortDescription: "Đồng bộ từ CMS (MOCK)", qualification: "HSK 6", createdAt: daysAgo(30) });

function seedDemo() {
  const raw = state.data.raw.teachers;
  const fromRaw = raw.map((t) =>
    mk({
      id: t.id,
      email: t.email,
      fullName: t.name,
      status: t.status === "ACTIVE" ? "ACTIVE" : "BLOCKED", // màn hình chỉ phân biệt ACTIVE/BLOCKED; INACTIVE của CMS coi là đã khoá
      shortDescription: `Chuyên môn: ${t.specialty}`,
      createdAt: `${t.joinedAt}T08:00:00.000Z`,
    }),
  );
  const extra = [
    mk({ id: "gv-05", email: "minhkhue.demo@demo.invalid", fullName: "Trần Thị Minh Khuê", shortDescription: "12 năm giảng dạy HSK 4–6, chuyên luyện kỹ năng viết.", fullDescription: "Thạc sĩ Ngôn ngữ Trung Quốc. Từng dạy tại trung tâm ngôn ngữ ở Thượng Hải 3 năm; tác giả bộ đề luyện viết HSK 5 nội bộ.", teachingStyle: "Tương tác, thực hành, chữa bài chi tiết", qualification: "Thạc sĩ Ngôn ngữ Trung Quốc — ĐH Hà Nội; HSK 6", videoIntroLink: "https://video.example.invalid/intro/minhkhue", createdAt: daysAgo(420) }),
    mk({ id: "gv-06", email: "quanghuy.demo@demo.invalid", fullName: "Đỗ Quang Huy", status: "BLOCKED", shortDescription: "Giảng viên giao tiếp sơ cấp.", qualification: "HSK 5", createdAt: daysAgo(300) }),
    mk({ id: "gv-07", email: "thuhang.demo@demo.invalid", fullName: "Lý Thu Hằng", shortDescription: "Phát âm và thanh điệu cho người mới bắt đầu.", teachingStyle: "Trực quan, luyện nghe – nói theo cặp", qualification: "HSK 6, HSKK cao cấp", createdAt: daysAgo(90) }),
    mk({ id: "gv-08", email: "baotran.demo@demo.invalid", fullName: "Ngô Bảo Trân", qualification: "HSK 5", createdAt: hoursAgo(3), emailStatus: "SUCCESS", emailStatusReason: null }),
    mk({ id: "gv-09", email: "hainam.demo@demo.invalid", fullName: "Vũ Hải Nam", createdAt: hoursAgo(1), emailStatus: "FAILED", emailStatusReason: "Hộp thư không tồn tại (MOCK)" }),
    mk({ id: "gv-10", email: "ngocdiep.demo@demo.invalid", fullName: undefined, createdAt: daysAgo(10) }),
  ];
  return [...fromRaw, ...extra];
}

function seedE2e() {
  return [
    mk({ id: "mock-gv-1", email: "giangvien1@mock.invalid", fullName: "Giảng viên giả lập 1", shortDescription: "Mô tả ngắn giả lập 1", qualification: "HSK 6" }),
    mk({ id: "mock-gv-2", email: "giangvien2@mock.invalid", fullName: "Giảng viên giả lập 2" }),
    mk({ id: "mock-gv-3", email: "giangvien3@mock.invalid", fullName: "Giảng viên giả lập 3", status: "BLOCKED" }),
    mk({ id: "mock-gv-4", email: "giangvien4@mock.invalid", fullName: "Giảng viên giả lập 4", createdAt: hoursAgo(2), emailStatus: "SUCCESS", emailStatusReason: null }),
    mk({ id: "mock-gv-5", email: "giangvien5@mock.invalid", fullName: "Giảng viên giả lập 5", createdAt: hoursAgo(1), emailStatus: "FAILED", emailStatusReason: "Hộp thư không tồn tại (MOCK)" }),
  ];
}

function seed() {
  if (job?.timer) clearTimeout(job.timer);
  job = null;
  seq = 0;
  teachers = state.data?.profile === "demo" ? seedDemo() : seedE2e();
}
registerResettable(seed);

const domain = () => (state.data?.profile === "demo" ? "demo.invalid" : "mock.invalid");
const findTeacher = (id) => teachers.find((t) => t.id === id) ?? null;
const emailTaken = (email, exceptId) => teachers.some((t) => t.id !== exceptId && t.email.toLowerCase() === email.toLowerCase());

/** Kết quả gửi email tài khoản: địa chỉ chứa "fail" hoặc "bounce" thì thất bại để demo được luồng "Đổi email & gửi lại". */
const deliver = (teacher) => {
  const failed = /fail|bounce/i.test(teacher.email);
  teacher.emailStatus = failed ? "FAILED" : "SUCCESS";
  teacher.emailStatusReason = failed ? "Hộp thư không tồn tại (MOCK)" : null;
  return { teacher, emailStatus: teacher.emailStatus, emailStatusReason: teacher.emailStatusReason };
};

const text = (v) => (typeof v === "string" ? v.trim() : "");

/** Lỗi 400 đầu tiên của payload tạo/sửa, hoặc null. `partial` = PUT (trường vắng mặt không bị kiểm tra). */
function validate(body, { partial, exceptId }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, code: "VALIDATION_ERROR", message: "Thân yêu cầu không hợp lệ (MOCK)" };
  if ("status" in body) return { status: 400, code: "VALIDATION_ERROR", message: "Đổi trạng thái qua /block hoặc /activate, không qua PUT (MOCK)" };
  if (!partial || "fullName" in body) {
    if (!text(body.fullName)) return { status: 400, code: "VALIDATION_ERROR", message: "Họ và tên là bắt buộc (MOCK)" };
  }
  if (!partial || "email" in body) {
    if (!EMAIL_REGEX.test(text(body.email))) return { status: 400, code: "VALIDATION_ERROR", message: "Email chưa đúng định dạng (MOCK)" };
    if (emailTaken(text(body.email), exceptId)) return { status: 409, code: "EMAIL_EXISTS", message: "Email đã được dùng cho giảng viên khác (MOCK)" };
  }
  for (const [field, limit] of Object.entries(LIMITS)) {
    if (field in body && body[field] != null && String(body[field]).length > limit) return { status: 400, code: "VALIDATION_ERROR", message: `${field} tối đa ${limit} ký tự (MOCK)` };
  }
  return null;
}

function createTeacher(body) {
  const teacher = mk({ id: `gv-new-${++seq}`, email: text(body.email), fullName: text(body.fullName), createdAt: iso(nowMs()) });
  for (const field of PROFILE_FIELDS) teacher[field] = text(body[field]) || null;
  teachers.unshift(teacher);
  return deliver(teacher);
}

const jobStatus = () => (job ? { inProgress: job.status === "PROCESSING", status: job.status, jobId: job.jobId, type: job.type, message: job.message, updatedAt: job.updatedAt } : { inProgress: false, status: "IDLE", jobId: null, type: null, message: null, updatedAt: null });

function startSync() {
  const jobId = `sync-${Date.now().toString(36)}-${++seq}`;
  job = { jobId, type: "SYNC", status: "PROCESSING", message: "Đang đối soát dữ liệu với CMS (MOCK)", updatedAt: iso(nowMs()), timer: null };
  // Đồng hồ thật (không theo controls.fixedNow) để job luôn hoàn tất kể cả khi mốc thời gian bị đóng băng cho ảnh chuẩn.
  job.timer = setTimeout(() => {
    if (!job || job.jobId !== jobId) return;
    const incoming = cmsOnly(domain());
    const added = teachers.some((t) => t.id === incoming.id) ? 0 : (teachers.push(incoming), 1);
    job = { ...job, status: "DONE", message: `Đồng bộ CMS hoàn tất: ${added} giảng viên mới, ${teachers.length} bản ghi (MOCK).`, updatedAt: iso(nowMs()), timer: null };
  }, SYNC_DURATION_MS);
  return { jobId, status: "PROCESSING", message: "Đã nhận yêu cầu đồng bộ (MOCK)" };
}

// ---- multipart + CSV (không thư viện) ----
const readRaw = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

function parseMultipart(buffer, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!m) return null;
  const boundary = `--${(m[1] || m[2]).trim()}`;
  const parts = [];
  let cursor = buffer.indexOf(boundary);
  while (cursor !== -1) {
    cursor += boundary.length;
    if (buffer.subarray(cursor, cursor + 2).toString() === "--") break;
    const headerEnd = buffer.indexOf("\r\n\r\n", cursor);
    if (headerEnd === -1) break;
    const next = buffer.indexOf(boundary, headerEnd);
    if (next === -1) break;
    const headers = buffer.subarray(cursor, headerEnd).toString("utf8");
    parts.push({ name: /name="([^"]*)"/i.exec(headers)?.[1], filename: /filename="([^"]*)"/i.exec(headers)?.[1], content: buffer.subarray(headerEnd + 4, next - 2) });
    cursor = next;
  }
  return parts;
}

/** CSV theo RFC 4180 (ô có dấu nháy kép, CRLF/LF), bỏ BOM; trả mảng dòng, mỗi dòng là mảng ô. */
function parseCsv(textContent) {
  const src = textContent.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const looksBinary = (buf) => buf.subarray(0, 2).toString() === "PK" || buf.subarray(0, 512).includes(0);

/** Cột theo file mẫu: Email, Họ tên, Mô tả ngắn, Mô tả chi tiết, Phong cách, Bằng cấp, URL video, URL ảnh. */
function importCsv(buffer) {
  const rows = parseCsv(buffer.toString("utf8"));
  const items = [];
  const skippedReasons = [];
  rows.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const [email = "", fullName = "", shortDescription = "", fullDescription = "", teachingStyle = "", qualification = "", videoIntroLink = "", avatarUrl = ""] = cells.map((c) => c.trim());
    const error = validate({ email, fullName, shortDescription, fullDescription, teachingStyle, qualification }, { partial: false });
    if (error) {
      skippedReasons.push(`Dòng ${line}: ${error.message}`);
      return;
    }
    items.push(createTeacher({ email, fullName, shortDescription, fullDescription, teachingStyle, qualification, videoIntroLink, avatarUrl }));
  });
  return { createdCount: items.length, skippedCount: skippedReasons.length, skippedReasons, items };
}

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return false;
  if (!teachers.length && !job) seed(); // lần gọi đầu (server.mjs gán provider trước khi nhận request)
  const s = ctx.require(["ROLE_ADMIN"]);
  if (!s) return true;
  const sub = url.pathname.slice(PREFIX.length);
  const sendErr = (e) => send(req, res, e.status, fail(e.code, e.message));

  if (sub === "" && method === "GET") return count("teachers"), respondWithApiState(ctx, () => teachers), true;
  if (sub === "/import/status" && method === "GET") return count("teacherJobStatus"), respondWithApiState(ctx, jobStatus), true;
  if (sub === "/recently-created" && method === "GET") {
    count("teacherRecent");
    const since = nowMs() - RECENT_WINDOW_MS;
    return respondWithApiState(ctx, () => teachers.filter((t) => t.createdAt && Date.parse(t.createdAt) >= since).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))), true;
  }

  if (sub === "/sync" && method === "POST") {
    count("teacherSync");
    if (job?.status === "PROCESSING") return send(req, res, 409, fail("JOB_IN_PROGRESS", "Đang có tiến trình khác chưa hoàn tất (MOCK)")), true;
    return respondWithApiState(ctx, startSync), true;
  }

  if (sub === "" && method === "POST") {
    count("teacherCreate");
    const body = await readBody(req);
    const error = validate(body, { partial: false });
    if (error) return sendErr(error), true;
    return respondWithApiState(ctx, () => createTeacher(body)), true;
  }

  if (sub === "/import" && method === "POST") {
    count("teacherImport");
    if (job?.status === "PROCESSING") return send(req, res, 409, fail("JOB_IN_PROGRESS", "Đang có tiến trình khác chưa hoàn tất (MOCK)")), true;
    const parts = parseMultipart(await readRaw(req), req.headers["content-type"]);
    const file = parts?.find((p) => p.filename !== undefined) ?? null;
    if (!file) return send(req, res, 400, fail("VALIDATION_ERROR", "Thiếu trường `file` dạng multipart/form-data (MOCK)")), true;
    return respondWithApiState(ctx, () => {
      const result = looksBinary(file.content)
        ? { createdCount: 0, skippedCount: 1, skippedReasons: [`"${file.filename}" là file nhị phân (Excel). MOCK chỉ đọc được CSV UTF-8 — dùng "Tải file mẫu" của màn này; file .xlsx cần backend thật`], items: [] }
        : importCsv(file.content);
      job = { jobId: `import-${Date.now().toString(36)}-${++seq}`, type: "IMPORT", status: "DONE", message: `Import xong: ${result.createdCount} tạo, ${result.skippedCount} bỏ qua (MOCK)`, updatedAt: iso(nowMs()), timer: null };
      return result;
    }), true;
  }

  const m = sub.match(/^\/([^/]+)(?:\/(resend-account-email|block|activate))?$/);
  if (!m) return false;
  const teacher = findTeacher(decodeURIComponent(m[1]));
  const action = m[2];

  if (!action && method === "PUT") {
    count("teacherUpdate");
    if (!teacher) return send(req, res, 404, fail("404", "Không tìm thấy giảng viên (MOCK)")), true;
    const body = await readBody(req);
    const error = validate(body, { partial: true, exceptId: teacher.id });
    if (error) return sendErr(error), true;
    return respondWithApiState(ctx, () => {
      if ("email" in body) teacher.email = text(body.email);
      if ("fullName" in body) teacher.fullName = text(body.fullName);
      for (const field of PROFILE_FIELDS) if (field in body) teacher[field] = text(body[field]) || null;
      return teacher;
    }), true;
  }
  if (action && method === "POST") {
    if (!teacher) return send(req, res, 404, fail("404", "Không tìm thấy giảng viên (MOCK)")), true;
    if (action === "resend-account-email") return count("teacherResend"), respondWithApiState(ctx, () => deliver(teacher)), true;
    if (action === "block") {
      count("teacherBlock");
      if (teacher.status === "BLOCKED") return send(req, res, 409, fail("ALREADY_BLOCKED", "Giảng viên đã bị khoá (MOCK)")), true;
      return respondWithApiState(ctx, () => ((teacher.status = "BLOCKED"), teacher)), true;
    }
    if (action === "activate") {
      count("teacherActivate");
      if (teacher.status === "ACTIVE") return send(req, res, 409, fail("ALREADY_ACTIVE", "Giảng viên đang hoạt động (MOCK)")), true;
      return respondWithApiState(ctx, () => ((teacher.status = "ACTIVE"), teacher)), true;
    }
  }
  return false;
}
