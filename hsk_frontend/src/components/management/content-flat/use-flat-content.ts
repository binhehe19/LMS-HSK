"use client";

// Logic màn quản lý nội dung PHẲNG (Package → mục) — mirror use-content-tree.ts nhưng bớt 2 cấp (Folder/StudySet), dùng cho module đã nối API thật
// (lms-content-client.ts/lms-grammar-client.ts) thay vì content-tree-client.ts (chưa có backend). Generic theo TItem + nhận `client` (bộ hàm CRUD của
// module đó) làm tham số — mỗi module tự khai báo client riêng theo FlatContentClient<TItem>, hook/manager này dùng chung. Cùng quy ước: vị trí trong
// URL, lỗi tải là trạng thái của cấp đó, sau mỗi thao tác ghi tải lại từ máy chủ, thao tác ghi qua write gate + khoá chống bấm đúp.
import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { useContentAccess } from "@/hooks/use-content-access";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError } from "@/lib/api/api-client";
import { attachPackageToSyllabus, copyPackageToSyllabus } from "@/lib/api/package-management-client";
import { isPublished, sortByIndex } from "@/lib/content/content-tree-model";
import { FLAT_ROOT_LOCATION, flatPackageLocation, flatHref, flatLevel, readFlatLocation, type FlatContentLocation } from "@/lib/content/flat-content-params";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import { usePackageTopics } from "@/components/management/content-flat/use-package-topics";
import { usePackageEditSession } from "./use-package-edit-session";
import type { PackageDraftFields } from "@/lib/api/package-edit-session-client";
import { packageTopicsForSession } from "@/lib/api/package-topics-client";
import type { PackageTopicsClient } from "@/lib/api/package-topics-client";
import { sortByTopic } from "@/lib/content/topic-grouping";
import type { ContentItemBase, ContentItemInput, ContentModuleConfig, ContentPackage, ContentPackageInput } from "@/types/content";

/** Bộ hàm CRUD một module phẳng cần cung cấp (xem lms-content-client.ts/lms-grammar-client.ts làm mẫu). */
export interface FlatContentClient<TItem extends ContentItemBase> {
  listPackages(): Promise<ContentPackage[]>;
  createPackage(input: ContentPackageInput, demo: boolean): Promise<ContentPackage>;
  updatePackage(packageId: string, input: ContentPackageInput, demo: boolean): Promise<ContentPackage>;
  deletePackage(packageId: string, demo: boolean): Promise<void>;
  publishPackage(packageId: string, demo: boolean): Promise<void>;
  unpublishPackage(packageId: string, demo: boolean): Promise<void>;
  listItems(packageId: string, sessionNo?: number): Promise<TItem[]>;
  createItem(packageId: string, input: ContentItemInput<TItem>, demo: boolean, sessionNo?: number): Promise<TItem>;
  updateItem(packageId: string, itemId: string, input: ContentItemInput<TItem>, demo: boolean): Promise<TItem>;
  deleteItem(packageId: string, itemId: string, demo: boolean): Promise<void>;
  /** Chủ đề trong gói (gom và sắp thứ tự mục); không có = module không dùng chủ đề. Mọi module Kho dùng chung `packageTopicsClient`. */
  topics?: PackageTopicsClient;
}

async function expectList<T>(promise: Promise<T[]>, what: string): Promise<T[]> {
  const data = await promise;
  if (!Array.isArray(data)) throw new ApiError(`Dữ liệu trả về không đúng định dạng danh sách ${what}.`, 200, "CONTRACT");
  return data;
}

