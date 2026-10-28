// repo-storage của backend chung GIẢ LẬP (/api/storage/*, Go/Echo, JSON TRẦN không bọc {success,data}) theo hợp đồng mà lib/api/storage-client.ts đã viết:
//   POST /file/presign {filename, mimeType, sizeBytes} → {fileId, presignedUrl, expiresIn}; PUT <presignedUrl> (byte thô, KHÔNG cần Authorization — URL ký sẵn);
//   POST /file/{id}/confirm → FileMeta; GET /file/{id}?disposition=inline|attachment → nội dung giả (SVG cho ảnh, văn bản cho loại khác).
// Kho tệp trong bộ nhớ dùng chung cho các miền cần tải tệp (tài liệu học tập, kho video): handler khác đăng ký tệp seed qua registerSeedFile và kiểm tra
// fileId qua getStoredFile. Không ghi đĩa; byte tải lên chỉ được đếm kích thước.
import { randomUUID } from "node:crypto";
import { count, fail, HOST, PORT, readBody, registerResettable, send, state } from "../core.mjs";

/** fileId → { fileId, filename, mimeType, sizeBytes, uploaded, createdAt } */
let files = new Map();
registerResettable(() => {
  files = new Map();
});

/** Handler miền khác gọi khi seed để GET /file/{id} trả được nội dung cho dữ liệu mẫu. Trả về fileId. */
export function registerSeedFile(meta) {
  files.set(meta.fileId, { uploaded: true, createdAt: new Date().toISOString(), ...meta });
  return meta.fileId;
}

/** Metadata tệp đã confirm (hoặc seed); null nếu không có / chưa tải xong — handler nghiệp vụ dùng để kiểm tra fileId trong body. */
export function getStoredFile(fileId) {
  const f = files.get(String(fileId ?? ""));
  return f && f.uploaded ? f : null;
}

const meta = (f) => ({ fileId: f.fileId, filename: f.filename, mimeType: f.mimeType, sizeBytes: f.sizeBytes });

/** Ảnh SVG nhỏ ghi tên tệp (không cần file thật). */
const svgFor = (f) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" rx="16" fill="#fde8ea"/><text x="160" y="92" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700" fill="#b10019" text-anchor="middle">MOCK · ${escapeXml(f.filename || f.fileId)}</text><text x="160" y="120" font-family="Inter, Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">${escapeXml(f.mimeType || "")} · ${f.sizeBytes || 0} bytes</text></svg>`;

const escapeXml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

/** Đọc hết body nhị phân của PUT và trả về số byte (không giữ nội dung). */
const drainBody = (req) =>
  new Promise((resolve) => {
    let size = 0;
    req.on("data", (chunk) => (size += chunk.length));
    req.on("end", () => resolve(size));
    req.on("error", () => resolve(size));
  });

export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (!url.pathname.startsWith("/api/storage/")) return false;
  const sub = url.pathname.slice("/api/storage".length);

  // URL ký sẵn: trình duyệt PUT thẳng byte, không gửi cookie/Authorization (storage-client dùng XMLHttpRequest không credentials).
  const upload = sub.match(/^\/__upload\/([^/]+)$/);
  if (upload && method === "PUT") {
    count("storageUpload");
    const f = files.get(decodeURIComponent(upload[1]));
    if (!f) return send(req, res, 404, { message: "URL tải lên không hợp lệ hoặc đã hết hạn (MOCK)" }), true;
    const size = await drainBody(req);
    f.uploaded = true;
    f.sizeBytes = size || f.sizeBytes;
    if (req.headers["content-type"]) f.mimeType = f.mimeType || req.headers["content-type"];
    return send(req, res, 200, undefined), true;
  }

  const s = ctx.session();
  if (!s) return send(req, res, 401, { message: "Chưa đăng nhập (MOCK)" }), true;

  if (sub === "/file/presign" && method === "POST") {
    count("storagePresign");
    const body = await readBody(req);
    if (!body || typeof body.filename !== "string" || !body.filename.trim()) return send(req, res, 400, { message: "filename là bắt buộc (MOCK)" }), true;
    const fileId = randomUUID().replace(/-/g, "");
    files.set(fileId, { fileId, filename: body.filename.trim(), mimeType: typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "application/octet-stream", sizeBytes: Number(body.sizeBytes) || 0, uploaded: false, createdAt: new Date().toISOString() });
    return send(req, res, 200, { fileId, presignedUrl: `http://${HOST}:${PORT}/api/storage/__upload/${fileId}`, expiresIn: 900 }), true;
  }

  const confirm = sub.match(/^\/file\/([^/]+)\/confirm$/);
  if (confirm && method === "POST") {
    count("storageConfirm");
    const f = files.get(decodeURIComponent(confirm[1]));
    if (!f) return send(req, res, 404, { message: "Không tìm thấy tệp (MOCK)" }), true;
    if (!f.uploaded) return send(req, res, 409, { message: "Tệp chưa được tải lên (MOCK)" }), true;
    return send(req, res, 200, meta(f)), true;
  }

  const get = sub.match(/^\/file\/([^/]+)$/);
  if (get && method === "GET") {
    count("storageGetFile");
    const f = files.get(decodeURIComponent(get[1]));
    if (!f || !f.uploaded) return send(req, res, 404, { message: "Không tìm thấy tệp (MOCK)" }), true;
    const attachment = url.searchParams.get("disposition") === "attachment";
    const disposition = `${attachment ? "attachment" : "inline"}; filename="${encodeURIComponent(f.filename || f.fileId)}"`;
    const image = String(f.mimeType || "").startsWith("image/");
    const body = image ? svgFor(f) : `MOCK — nội dung giả của tệp "${f.filename}" (${f.mimeType}, ${f.sizeBytes} bytes). Máy chủ giả lập không lưu byte thật.`;
    res.writeHead(200, { "content-type": image ? "image/svg+xml" : "text/plain; charset=utf-8", "content-disposition": disposition, "cache-control": "no-store" });
    res.end(body);
    return true;
  }

  return send(req, res, 404, fail("404", `MOCK: không có endpoint ${method} ${url.pathname}`)), true;
}

/** Trạng thái để /mock-state hoặc test đọc (không thuộc hợp đồng). */
export const storedFileCount = () => files.size;

/** Dùng cho hồ sơ seed của handler khác: profile hiện tại ("demo" | "e2e"). */
export const currentProfile = () => state.data?.profile ?? "e2e";
