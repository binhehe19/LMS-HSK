// Hàm thuần của màn Quản lý kho lưu trữ đa phương tiện (manage-storage.tsx + components/* cũ): đường dẫn drill-down, nhãn xoá/publish, trạng thái
// video, kiểm tra tệp video trước khi tải, tên mặc định.
import type { StorageFolder, StoragePackage, StorageStudySet, StorageVideo } from "@/types/hsk-storage";

export interface StorageSelection {
  pkg: StoragePackage | null;
  folder: StorageFolder | null;
  studySet: StorageStudySet | null;
}

export const EMPTY_SELECTION: StorageSelection = { pkg: null, folder: null, studySet: null };

export type StorageLevel = "packages" | "folders" | "study-sets" | "videos";

export function storageLevel(selection: StorageSelection): StorageLevel {
  if (selection.studySet) return "videos";
  if (selection.folder) return "study-sets";
  if (selection.pkg) return "folders";
  return "packages";
}

export interface BreadcrumbItem {
  key: string;
  label: string;
  /** Mức quay về khi bấm; `null` cho mục đang active (không bấm được). */
  target: StorageLevel | null;
}

/** "Thư viện Media / <gói> / <thư mục> / <bộ học>" — mục cuối active, các mục trước bấm để quay về mức đó. */
export function breadcrumbItems(selection: StorageSelection): BreadcrumbItem[] {
  const level = storageLevel(selection);
  const items: BreadcrumbItem[] = [{ key: "root", label: "Thư viện Media", target: level === "packages" ? null : "packages" }];
  if (selection.pkg) items.push({ key: `pkg-${selection.pkg.id}`, label: selection.pkg.name, target: level === "folders" ? null : "folders" });
  if (selection.folder) items.push({ key: `folder-${selection.folder.id}`, label: selection.folder.name, target: level === "study-sets" ? null : "study-sets" });
  if (selection.studySet) items.push({ key: `set-${selection.studySet.id}`, label: studySetLabel(selection.studySet), target: null });
  return items;
}

/** Quay về một mức = bỏ chọn các mức sâu hơn. */
export function selectionAtLevel(selection: StorageSelection, level: StorageLevel): StorageSelection {
  if (level === "packages") return EMPTY_SELECTION;
  if (level === "folders") return { pkg: selection.pkg, folder: null, studySet: null };
  if (level === "study-sets") return { pkg: selection.pkg, folder: selection.folder, studySet: null };
  return selection;
}

export type StorageItemType = "PACKAGE" | "FOLDER" | "STUDYSET";

export const STORAGE_ITEM_LABEL: Record<StorageItemType, string> = { PACKAGE: "gói", FOLDER: "thư mục", STUDYSET: "bộ học" };

export function studySetLabel(studySet: StorageStudySet): string {
  return String(studySet.name || "").trim() || "Nhóm học";
}

export function isPackagePublished(pkg: StoragePackage): boolean {
  return pkg.publishStatus === "PUBLISHED";
}

/** Nhãn huy hiệu trạng thái video: COMPLETED => "Sẵn sàng", còn lại in nguyên trạng thái (bản cũ). */
export function videoStatusLabel(status: string): string {
  return status === "COMPLETED" ? "Sẵn sàng" : status;
}

export function videoStatusColor(status: string): string {
  return status === "COMPLETED" ? "rgba(22, 163, 74, 0.9)" : "rgba(234, 179, 8, 0.9)";
}

export function episodeTag(index: number): string {
  return `Bài ${String(index + 1).padStart(2, "0")}`;
}

export function formatVideoDate(iso: string | undefined | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("vi-VN");
}

export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

/** Lỗi chọn tệp video (như VideoUploadModal cũ): phải là video/*, tối đa 1GB. */
export function validateVideoFile(file: Pick<File, "type" | "size">): string | null {
  if (!file.type.startsWith("video/")) return "Vui lòng chọn tệp video hợp lệ";
  if (file.size > MAX_VIDEO_BYTES) return "Kích thước tệp phải nhỏ hơn 1GB";
  return null;
}

export function defaultVideoTitle(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Còn video đang xử lý => màn hình tiếp tục hỏi lại (polling) sau khi tải lên. */
export function hasProcessingVideo(videos: readonly StorageVideo[]): boolean {
  return videos.some((v) => v.status === "PENDING" || v.status === "PROCESSING");
}
