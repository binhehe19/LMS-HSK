// WAITING FOR BACKEND — Hàm gọi API màn Quản lý kho lưu trữ đa phương tiện (/instructor/manage-storage) theo HỢP ĐỒNG ĐỀ XUẤT, kế thừa đường dẫn
// `/storage/packages|folders|study-sets|videos` của packageService/folderService/studySetService/videoService HSK cũ, qua base
// NEXT_PUBLIC_HSK_API_BASE_PATH (lib/api/hsk-client.ts). Đây là kho RIÊNG của HSK (cây Gói → Thư mục → Bộ học → Video), KHÁC repo-storage của backend
// chung (lib/api/storage-client.ts, chỉ lưu tệp). Production để trống biến => WAITING FOR BACKEND. Máy chủ giả lập: scripts/mock/handlers/hsk-storage.mjs.
// Hợp đồng chi tiết: docs/api-requirements/hsk-storage.md.
//
// Khác bản cũ có chủ đích: tải video = `uploadFile` của storage-client (presign → PUT → confirm ở repo-storage) rồi POST /storage/videos {studySetId,
// fileId, title} — bản cũ POST multipart lên `/storage/upload`. Phụ đề karaoke (`/storage/subtitles/*`) KHÔNG chuyển. Thao tác GHI qua công tắc
// an toàn (lib/api/write-gate.ts, miền "storage"); quyền theo ticket kiểm ở component (useContentAccess("STORAGE")), backend phải kiểm lại.
"use client";

import { hskClient } from "@/lib/api/hsk-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type {
  CreateFolderRequest,
  CreatePackageRequest,
  CreateStudySetRequest,
  CreateVideoRequest,
  StorageFolder,
  StoragePackage,
  StorageStudySet,
  StorageVideo,
  StorageVideoDetails,
  UpdateFolderRequest,
  UpdatePackageRequest,
  UpdateStudySetRequest,
} from "@/types/hsk-storage";

const enc = encodeURIComponent;
const FEATURE = "storage";

/** Loại gói mà màn quản lý tải (packageService.getAll('VIDEO_COURSE') của bản cũ). */
export const STORAGE_PACKAGE_TYPE = "VIDEO_COURSE";

// ---- đọc (ADMIN, TEACHER, MENTOR) ----

export function listStoragePackages(type: string = STORAGE_PACKAGE_TYPE) {
  return hskClient.get<StoragePackage[]>(`/storage/packages?type=${enc(type)}`);
}

export function listStorageFolders(packageId: string) {
  return hskClient.get<StorageFolder[]>(`/storage/folders?packageId=${enc(packageId)}`);
}

export function listStorageStudySets(folderId: string) {
  return hskClient.get<StorageStudySet[]>(`/storage/study-sets?folderId=${enc(folderId)}`);
}

export function listStorageVideos(studySetId: string) {
  return hskClient.get<StorageVideo[]>(`/storage/videos?studySetId=${enc(studySetId)}`);
}

export function getStorageVideoDetails(videoId: string) {
  return hskClient.get<StorageVideoDetails>(`/storage/videos/${enc(videoId)}/details`);
}

// ---- thao tác GHI (write gate "storage") ----

export function createStoragePackage(body: CreatePackageRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<StoragePackage>("/storage/packages", body);
}

export function updateStoragePackage(packageId: string, body: UpdatePackageRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.put<StoragePackage>(`/storage/packages/${enc(packageId)}`, body);
}

/** Xoá gói kéo theo toàn bộ thư mục/bộ học/video bên trong (cảnh báo ở giao diện như bản cũ). */
export function deleteStoragePackage(packageId: string, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.delete<void>(`/storage/packages/${enc(packageId)}`);
}

/** Publish/Unpublish chỉ ADMIN (và Teacher-manager ở HSK cũ) — `canPublish` của useContentAccess. */
export function setStoragePackagePublished(packageId: string, published: boolean, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<StoragePackage>(`/storage/packages/${enc(packageId)}/${published ? "publish" : "unpublish"}`);
}

export function createStorageFolder(body: CreateFolderRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<StorageFolder>("/storage/folders", body);
}

export function updateStorageFolder(folderId: string, body: UpdateFolderRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.put<StorageFolder>(`/storage/folders/${enc(folderId)}`, body);
}

export function deleteStorageFolder(folderId: string, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.delete<void>(`/storage/folders/${enc(folderId)}`);
}

export function createStorageStudySet(body: CreateStudySetRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<StorageStudySet>("/storage/study-sets", body);
}

export function updateStorageStudySet(studySetId: string, body: UpdateStudySetRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.put<StorageStudySet>(`/storage/study-sets/${enc(studySetId)}`, body);
}

export function deleteStorageStudySet(studySetId: string, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.delete<void>(`/storage/study-sets/${enc(studySetId)}`);
}

/** Đăng ký video từ `fileId` đã tải lên repo-storage; kho tự xử lý (PROCESSING → COMPLETED), màn hình hỏi lại định kỳ. */
export function createStorageVideo(body: CreateVideoRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<StorageVideo>("/storage/videos", body);
}

export function deleteStorageVideo(videoId: string, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.delete<void>(`/storage/videos/${enc(videoId)}`);
}
