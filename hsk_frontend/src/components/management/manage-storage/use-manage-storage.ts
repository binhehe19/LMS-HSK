"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch, type FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { useContentAccess } from "@/hooks/use-content-access";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import {
  createStorageFolder,
  createStoragePackage,
  createStorageStudySet,
  createStorageVideo,
  deleteStorageFolder,
  deleteStoragePackage,
  deleteStorageStudySet,
  deleteStorageVideo,
  getStorageVideoDetails,
  listStorageFolders,
  listStoragePackages,
  listStorageStudySets,
  listStorageVideos,
  STORAGE_PACKAGE_TYPE,
  updateStorageFolder,
  updateStoragePackage,
  updateStorageStudySet,
  setStoragePackagePublished,
} from "@/lib/api/hsk-storage-client";
import { isStorageApiConfigured, uploadFile } from "@/lib/api/storage-client";
import { STORAGE_NOT_CONFIGURED_MESSAGE, writeErrorMessage } from "@/lib/api/write-error-message";
import { EMPTY_SELECTION, hasProcessingVideo, selectionAtLevel, type StorageItemType, type StorageLevel, type StorageSelection } from "@/lib/hsk-storage/storage-model";
import type { StorageFolder, StoragePackage, StorageStudySet, StorageVideo, StorageVideoDetails } from "@/types/hsk-storage";

/** Hỏi lại danh sách video mỗi 5 giây, tối đa 3 phút sau khi tải lên (Smart Polling của bản cũ). */
export const VIDEO_POLL_MS = 5000;
export const VIDEO_POLL_WINDOW_MS = 3 * 60 * 1000;

export interface StorageItemFormValues {
  name: string;
  description: string;
  isPrivate: boolean;
}

function asList<T>(data: unknown, what: string): T[] {
  if (!Array.isArray(data)) throw new ApiError(`Dữ liệu trả về không đúng định dạng danh sách ${what}.`, 200, "CONTRACT");
  return data as T[];
}

/**
 * Logic màn Quản lý kho lưu trữ đa phương tiện: cây Gói → Thư mục → Bộ học → Video tải theo mức đang chọn (mỗi mức một useKeyedFetch, đổi chọn =>
 * bỏ phản hồi cũ), quyền theo ticket (useContentAccess("STORAGE")) + công tắc ghi "storage", các thao tác ghi, tải video (repo-storage rồi
 * POST /storage/videos) và hỏi lại định kỳ trong lúc video đang xử lý.
 * Khác bản cũ có chủ đích: lỗi tải là trạng thái màn (bản cũ: console.error + danh sách rỗng); mọi thao tác ghi báo toast kết quả (bản cũ nhiều chỗ
 * chỉ console.error, có "TODO: Show toast"); tải video chạy trong modal có tiến độ thay vì "fire and forget".
 */
