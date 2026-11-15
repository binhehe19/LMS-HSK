// Hàm thuần của màn quản lý nội dung dạng cây: breadcrumb, lọc/phân trang phía client, nhãn trạng thái publish, loại gói.
import dayjs from "dayjs";
import { type ContentTreeLocation, folderLocation, packageLocation, ROOT_LOCATION, studySetLocation } from "@/lib/content/content-tree-params";
import type { ContentItemBase, ContentLabels, ContentPackage, ContentPackageTypeMeta, ContentPublishStatus } from "@/types/content";

/** Bốn loại gói của module flashcard HSK cũ (components/package-type-manager.tsx bản flashcard): nhãn, icon, màu nguyên văn. */
export const DEFAULT_PACKAGE_TYPES: ContentPackageTypeMeta[] = [
  { value: "LEARNING_PATH", label: "Lộ trình học", description: "Lộ trình học tập chi tiết với các bước cụ thể", icon: "isax isax-path-2", color: "#B10019", gradient: "linear-gradient(135deg, #B10019 0%, #7A0012 100%)" },
  { value: "LEARNING", label: "Khóa học", description: "Khóa học với nội dung video và tài liệu", icon: "isax isax-video", color: "#f093fb", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { value: "VIDEO_COURSE", label: "Khóa học video", description: "Khóa học video tập trung vào nội dung video", icon: "isax isax-play-circle", color: "#D4AF37", gradient: "linear-gradient(135deg, #D4AF37 0%, #F0CF72 100%)" },
  { value: "FREE", label: "Học miễn phí", description: "Tài nguyên học tập miễn phí", icon: "isax isax-gift", color: "#43e97b", gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
];

const UNKNOWN_TYPE = (value: string): ContentPackageTypeMeta => ({ value, label: value || "Chưa phân loại", description: "Chưa phân loại", icon: "isax isax-box", color: "#6c757d", gradient: "linear-gradient(135deg, #6c757d 0%, #adb5bd 100%)" });

/** Meta của một loại gói; loại lạ (backend trả giá trị mới) vẫn hiển thị được như bản cũ. So khớp không phân biệt hoa/thường. */
export function packageTypeMeta(types: readonly ContentPackageTypeMeta[], value: string | undefined | null): ContentPackageTypeMeta {
  const key = String(value ?? "").trim().toUpperCase();
  return types.find((t) => t.value.toUpperCase() === key) ?? UNKNOWN_TYPE(key);
}

export function isPublished(pkg: Pick<ContentPackage, "publishStatus">): boolean {
  return String(pkg.publishStatus ?? "").trim().toUpperCase() === "PUBLISHED";
}

/** Nhãn + màu trạng thái publish như getPublishStatusInfo của bản cũ (mọi giá trị khác PUBLISHED là Draft). */
export function publishStatusInfo(status: ContentPublishStatus | string | undefined): { label: "Published" | "Draft"; color: string; bg: string } {
  return isPublished({ publishStatus: status as ContentPublishStatus })
    ? { label: "Published", color: "#198754", bg: "rgba(25, 135, 84, 0.15)" }
    : { label: "Draft", color: "#dc3545", bg: "rgba(220, 53, 69, 0.15)" };
}

/** Lọc theo từ khoá (không phân biệt hoa/thường, bỏ khoảng trắng hai đầu) trên các trường do người gọi chọn; từ khoá rỗng => giữ nguyên. */
export function filterByKeyword<T>(list: readonly T[], keyword: string, pick: (item: T) => Array<string | undefined | null>): T[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return [...list];
  return list.filter((item) => pick(item).some((v) => (v ?? "").toLowerCase().includes(q)));
}

export function filterPackages(packages: readonly ContentPackage[], type: string | "ALL", keyword: string): ContentPackage[] {
  const byType = type === "ALL" ? packages : packages.filter((p) => String(p.type).toUpperCase() === type.toUpperCase());
  return filterByKeyword(byType, keyword, (p) => [p.name, p.description]);
}

/** Các nguồn giáo trình có trong danh sách gói (theo thứ tự gặp), kèm số gói; rỗng khi gói không mang thông tin giáo trình. */
export function packageSyllabusOptions(packages: readonly ContentPackage[]): { id: string; name: string; count: number }[] {
  const options = new Map<string, { id: string; name: string; count: number }>();
  for (const p of packages) {
    if (!p.syllabusId) continue;
    const found = options.get(p.syllabusId);
    if (found) found.count += 1;
    else options.set(p.syllabusId, { id: p.syllabusId, name: p.syllabusName ?? p.syllabusId, count: 1 });
  }
  return [...options.values()];
}

export function countPackagesByType(packages: readonly ContentPackage[], type: string): number {
  return packages.filter((p) => String(p.type).toUpperCase() === type.toUpperCase()).length;
}

/** Trang hợp lệ (1-based) cho danh sách `total` phần tử: về 1 khi vô nghĩa, kẹp về trang cuối khi vượt. */
export function clampPage(page: number, total: number, pageSize: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  const last = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.floor(page), last);
}

export function paginate<T>(list: readonly T[], page: number, pageSize: number): T[] {
  const p = clampPage(page, list.length, pageSize);
  return list.slice((p - 1) * pageSize, p * pageSize);
}

/** Ngày dd/MM/yyyy; thiếu/không hợp lệ => "N/A" (formatDate của HSK cũ). Nhận cả epoch giây dạng chuỗi của backend gói cũ. */
export function formatContentDate(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "N/A";
  const asNumber = typeof value === "number" ? value : /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : NaN;
  const d = Number.isFinite(asNumber) ? dayjs(asNumber < 1e12 ? asNumber * 1000 : asNumber) : dayjs(value);
  return d.isValid() ? d.format("DD/MM/YYYY") : "N/A";
}

export function sortByIndex<T extends ContentItemBase>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export interface BreadcrumbCrumb {
  key: string;
  label: string;
  icon: string;
  location: ContentTreeLocation;
  active: boolean;
}

export interface BreadcrumbNames {
  packageName?: string;
  folderName?: string;
  studySetTitle?: string;
}

/**
 * Breadcrumb "Packages › gói › thư mục › bộ" như bản cũ; cấp cuối là active (không bấm). Tên chưa tải xong hiện "…" để DOM ổn định.
 * Chỉ hiện các cấp có trong vị trí hiện tại.
 */
export function buildBreadcrumb(labels: ContentLabels, location: ContentTreeLocation, names: BreadcrumbNames): BreadcrumbCrumb[] {
  const crumbs: BreadcrumbCrumb[] = [{ key: "root", label: `${labels.package}s`, icon: "isax-cards", location: ROOT_LOCATION, active: !location.packageId }];
  if (location.packageId) {
    crumbs.push({ key: "package", label: names.packageName ?? "…", icon: "isax-box-1", location: packageLocation(location.packageId), active: !location.folderId });
  }
  if (location.packageId && location.folderId) {
    crumbs.push({ key: "folder", label: names.folderName ?? "…", icon: "isax-folder-2", location: folderLocation(location.packageId, location.folderId), active: !location.studySetId });
  }
  if (location.packageId && location.folderId && location.studySetId) {
    crumbs.push({ key: "studySet", label: names.studySetTitle ?? "…", icon: "isax-document-text-1", location: studySetLocation(location.packageId, location.folderId, location.studySetId), active: true });
  }
  return crumbs;
}
