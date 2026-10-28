"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useKeyedFetch, type FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { useContentAccess } from "@/hooks/use-content-access";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError } from "@/lib/api/api-client";
import {
  createFolder,
  createItem,
  createPackage,
  createStudySet,
  deleteFolder,
  deleteItem,
  deletePackage,
  deleteStudySet,
  listFolders,
  listItems,
  listPackages,
  listStudySets,
  publishPackage,
  unpublishPackage,
  updateFolder,
  updateItem,
  updatePackage,
  updateStudySet,
  type ContentApiTarget,
} from "@/lib/api/content-tree-client";
import { isPublished, sortByIndex } from "@/lib/content/content-tree-model";
import { type ContentTreeLocation, folderLocation, packageLocation, readTreeLocation, ROOT_LOCATION, treeHref, treeLevel } from "@/lib/content/content-tree-params";
import { normalizeFolderInput, normalizePackageInput, normalizeStudySetInput, validateFolderInput, validatePackageInput, validateStudySetInput, writeErrorMessage } from "@/lib/content/content-tree-validate";
import type { ContentFolder, ContentFolderInput, ContentItemBase, ContentItemInput, ContentModuleConfig, ContentPackage, ContentPackageInput, ContentStudySet, ContentStudySetInput } from "@/types/content";

/** Phản hồi không phải mảng là lỗi hợp đồng hiển thị được (bản cũ im lặng coi là rỗng). */
async function expectList<T>(promise: Promise<T[]>, what: string): Promise<T[]> {
  const data = await promise;
  if (!Array.isArray(data)) throw new ApiError(`Dữ liệu trả về không đúng định dạng danh sách ${what}.`, 200, "CONTRACT");
  return data;
}

interface ContentTreeList<T> {
  state: FetchState<T[]>;
  /** Dữ liệu của ĐÚNG khoá hiện tại (không dùng dữ liệu cấp cha/anh em cũ để không lẫn giữa các gói/thư mục). */
  list: T[];
  reload: () => void;
}

/**
 * Logic màn quản lý nội dung dạng cây (ManageFlashcard/ManageVocabularySet/manage-*.tsx của HSK cũ, viết một lần theo config):
 * vị trí trong URL, tải 4 cấp theo khoá, quyền theo ticket + công tắc ghi, và các thao tác ghi.
 *
 * Khác bản cũ có chủ đích: (1) vị trí cây nằm trong URL (reload/back đúng chỗ); (2) lỗi tải là trạng thái của cấp đó, không phải danh sách rỗng;
 * (3) sau mỗi thao tác ghi tải lại từ máy chủ (máy chủ là nguồn sự thật) thay vì vá bộ nhớ; (4) thao tác ghi qua write gate: nút ẩn khi đóng, client vẫn
 * tự chặn (không có "thành công giả"); (5) chống bấm đúp bằng khoá đồng bộ.
 */
