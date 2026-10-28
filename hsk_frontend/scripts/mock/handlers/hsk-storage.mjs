// Kho đa phương tiện RIÊNG của HSK GIẢ LẬP (/api/hsk/storage/*) theo HỢP ĐỒNG ĐỀ XUẤT kế thừa packageService/folderService/studySetService/videoService
// HSK cũ: cây Gói → Thư mục → Bộ học → Video. KHÁC repo-storage của backend chung (handlers/storage.mjs): byte video nằm ở repo-storage, kho này chỉ
// giữ fileId (POST /videos {studySetId, fileId, title}). Quyền như hợp đồng: đọc = ADMIN/TEACHER/MENTOR (+TEACHER_MANAGER/COLLABORATOR như HSK cũ);
// ghi = ADMIN/TEACHER_MANAGER hoặc giảng viên có ticket STORAGE OPEN/DONE được giao cho mình (state.data.ticketsFor); publish/unpublish = ADMIN/TEACHER_MANAGER.
// Phụ đề karaoke (/storage/subtitles/*) không mô phỏng (404). Video mới ở PROCESSING ~20 giây rồi COMPLETED để màn hình thấy polling đổi trạng thái.
import { count, fail, ok, readBody, registerResettable, send, sendError, state } from "../core.mjs";
import { getStoredFile, registerSeedFile } from "./storage.mjs";

const READ_ROLES = ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_MENTOR", "ROLE_TEACHER_MANAGER", "ROLE_COLLABORATOR"];
const ALWAYS_WRITE = ["ROLE_ADMIN", "ROLE_TEACHER_MANAGER"];
const PROCESSING_MS = 20_000;

let db = null;
registerResettable(() => {
  db = null;
});

const ts = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

function makeSeed(spec) {
  const packages = [];
  const folders = [];
  const studySets = [];
  const videos = [];
  let v = 0;
  for (const p of spec) {
    packages.push({ id: p.id, name: p.name, description: p.description, type: "VIDEO_COURSE", publishStatus: p.publishStatus, createdAt: ts(p.days), updatedAt: ts(p.days - 1) });
    p.folders.forEach((f, fi) => {
      const folderId = `${p.id}-f${fi + 1}`;
      folders.push({ id: folderId, name: f.name, description: f.description, packageId: p.id, isPrivate: Boolean(f.isPrivate), createdAt: ts(p.days - 1), updatedAt: ts(p.days - 1) });
      f.sets.forEach((set, si) => {
        const setId = `${folderId}-s${si + 1}`;
        studySets.push({ id: setId, name: set.name, description: set.description, folderId, isPrivate: Boolean(set.isPrivate), videoCount: set.videos.length, createdAt: ts(p.days - 2), updatedAt: ts(p.days - 2) });
        set.videos.forEach((name, vi) => {
          v += 1;
          const id = `vid-${String(v).padStart(3, "0")}`;
          const sizeBytes = (38 + ((v * 7) % 40)) * 1024 * 1024;
          const fileId = registerSeedFile({ fileId: `file-${id}`, filename: `${id}.mp4`, mimeType: "video/mp4", sizeBytes });
          const processing = p.processingLast && vi === set.videos.length - 1 && si === f.sets.length - 1;
          videos.push({ id, code: `VC${String(v).padStart(4, "0")}`, name, description: `Video bài giảng: ${name}`, fileId, size: sizeBytes, mimetype: "video/mp4", duration: 540 + ((v * 97) % 900), status: processing ? "PROCESSING" : "COMPLETED", processingUntil: processing ? Date.now() + 90_000 : null, studySetId: setId, thumbnailUrl: "", createdAt: ts(p.days - 3 + vi), updatedAt: ts(p.days - 3 + vi) });
        });
      });
    });
  }
  return { packages, folders, studySets, videos, seq: { pkg: packages.length, folder: folders.length, set: studySets.length, video: v } };
}

