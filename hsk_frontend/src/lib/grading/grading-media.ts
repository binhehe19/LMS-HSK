// URL phát/xem tệp (audio, ảnh) trong màn chấm bài. HSK cũ (core/utils/media.ts getMediaUrl) luôn bịa đường dẫn "/api/storage/files/{id}" dù không
// có dịch vụ; ở đây: chỉ tạo URL khi repo-storage của backend chung đã cấu hình (NEXT_PUBLIC_STORAGE_API_BASE_PATH, hợp đồng GET /file/{id} — xem
// lib/api/storage-client.ts), ngược lại null để giao diện hiện "Không có tệp". URL tuyệt đối/đường dẫn gốc do backend trả được giữ nguyên.

export function mediaUrl(idOrUrl: string | null | undefined): string | null {
  const value = (idOrUrl ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  const base = process.env.NEXT_PUBLIC_STORAGE_API_BASE_PATH?.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/file/${encodeURIComponent(value)}?disposition=inline`;
}

/** Bản cũ phân biệt ảnh/âm thanh của `questionMediaUrl` bằng phần mở rộng; không có phần mở rộng ảnh => coi là audio. */
export const isImageMedia = (idOrUrl: string): boolean => /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(idOrUrl);