export function useManageStorage() {
  const { enabled: writeEnabled, demo } = useWriteGate("storage");
  const access = useContentAccess("STORAGE");
  const storageConfigured = isStorageApiConfigured();

  const [selection, setSelection] = useState<StorageSelection>(EMPTY_SELECTION);
  const pkgId = selection.pkg?.id ?? null;
  const folderId = selection.folder?.id ?? null;
  const studySetId = selection.studySet?.id ?? null;

  const packages = useKeyedFetch<StoragePackage[]>("storage-packages", async () => asList<StoragePackage>(await listStoragePackages(STORAGE_PACKAGE_TYPE), "gói"));
  const folders = useKeyedFetch<StorageFolder[]>(pkgId === null ? null : `storage-folders:${pkgId}`, async () => asList<StorageFolder>(await listStorageFolders(pkgId as string), "thư mục"));
  const studySets = useKeyedFetch<StorageStudySet[]>(folderId === null ? null : `storage-study-sets:${folderId}`, async () => asList<StorageStudySet>(await listStorageStudySets(folderId as string), "bộ học"));
  const videos = useKeyedFetch<StorageVideo[]>(studySetId === null ? null : `storage-videos:${studySetId}`, async () => asList<StorageVideo>(await listStorageVideos(studySetId as string), "video"));

  const videoList = videos.state.kind === "ok" ? videos.state.data : (videos.lastData ?? []);

  // ---- hỏi lại video đang xử lý (dừng khi hết hạn cửa sổ hoặc không còn video PENDING/PROCESSING) ----
  const [pollUntil, setPollUntil] = useState<number | null>(null);
  const reloadVideos = videos.reload;
  const stillProcessing = hasProcessingVideo(videoList);
  useEffect(() => {
    if (pollUntil === null || studySetId === null) return;
    const timer = window.setInterval(() => {
      if (Date.now() > pollUntil || !stillProcessing) setPollUntil(null);
      else reloadVideos();
    }, VIDEO_POLL_MS);
    return () => window.clearInterval(timer);
  }, [pollUntil, studySetId, stillProcessing, reloadVideos]);

  const select = (next: StorageSelection) => {
    setSelection(next);
    setPollUntil(null); // đổi vị trí thì dừng hỏi lại (bản cũ)
  };

  // ---- chi tiết video (modal) ----
  const [detailVideo, setDetailVideo] = useState<StorageVideo | null>(null);
  const detailVideoId = detailVideo?.id ?? null;
  const videoDetail = useKeyedFetch<StorageVideoDetails>(detailVideoId === null ? null : `storage-video:${detailVideoId}`, () => getStorageVideoDetails(detailVideoId as string));

  // ---- thao tác ghi ----
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const lock = useRef(false);

  const run = async <T,>(fallback: string, work: () => Promise<T>): Promise<T | null> => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    try {
      return await work();
    } catch (error) {
      toast.error(writeErrorMessage(error, fallback));
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const saveItem = async (type: StorageItemType, values: StorageItemFormValues, editingId: string | null): Promise<boolean> => {
    const name = values.name.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên");
      return false;
    }
    const description = values.description.trim() || undefined;
    const label = type === "PACKAGE" ? "package" : type === "FOLDER" ? "folder" : "study set";
    const result = await run(`Không thể ${editingId ? "cập nhật" : "tạo"} ${label}`, async () => {
      if (type === "PACKAGE") return editingId ? updateStoragePackage(editingId, { name, description, type: STORAGE_PACKAGE_TYPE }, demo) : createStoragePackage({ name, description, type: STORAGE_PACKAGE_TYPE }, demo);
      if (type === "FOLDER") {
        if (editingId) return updateStorageFolder(editingId, { name, description, isPrivate: values.isPrivate }, demo);
        if (!pkgId) throw new ApiError("Chưa chọn gói", 400);
        return createStorageFolder({ name, description, packageId: pkgId, isPrivate: values.isPrivate }, demo);
      }
      if (editingId) return updateStorageStudySet(editingId, { title: name, description, isPrivate: values.isPrivate }, demo);
      if (!folderId) throw new ApiError("Chưa chọn thư mục", 400);
      return createStorageStudySet({ title: name, description, folderId, isPrivate: values.isPrivate }, demo);
    });
    if (!result) return false;
    toast.success(editingId ? `Đã cập nhật ${label}` : `Đã tạo ${label}`);
    if (type === "PACKAGE") packages.reload();
    else if (type === "FOLDER") folders.reload();
    else studySets.reload();
    return true;
  };

  /** Xoá mục; nếu đang đứng trong mục bị xoá thì quay về mức cha (bản cũ). */
  const deleteItem = async (type: StorageItemType, id: string): Promise<boolean> => {
    const result = await run("Không thể xóa mục này", async () => {
      if (type === "PACKAGE") await deleteStoragePackage(id, demo);
      else if (type === "FOLDER") await deleteStorageFolder(id, demo);
      else await deleteStorageStudySet(id, demo);
      return true;
    });
    if (!result) return false;
    toast.success("Đã xóa");
    if (type === "PACKAGE") {
      packages.reload();
      if (pkgId === id) select(EMPTY_SELECTION);
    } else if (type === "FOLDER") {
      folders.reload();
      if (folderId === id) select(selectionAtLevel(selection, "folders"));
    } else {
      studySets.reload();
      if (studySetId === id) select(selectionAtLevel(selection, "study-sets"));
    }
    return true;
  };

  const setPublished = async (pkg: StoragePackage, published: boolean): Promise<boolean> => {
    const result = await run("Không thể thay đổi trạng thái publish", () => setStoragePackagePublished(pkg.id, published, demo));
    if (!result) return false;
    toast.success(published ? `Đã publish gói "${pkg.name}"` : `Đã chuyển gói "${pkg.name}" về Draft`);
    packages.reload();
    return true;
  };

  /** Tải byte lên repo-storage (có tiến độ) rồi đăng ký video vào bộ học; sau đó hỏi lại định kỳ cho tới khi hết video đang xử lý. */
  const uploadVideo = async (file: File, title: string, description: string): Promise<boolean> => {
    if (!studySetId) return false;
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      setUploadProgress(0);
      let fileId: string;
      try {
        fileId = (await uploadFile(file, setUploadProgress)).fileId;
      } catch (error) {
        toast.error(error instanceof ApiNotConfiguredError ? STORAGE_NOT_CONFIGURED_MESSAGE : writeErrorMessage(error, `Lỗi khi tải video "${title}" lên.`));
        return false;
      } finally {
        setUploadProgress(null);
      }
      try {
        await createStorageVideo({ studySetId, fileId, title: title.trim(), description: description.trim() || undefined }, demo);
      } catch (error) {
        toast.error(writeErrorMessage(error, `Lỗi khi tải video "${title}" lên.`));
        return false;
      }
      toast.success(`Video "${title}" đã tải lên thành công!`, { description: "Video đang được xử lý và mã hóa. Danh sách sẽ tự cập nhật khi hoàn tất.", duration: 6000 });
      videos.reload();
      setPollUntil(Date.now() + VIDEO_POLL_WINDOW_MS);
      return true;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const removeVideo = async (video: StorageVideo): Promise<boolean> => {
    const result = await run("Không thể xóa video", async () => {
      await deleteStorageVideo(video.id, demo);
      return true;
    });
    if (!result) return false;
    toast.success(`Đã xóa video "${video.name}"`);
    videos.reload();
    return true;
  };

  const goTo = (level: StorageLevel) => select(selectionAtLevel(selection, level));

  return {
    access,
    writeEnabled,
    storageConfigured,
    /** Thêm/Sửa/Xoá: cần quyền theo ticket VÀ công tắc ghi mở. */
    canWrite: access.canManage && writeEnabled,
    /** Publish/Unpublish gói: chỉ Admin/Teacher-manager (và công tắc ghi mở). */
    canPublish: access.canPublish && writeEnabled,
    busy,
    uploadProgress,
    selection,
    select,
    goTo,
    packages: { state: packages.state as FetchState<StoragePackage[]>, items: packages.state.kind === "ok" ? packages.state.data : (packages.lastData ?? []), reload: packages.reload },
    folders: { state: folders.state as FetchState<StorageFolder[]>, items: folders.state.kind === "ok" ? folders.state.data : (folders.lastData ?? []), reload: folders.reload },
    studySets: { state: studySets.state as FetchState<StorageStudySet[]>, items: studySets.state.kind === "ok" ? studySets.state.data : (studySets.lastData ?? []), reload: studySets.reload },
    videos: { state: videos.state as FetchState<StorageVideo[]>, items: videoList, reload: videos.reload },
    saveItem,
    deleteItem,
    setPublished,
    uploadVideo,
    removeVideo,
    detailVideo,
    detailState: videoDetail.state,
    openVideo: (video: StorageVideo) => setDetailVideo(video),
    closeVideo: () => setDetailVideo(null),
    retryVideoDetail: videoDetail.reload,
  };
}

export type ManageStorage = ReturnType<typeof useManageStorage>;