const seedDemo = () =>
  makeSeed([
    {
      id: "pk-hsk3", name: "Video bài giảng HSK 3", description: "Bản ghi bài giảng và video bổ trợ cho khoá H30.", publishStatus: "PUBLISHED", days: 70,
      folders: [
        { name: "Bài 1–5", description: "Nửa đầu khoá học", sets: [{ name: "Bài 1: Chào hỏi và giới thiệu", description: "Ngữ âm, chào hỏi", videos: ["Giới thiệu khoá HSK 3", "Thanh điệu và phát âm cơ bản", "Hội thoại: Chào hỏi"] }, { name: "Bài 2: Gia đình", description: "", videos: ["Từ vựng gia đình", "Hội thoại: Giới thiệu gia đình"] }] },
        { name: "Bài 6–10", description: "Nửa sau khoá học", sets: [{ name: "Bài 6: Mua sắm", description: "", videos: ["Hỏi giá và mặc cả"] }, { name: "Ôn tập cuối khoá", description: "Tổng hợp", isPrivate: true, videos: ["Ôn tập ngữ pháp HSK 3", "Đề luyện nghe số 1"] }] },
      ],
    },
    {
      id: "pk-hsk4", name: "Video bài giảng HSK 4", description: "Video cho khoá H40 (đang bổ sung).", publishStatus: "PUBLISHED", days: 40, processingLast: true,
      folders: [{ name: "Bài 1–5", description: "", sets: [{ name: "Bài 1: 爱的细节", description: "", videos: ["Đọc hiểu bài 1", "Ngữ pháp: 把字句"] }, { name: "Bài 3: 人生有选择", description: "", videos: ["Phân tích bài đọc", "Luyện nghe hội thoại dài"] }] }],
    },
    {
      id: "pk-gt", name: "Giao tiếp — video tình huống", description: "Tình huống giao tiếp GT1/GT2, chưa công khai.", publishStatus: "DRAFT", days: 12,
      folders: [{ name: "Tình huống cơ bản", description: "", isPrivate: true, sets: [{ name: "Ở nhà hàng", description: "", videos: ["Gọi món và thanh toán"] }] }],
    },
  ]);

const seedE2e = () =>
  makeSeed([
    { id: "mock-pk-1", name: "Gói giả lập 1", description: "Gói video giả lập (DỮ LIỆU GIẢ)", publishStatus: "DRAFT", days: 30, folders: [{ name: "Thư mục giả lập 1", description: "", sets: [{ name: "Bộ học giả lập 1", description: "", videos: ["Video giả lập 1", "Video giả lập 2"] }] }] },
  ]);

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

/** Quyền ghi theo ticket như use-ticket-access của HSK cũ: ADMIN/TEACHER_MANAGER luôn; vai trò khác cần ticket STORAGE OPEN/DONE giao cho chính mình. */
const canWrite = (s) => {
  if (s.roles.some((r) => ALWAYS_WRITE.includes(r))) return true;
  const me = state.data.me(s);
  return (state.data.ticketsFor(me.id) ?? []).some((t) => t.module === "STORAGE" && (t.status === "OPEN" || t.status === "DONE") && String(t.assignedId) === String(me.id));
};
const canPublish = (s) => s.roles.some((r) => ALWAYS_WRITE.includes(r));