export function useFlatContent<TItem extends ContentItemBase>(config: ContentModuleConfig<TItem>, client: FlatContentClient<TItem>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const location = useMemo(() => readFlatLocation(params), [params]);
  const level = flatLevel(location);
  const access = useContentAccess(config.module);
  const { enabled: writeEnabled, demo } = useWriteGate("content");
  const canWrite = access.canManage && writeEnabled;
  const canPublish = access.canPublish && writeEnabled;
  const { labels } = config;

  const { packageId } = location;
  const [sessionNo, setSessionNo] = useState(1);
  const sessionTopics = useMemo(() => client.topics ? packageTopicsForSession(sessionNo) : undefined, [client.topics, sessionNo]);
  const packages = useKeyedFetch<ContentPackage[]>(`${config.key}:packages`, () => expectList(client.listPackages(), labels.package.toLowerCase()));
  const packageList = packages.state.kind === "ok" ? packages.state.data : (packages.lastData ?? []);
  const selectedPackage = packageId ? (packageList.find((p) => p.id === packageId) ?? null) : null;
  const edit = usePackageEditSession(canWrite ? selectedPackage?.id ?? null : null);
  const visiblePackageId = !edit.status || edit.status === "ready" ? selectedPackage?.id ?? null : null;
  const viewKey = `${config.key}:${sessionNo}:${edit.draft?.id ?? "read"}`;
  const items = useKeyedFetch<TItem[]>(visiblePackageId ? `${viewKey}:items:${visiblePackageId}` : null, () => expectList(client.listItems(visiblePackageId ?? "", sessionNo), labels.item.toLowerCase()));

  // Chủ đề trong gói (nếu module khai báo): tải lỗi thì màn vẫn hiện mục như trước, chỉ không hiện chủ đề.
  const topics = usePackageTopics(sessionTopics, visiblePackageId, viewKey, demo, items.reload, edit.hasLock);

  // Mục theo thứ tự chủ đề rồi theo thứ tự trong gói; mục chưa phân chủ đề đứng cuối.
  const itemList = useMemo(() => (items.state.kind === "ok" ? sortByTopic(sortByIndex(items.state.data), topics.data) : []), [items.state, topics.data]);

  const missing: "package" | null = packageId && packages.state.kind === "ok" && !selectedPackage ? "package" : null;

  const go = useCallback((next: FlatContentLocation) => router.push(flatHref(pathname, next)), [router, pathname]);

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

  const savePackage = async (input: ContentPackageInput): Promise<boolean> => {
    if (!input.name.trim()) {
      toast.error(`Vui lòng nhập tên ${labels.package.toLowerCase()}`);
      return false;
    }
    const body = { ...input, name: input.name.trim(), description: input.description?.trim() || undefined };
    const result = await run(`Không thể tạo ${labels.package.toLowerCase()}`, () => client.createPackage(body, demo));
    if (!result) return false;
    toast.success(`Tạo ${labels.package.toLowerCase()} thành công!`);
    packages.reload();
    go(flatPackageLocation(result.id));
    return true;
  };

  const saveWorkspace = async (input: ContentPackageInput, publish = false): Promise<boolean> => {
    if (!selectedPackage || !edit.hasLock() || (publish && !canPublish)) return false;
    const syllabusId = input.syllabusId;
    const bind = syllabusId && syllabusId !== selectedPackage.syllabusId
      ? async () => {
          try {
            await attachPackageToSyllabus(selectedPackage.id, syllabusId, demo);
          } catch (error) {
            throw new Error(`Đã lưu bản nháp. ${writeErrorMessage(error, "Không đổi được giáo trình.")}`);
          }
        }
      : undefined;
    const result = await run(
      publish ? "Không xuất bản được học phần." : "Không lưu được bản nháp.",
      () => edit.run({ title: input.name.trim(), description: input.description ?? "", sessionCount: input.sessionCount ?? 1 }, bind, publish ? "publish" : undefined),
    );
    packages.reload();
    if (!result) return false;
    toast.success(publish ? "Đã lưu và xuất bản học phần." : "Đã lưu bản nháp.");
    if (publish) go(FLAT_ROOT_LOCATION);
    return true;
  };

  const discardWorkspace = async () => {
    if (!edit.hasLock()) return false;
    const result = await run("Không hủy được bản nháp.", () => edit.run(undefined, undefined, "discard"));
    if (!result) return false;
    toast.success("Đã hủy bản nháp.");
    packages.reload();
    go(FLAT_ROOT_LOCATION);
    return true;
  };

  const heartbeat = (fields?: PackageDraftFields) => edit.run(fields, undefined, undefined, true);

  const copyPackage = async (source: ContentPackage, syllabusId: string): Promise<boolean> => {
    if (!edit.hasLock()) return false;
    const copy = await run("Không thể tạo bản sao học phần.", () => copyPackageToSyllabus(source.id, syllabusId, demo));
    if (!copy) return false;
    packages.reload();
    go(flatPackageLocation(copy.id));
    toast.success("Đã tạo bản sao học phần.");
    return true;
  };

  const removePackage = async (pkg: ContentPackage): Promise<boolean> => {
    const result = await run(`Xóa ${labels.package.toLowerCase()} thất bại`, () => client.deletePackage(pkg.id, demo));
    if (result === null) return false;
    toast.success(`${labels.package} "${pkg.name}" đã xóa thành công!`);
    packages.reload();
    if (packageId === pkg.id) go(FLAT_ROOT_LOCATION);
    return true;
  };

  const togglePublish = async (pkg: ContentPackage): Promise<boolean> => {
    const publishing = !isPublished(pkg);
    const result = await run(
      publishing ? `Publish ${labels.package.toLowerCase()} thất bại` : `Unpublish ${labels.package.toLowerCase()} thất bại`,
      () => (publishing ? client.publishPackage(pkg.id, demo) : client.unpublishPackage(pkg.id, demo)),
    );
    if (result === null) return false;
    toast.success(publishing ? `${labels.package} "${pkg.name}" đã được publish` : `${labels.package} "${pkg.name}" đã chuyển về Draft`);
    packages.reload();
    return true;
  };

  const saveItem = async (input: ContentItemInput<TItem>, editing: TItem | null): Promise<boolean> => {
    const invalid = config.validateItemInput(input);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    if (!packageId || !edit.hasLock()) return false;
    const body = config.normalizeItemInput(input);
    const result = editing
      ? await run(`Cập nhật ${labels.item.toLowerCase()} thất bại`, () => client.updateItem(packageId, editing.id, body, demo))
      : await run(`Không thể thêm ${labels.item.toLowerCase()}`, () => client.createItem(packageId, { ...body, index: itemList.length }, demo, sessionNo));
    if (!result) return false;
    toast.success(editing ? `Cập nhật ${labels.item.toLowerCase()} thành công!` : `Đã thêm ${labels.item.toLowerCase()} mới`);
    items.reload();
    return true;
  };

  const removeItem = async (item: TItem): Promise<boolean> => {
    if (!packageId || !edit.hasLock()) return false;
    const result = await run(`Xóa ${labels.item.toLowerCase()} thất bại`, () => client.deleteItem(packageId, item.id, demo));
    if (result === null) return false;
    toast.success(`Đã xóa ${labels.item.toLowerCase()} "${config.itemSummary(item)}"`);
    items.reload();
    return true;
  };

  return {
    config,
    sessionNo, setSessionNo,
    location,
    level,
    go,
    access,
    writeEnabled,
    demo,
    canWrite,
    canPublish,
    edit,
    heartbeat,
    busy: busy || topics.busy,
    packages: { state: packages.state, list: packageList, reload: packages.reload },
    items: { state: items.state, list: itemList, reload: items.reload },
    selectedPackage,
    topicUi: topics.topicUi,
    missing,
    savePackage,
    saveWorkspace,
    discardWorkspace,
    copyPackage,
    removePackage,
    togglePublish,
    saveItem,
    removeItem,
  };
}
