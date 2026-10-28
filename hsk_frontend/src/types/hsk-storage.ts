// DTO kho đa phương tiện RIÊNG của HSK (`/storage/packages|folders|study-sets|videos`, core/types/storage.type.ts) theo HỢP ĐỒNG ĐỀ XUẤT.
// KHÁC repo-storage của backend chung (`/api/storage/file/*`, chỉ lưu byte): kho này là cây Gói → Thư mục → Bộ học → Video; byte của video
// được tải lên repo-storage bằng storage-client rồi gửi `fileId` cho kho (docs/api-requirements/hsk-storage.md). Phụ đề karaoke không chuyển.

export type PackagePublishStatus = "DRAFT" | "PUBLISHED";

export interface StoragePackage {
  id: string;
  name: string;
  description?: string;
  /** vd "VIDEO_COURSE" (màn quản lý chỉ tải loại này như bản cũ). */
  type: string;
  publishStatus?: PackagePublishStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePackageRequest {
  name: string;
  description?: string;
  type: string;
}

export interface UpdatePackageRequest {
  name?: string;
  description?: string;
  type?: string;
}

export interface StorageFolder {
  id: string;
  name: string;
  description?: string;
  packageId: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderRequest {
  name: string;
  description?: string;
  packageId: string;
  isPrivate: boolean;
}

export interface UpdateFolderRequest {
  name: string;
  description?: string;
  isPrivate?: boolean;
}

export interface StorageStudySet {
  id: string;
  name: string;
  description?: string;
  folderId: string;
  isPrivate: boolean;
  videoCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** Bản cũ: bộ học tạo bằng `title` nhưng đọc về là `name` — giữ nguyên để backend đối chiếu. */
export interface CreateStudySetRequest {
  title: string;
  description?: string;
  folderId: string;
  isPrivate: boolean;
}

export interface UpdateStudySetRequest {
  title: string;
  description?: string;
  isPrivate?: boolean;
}

export type VideoStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface StorageVideo {
  id: string;
  code: string;
  name: string;
  description?: string;
  /** Mã tệp ở repo-storage (hợp đồng đề xuất; bản cũ tải byte thẳng qua POST /storage/upload). */
  fileId?: string;
  size?: number;
  mimetype?: string;
  duration?: number;
  status: VideoStatus | string;
  studySetId: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageVideoDetails extends StorageVideo {
  /** Phụ đề karaoke (HSK cũ) — chỉ hiển thị số lượng, màn hình mới không quản lý phụ đề. */
  subtitles?: { id: string; name: string; status: string }[];
}

export interface CreateVideoRequest {
  studySetId: string;
  fileId: string;
  title: string;
  description?: string;
}