export function useContentTree<TItem extends ContentItemBase>(config: ContentModuleConfig<TItem>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const location = useMemo(() => readTreeLocation(params), [params]);
  const level = treeLevel(location);
  const access = useContentAccess(config.module);
  const { enabled: writeEnabled, demo } = useWriteGate("content");
  const canWrite = access.canManage && writeEnabled;
  const canPublish = access.canPublish && writeEnabled;
  const { labels } = config;
  const target: ContentApiTarget = useMemo(() => ({ apiPrefix: config.apiPrefix, itemsPath: config.itemsPath }), [config.apiPrefix, config.itemsPath]);

  const { packageId, folderId, studySetId } = location;
  const packages = useKeyedFetch<ContentPackage[]>(`${config.key}:packages`, () => expectList(listPackages(target), labels.package.toLowerCase()));
  const folders = useKeyedFetch<ContentFolder[]>(packageId ? `${config.key}:folders:${packageId}` : null, () => expectList(listFolders(target, packageId ?? ""), labels.folder.toLowerCase()));
  const studySets = useKeyedFetch<ContentStudySet[]>(folderId ? `${config.key}:sets:${folderId}` : null, () => expectList(listStudySets(target, folderId ?? ""), labels.studySet.toLowerCase()));
  const items = useKeyedFetch<TItem[]>(studySetId ? `${config.key}:items:${studySetId}` : null, () => expectList(listItems<TItem>(target, studySetId ?? ""), labels.item.toLowerCase()));

  // Danh sách gói giữ kết quả gần nhất khi tải lại (khoá cố định); các cấp dưới chỉ dùng dữ liệu đúng khoá hiện tại.
  const packageList = packages.state.kind === "ok" ? packages.state.data : (packages.lastData ?? []);
  const folderList = folders.state.kind === "ok" ? folders.state.data : [];
  const setList = studySets.state.kind === "ok" ? studySets.state.data : [];
  const itemList = useMemo(() => (items.state.kind === "ok" ? sortByIndex(items.state.data) : []), [items.state]);

  const selectedPackage = packageId ? (packageList.find((p) => p.id === packageId) ?? null) : null;
  const selectedFolder = folderId ? (folderList.find((f) => f.id === folderId) ?? null) : null;
  const selectedStudySet = studySetId ? (setList.find((s) => s.id === studySetId) ?? null) : null;

  /** Cấp đầu tiên mà id trong URL không có trong danh sách đã tải (gói đã xoá, URL gõ tay...). */
  const missing: "package" | "folder" | "studySet" | null =
    packageId && packages.state.kind === "ok" && !selectedPackage ? "package" : folderId && folders.state.kind === "ok" && !selectedFolder ? "folder" : studySetId && studySets.state.kind === "ok" && !selectedStudySet ? "studySet" : null;

  const go = useCallback((next: ContentTreeLocation) => router.push(treeHref(pathname, next)), [router, pathname]);

  // ---- thao tác ghi ----
  const [busy, setBusy] = useState(false);
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

  const savePackage = async (input: ContentPackageInput, editing: ContentPackage | null): Promise<boolean> => {
    const invalid = validatePackageInput(input);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    const body = normalizePackageInput(input);
    const result = editing
      ? await run(`Cập nhật ${labels.package.toLowerCase()} thất bại`, () => updatePackage(target, editing.id, body, demo))
      : await run(`Không thể tạo ${labels.package.toLowerCase()}`, () => createPackage(target, body, demo));
    if (!result) return false;
    toast.success(editing ? `Cập nhật ${labels.package.toLowerCase()} thành công!` : `Tạo ${labels.package.toLowerCase()} thành công!`);
    packages.reload();
    return true;
  };

  const removePackage = async (pkg: ContentPackage): Promise<boolean> => {
    const result = await run(`Xóa ${labels.package.toLowerCase()} thất bại`, () => deletePackage(target, pkg.id, demo));
    if (result === null) return false;
    toast.success(`${labels.package} "${pkg.name}" đã xóa thành công!`);
    packages.reload();
    if (packageId === pkg.id) go(ROOT_LOCATION);
    return true;
  };

  const togglePublish = async (pkg: ContentPackage): Promise<boolean> => {
    const publishing = !isPublished(pkg);
    const result = publishing
      ? await run(`Publish ${labels.package.toLowerCase()} thất bại`, () => publishPackage(target, pkg.id, demo))
      : await run(`Unpublish ${labels.package.toLowerCase()} thất bại`, () => unpublishPackage(target, pkg.id, demo));
    if (!result) return false;
    toast.success(publishing ? `${labels.package} "${pkg.name}" đã được publish` : `${labels.package} "${pkg.name}" đã chuyển về Draft`);
    packages.reload();
    return true;
  };

  const saveFolder = async (input: ContentFolderInput, editing: ContentFolder | null): Promise<boolean> => {
    const invalid = validateFolderInput(input, labels);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    const body = normalizeFolderInput(input);
    const result = editing
      ? await run(`Cập nhật ${labels.folder.toLowerCase()} thất bại`, () => updateFolder(target, editing.id, body, demo))
      : await run(`Không thể tạo ${labels.folder.toLowerCase()}`, () => createFolder(target, body, demo));
    if (!result) return false;
    toast.success(editing ? `Cập nhật ${labels.folder.toLowerCase()} thành công!` : `Tạo ${labels.folder.toLowerCase()} thành công!`);
    folders.reload();
    packages.reload(); // folderCount
    return true;
  };

  const removeFolder = async (folder: ContentFolder): Promise<boolean> => {
    const result = await run(`Xóa ${labels.folder.toLowerCase()} thất bại`, () => deleteFolder(target, folder.id, demo));
    if (result === null) return false;
    toast.success(`${labels.folder} "${folder.name}" đã xóa thành công!`);
    folders.reload();
    packages.reload();
    if (folderId === folder.id && packageId) go(packageLocation(packageId));
    return true;
  };

  const saveStudySet = async (input: ContentStudySetInput, editing: ContentStudySet | null): Promise<boolean> => {
    const invalid = validateStudySetInput(input, labels, Boolean(config.hasSkill));
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    const body = normalizeStudySetInput(input, Boolean(config.hasSkill));
    const result = editing
      ? await run(`Cập nhật ${labels.studySet} thất bại`, () => updateStudySet(target, editing.id, body, demo))
      : await run(`Tạo ${labels.studySet} thất bại`, () => createStudySet(target, body, demo));
    if (!result) return false;
    toast.success(editing ? `Cập nhật ${labels.studySet} thành công!` : `Tạo ${labels.studySet} thành công!`);
    studySets.reload();
    folders.reload(); // studySetCount
    return true;
  };

  const removeStudySet = async (set: ContentStudySet): Promise<boolean> => {
    const result = await run(`Xóa ${labels.studySet.toLowerCase()} thất bại`, () => deleteStudySet(target, set.id, demo));
    if (result === null) return false;
    toast.success(`Đã xóa ${labels.studySet.toLowerCase()} "${set.title}"`);
    studySets.reload();
    folders.reload();
    if (studySetId === set.id && packageId && folderId) go(folderLocation(packageId, folderId));
    return true;
  };

  const saveItem = async (input: ContentItemInput<TItem>, editing: TItem | null): Promise<boolean> => {
    const invalid = config.validateItemInput(input);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    if (!editing && !studySetId) return false;
    const body = config.normalizeItemInput(input);
    const result = editing
      ? await run(`Cập nhật ${labels.item.toLowerCase()} thất bại`, () => updateItem<TItem>(target, editing.id, body, demo))
      : await run(`Không thể thêm ${labels.item.toLowerCase()}`, () => createItem<TItem>(target, studySetId ?? "", { ...body, index: itemList.length }, demo));
    if (!result) return false;
    toast.success(editing ? `Cập nhật ${labels.item.toLowerCase()} thành công!` : `Đã thêm ${labels.item.toLowerCase()} mới`);
    items.reload();
    studySets.reload(); // itemCount
    return true;
  };

  const removeItem = async (item: TItem): Promise<boolean> => {
    const result = await run(`Xóa ${labels.item.toLowerCase()} thất bại`, () => deleteItem(target, item.id, demo));
    if (result === null) return false;
    toast.success(`Đã xóa ${labels.item.toLowerCase()} "${config.itemSummary(item)}"`);
    items.reload();
    studySets.reload();
    return true;
  };

  return {
    config,
    location,
    level,
    go,
    access,
    writeEnabled,
    demo,
    canWrite,
    canPublish,
    busy,
    packages: { state: packages.state, list: packageList, reload: packages.reload } satisfies ContentTreeList<ContentPackage>,
    folders: { state: folders.state, list: folderList, reload: folders.reload } satisfies ContentTreeList<ContentFolder>,
    studySets: { state: studySets.state, list: setList, reload: studySets.reload } satisfies ContentTreeList<ContentStudySet>,
    items: { state: items.state, list: itemList, reload: items.reload } satisfies ContentTreeList<TItem>,
    selectedPackage,
    selectedFolder,
    selectedStudySet,
    missing,
    savePackage,
    removePackage,
    togglePublish,
    saveFolder,
    removeFolder,
    saveStudySet,
    removeStudySet,
    saveItem,
    removeItem,
  };
}
