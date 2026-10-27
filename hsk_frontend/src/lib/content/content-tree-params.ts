// Vị trí trong cây nội dung nằm trong URL (`?packageId=&folderId=&studySetId=&view=search`) để tải lại/quay lại đúng chỗ — HSK cũ giữ trong
// useState nên F5 là về cấp gói. Hàm thuần, không import React/Next.

export type ContentTreeView = "tree" | "search";
export type ContentTreeLevel = "packages" | "folders" | "studySets" | "items";

export interface ContentTreeLocation {
  packageId: string | null;
  folderId: string | null;
  studySetId: string | null;
  view: ContentTreeView;
}

export const ROOT_LOCATION: ContentTreeLocation = { packageId: null, folderId: null, studySetId: null, view: "tree" };

/** Id chấp nhận được trong URL: chữ/số/`_ . : -`, tối đa 128 ký tự, không có `/`, `?`, `\` (chống chèn đường dẫn vào URL API). */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

export function readId(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  return ID_PATTERN.test(value) ? value : null;
}

interface ParamsLike {
  get(name: string): string | null;
}

/**
 * Đọc vị trí từ query. Cấp con chỉ có nghĩa khi cấp cha hợp lệ (folderId mà không có packageId => bỏ folderId và studySetId).
 * `view=search` chỉ hợp lệ ở gốc cây (tab tìm toàn cây không có breadcrumb).
 */
export function readTreeLocation(params: ParamsLike): ContentTreeLocation {
  const packageId = readId(params.get("packageId"));
  const folderId = packageId ? readId(params.get("folderId")) : null;
  const studySetId = folderId ? readId(params.get("studySetId")) : null;
  const view: ContentTreeView = params.get("view") === "search" && !packageId ? "search" : "tree";
  return { packageId, folderId, studySetId, view };
}

export function treeLevel(location: ContentTreeLocation): ContentTreeLevel {
  if (location.studySetId) return "items";
  if (location.folderId) return "studySets";
  if (location.packageId) return "folders";
  return "packages";
}

/** Chuỗi query (có dấu `?`) hoặc "" ở gốc; chỉ ghi các cấp có giá trị, theo thứ tự cố định để URL ổn định. */
export function treeQuery(location: ContentTreeLocation): string {
  const q = new URLSearchParams();
  if (location.view === "search") q.set("view", "search");
  if (location.packageId) q.set("packageId", location.packageId);
  if (location.packageId && location.folderId) q.set("folderId", location.folderId);
  if (location.packageId && location.folderId && location.studySetId) q.set("studySetId", location.studySetId);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function treeHref(pathname: string, location: ContentTreeLocation): string {
  return `${pathname}${treeQuery(location)}`;
}

export const packageLocation = (packageId: string): ContentTreeLocation => ({ ...ROOT_LOCATION, packageId });
export const folderLocation = (packageId: string, folderId: string): ContentTreeLocation => ({ ...ROOT_LOCATION, packageId, folderId });
export const studySetLocation = (packageId: string, folderId: string, studySetId: string): ContentTreeLocation => ({ ...ROOT_LOCATION, packageId, folderId, studySetId });

/** Chỉ nhận đường dẫn NỘI BỘ của ứng dụng làm đích quay về (`/x?y`), không nhận URL tuyệt đối hay `//host`. */
export function safeReturnUrl(raw: string | null | undefined, fallback: string): string {
  const value = raw?.trim() ?? "";
  if (value.startsWith("/") && !value.startsWith("//") && !/[\s\\]/.test(value)) return value;
  return fallback;
}

/** Gắn `returnUrl` (đã mã hoá) vào một đường dẫn có hoặc chưa có query. */
export function withReturnUrl(href: string, returnUrl: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}returnUrl=${encodeURIComponent(returnUrl)}`;
}