const forbid = (ctx, message) => send(ctx.req, ctx.res, 403, fail("FORBIDDEN", `${message} (MOCK)`));
const notFound = (ctx, what) => send(ctx.req, ctx.res, 404, fail("404", `Không tìm thấy ${what} (MOCK)`));
const invalid = (ctx, message) => send(ctx.req, ctx.res, 400, fail("VALIDATION_ERROR", `${message} (MOCK)`));
const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Trạng thái video suy theo thời gian: PROCESSING hết hạn => COMPLETED (dữ liệu đổi giữa hai lần hỏi). */
const snapshot = (video) => {
  if (video.status === "PROCESSING" && video.processingUntil && Date.now() >= video.processingUntil) {
    video.status = "COMPLETED";
    video.processingUntil = null;
    video.updatedAt = new Date().toISOString();
  }
  const { processingUntil, ...pub } = video;
  void processingUntil;
  return pub;
};

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (!url.pathname.startsWith("/api/hsk/storage/")) return false;
  const sub = url.pathname.slice("/api/hsk/storage".length);
  const q = url.searchParams;
  const s = ctx.require(READ_ROLES);
  if (!s) return true;
  const d = ensure();
  const now = () => new Date().toISOString();

  // ---- gói ----
  if (sub === "/packages" && method === "GET") {
    count("storagePackages");
    const type = q.get("type");
    return withApiState(ctx, () => d.packages.filter((p) => !type || p.type === type)), true;
  }
  if (sub === "/packages" && method === "POST") {
    count("storagePackageCreate");
    if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để tạo gói"), true;
    const body = (await readBody(req)) ?? {};
    if (!text(body.name)) return invalid(ctx, "Tên gói là bắt buộc"), true;
    const pkg = { id: `pk-new-${++d.seq.pkg}`, name: text(body.name), description: text(body.description), type: text(body.type) || "VIDEO_COURSE", publishStatus: "DRAFT", createdAt: now(), updatedAt: now() };
    d.packages.push(pkg);
    return send(req, res, 201, ok(pkg)), true;
  }
  const pkgMatch = sub.match(/^\/packages\/([^/]+)(\/(publish|unpublish))?$/);
  if (pkgMatch) {
    const pkg = d.packages.find((p) => p.id === decodeURIComponent(pkgMatch[1]));
    if (!pkg) return notFound(ctx, "gói"), true;
    if (pkgMatch[3] && method === "POST") {
      count("storagePackagePublish");
      if (!canPublish(s)) return forbid(ctx, "Chỉ Admin/Teacher-manager được publish"), true;
      pkg.publishStatus = pkgMatch[3] === "publish" ? "PUBLISHED" : "DRAFT";
      pkg.updatedAt = now();
      return send(req, res, 200, ok(pkg)), true;
    }
    if (!pkgMatch[2] && method === "PUT") {
      count("storagePackageUpdate");
      if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để sửa gói"), true;
      const body = (await readBody(req)) ?? {};
      if (body.name !== undefined && !text(body.name)) return invalid(ctx, "Tên gói không hợp lệ"), true;
      if (body.name !== undefined) pkg.name = text(body.name);
      if (body.description !== undefined) pkg.description = text(body.description);
      if (text(body.type)) pkg.type = text(body.type);
      pkg.updatedAt = now();
      return send(req, res, 200, ok(pkg)), true;
    }
    if (!pkgMatch[2] && method === "DELETE") {
      count("storagePackageDelete");
      if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để xoá gói"), true;
      const folderIds = d.folders.filter((f) => f.packageId === pkg.id).map((f) => f.id);
      const setIds = d.studySets.filter((x) => folderIds.includes(x.folderId)).map((x) => x.id);
      d.videos = d.videos.filter((v) => !setIds.includes(v.studySetId));
      d.studySets = d.studySets.filter((x) => !setIds.includes(x.id));
      d.folders = d.folders.filter((f) => !folderIds.includes(f.id));
      d.packages = d.packages.filter((p) => p !== pkg);
      return send(req, res, 200, ok(null)), true;
    }
    return false;
  }

  // ---- thư mục ----
  if (sub === "/folders" && method === "GET") {
    count("storageFolders");
    const packageId = q.get("packageId");
    if (!packageId) return invalid(ctx, "packageId là bắt buộc"), true;
    if (!d.packages.some((p) => p.id === packageId)) return notFound(ctx, "gói"), true;
    return withApiState(ctx, () => d.folders.filter((f) => f.packageId === packageId)), true;
  }
  if (sub === "/folders" && method === "POST") {
    count("storageFolderCreate");
    if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để tạo thư mục"), true;
    const body = (await readBody(req)) ?? {};
    if (!text(body.name)) return invalid(ctx, "Tên thư mục là bắt buộc"), true;
    if (!d.packages.some((p) => p.id === body.packageId)) return notFound(ctx, "gói"), true;
    const folder = { id: `${body.packageId}-f-new-${++d.seq.folder}`, name: text(body.name), description: text(body.description), packageId: body.packageId, isPrivate: Boolean(body.isPrivate), createdAt: now(), updatedAt: now() };
    d.folders.push(folder);
    return send(req, res, 201, ok(folder)), true;
  }
  const folderMatch = sub.match(/^\/folders\/([^/]+)$/);
  if (folderMatch) {
    const folder = d.folders.find((f) => f.id === decodeURIComponent(folderMatch[1]));
    if (!folder) return notFound(ctx, "thư mục"), true;
    if (method === "PUT") {
      count("storageFolderUpdate");
      if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để sửa thư mục"), true;
      const body = (await readBody(req)) ?? {};
      if (body.name !== undefined && !text(body.name)) return invalid(ctx, "Tên thư mục không hợp lệ"), true;
      if (body.name !== undefined) folder.name = text(body.name);
      if (body.description !== undefined) folder.description = text(body.description);
      if (body.isPrivate !== undefined) folder.isPrivate = Boolean(body.isPrivate);
      folder.updatedAt = now();
      return send(req, res, 200, ok(folder)), true;
    }
    if (method === "DELETE") {
      count("storageFolderDelete");
      if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để xoá thư mục"), true;
      const setIds = d.studySets.filter((x) => x.folderId === folder.id).map((x) => x.id);
      d.videos = d.videos.filter((v) => !setIds.includes(v.studySetId));
      d.studySets = d.studySets.filter((x) => !setIds.includes(x.id));
      d.folders = d.folders.filter((f) => f !== folder);
      return send(req, res, 200, ok(null)), true;
    }
    return false;
  }

  // ---- bộ học ----
  if (sub === "/study-sets" && method === "GET") {
    count("storageStudySets");
    const folderId = q.get("folderId");
    if (!folderId) return invalid(ctx, "folderId là bắt buộc"), true;
    if (!d.folders.some((f) => f.id === folderId)) return notFound(ctx, "thư mục"), true;
    return withApiState(ctx, () => d.studySets.filter((x) => x.folderId === folderId).map((x) => ({ ...x, videoCount: d.videos.filter((v) => v.studySetId === x.id).length }))), true;
  }
  if (sub === "/study-sets" && method === "POST") {
    count("storageStudySetCreate");
    if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để tạo bộ học"), true;
    const body = (await readBody(req)) ?? {};
    if (!text(body.title)) return invalid(ctx, "Tiêu đề bộ học là bắt buộc"), true;
    if (!d.folders.some((f) => f.id === body.folderId)) return notFound(ctx, "thư mục"), true;
    const set = { id: `${body.folderId}-s-new-${++d.seq.set}`, name: text(body.title), description: text(body.description), folderId: body.folderId, isPrivate: Boolean(body.isPrivate), videoCount: 0, createdAt: now(), updatedAt: now() };
    d.studySets.push(set);
    return send(req, res, 201, ok(set)), true;
  }
  const setMatch = sub.match(/^\/study-sets\/([^/]+)$/);
  if (setMatch) {
    const set = d.studySets.find((x) => x.id === decodeURIComponent(setMatch[1]));
    if (!set) return notFound(ctx, "bộ học"), true;
    if (method === "PUT") {
      count("storageStudySetUpdate");
      if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để sửa bộ học"), true;
      const body = (await readBody(req)) ?? {};
      if (body.title !== undefined && !text(body.title)) return invalid(ctx, "Tiêu đề bộ học không hợp lệ"), true;
      if (body.title !== undefined) set.name = text(body.title);
      if (body.description !== undefined) set.description = text(body.description);
      if (body.isPrivate !== undefined) set.isPrivate = Boolean(body.isPrivate);
      set.updatedAt = now();
      return send(req, res, 200, ok(set)), true;
    }
    if (method === "DELETE") {
      count("storageStudySetDelete");
      if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để xoá bộ học"), true;
      d.videos = d.videos.filter((v) => v.studySetId !== set.id);
      d.studySets = d.studySets.filter((x) => x !== set);
      return send(req, res, 200, ok(null)), true;
    }
    return false;
  }

  // ---- video ----
  if (sub === "/videos" && method === "GET") {
    count("storageVideos");
    const studySetId = q.get("studySetId");
    if (!studySetId) return invalid(ctx, "studySetId là bắt buộc"), true;
    if (!d.studySets.some((x) => x.id === studySetId)) return notFound(ctx, "bộ học"), true;
    return withApiState(ctx, () => d.videos.filter((v) => v.studySetId === studySetId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).map(snapshot)), true;
  }
  if (sub === "/videos" && method === "POST") {
    count("storageVideoCreate");
    if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để tải video"), true;
    const body = (await readBody(req)) ?? {};
    if (!text(body.title)) return invalid(ctx, "Tên video là bắt buộc"), true;
    if (!d.studySets.some((x) => x.id === body.studySetId)) return notFound(ctx, "bộ học"), true;
    const file = getStoredFile(body.fileId);
    if (!file) return send(req, res, 400, fail("FILE_NOT_FOUND", "fileId không tồn tại trong kho lưu trữ hoặc chưa tải xong (MOCK)")), true;
    const n = ++d.seq.video;
    const video = { id: `vid-new-${n}`, code: `VCN${String(n).padStart(4, "0")}`, name: text(body.title), description: text(body.description), fileId: file.fileId, size: file.sizeBytes, mimetype: file.mimeType, duration: undefined, status: "PROCESSING", processingUntil: Date.now() + PROCESSING_MS, studySetId: body.studySetId, thumbnailUrl: "", createdAt: now(), updatedAt: now() };
    d.videos.push(video);
    return send(req, res, 201, ok(snapshot(video))), true;
  }
  const videoMatch = sub.match(/^\/videos\/([^/]+)(\/details)?$/);
  if (videoMatch) {
    const video = d.videos.find((v) => v.id === decodeURIComponent(videoMatch[1]));
    if (!video) return notFound(ctx, "video"), true;
    if (videoMatch[2] && method === "GET") return count("storageVideoDetails"), withApiState(ctx, () => ({ ...snapshot(video), subtitles: [] })), true;
    if (!videoMatch[2] && method === "DELETE") {
      count("storageVideoDelete");
      if (!canWrite(s)) return forbid(ctx, "Không có ticket STORAGE để xoá video"), true;
      d.videos = d.videos.filter((v) => v !== video);
      return send(req, res, 200, ok(null)), true;
    }
    return false;
  }

  return false;
}
