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
import { isPublished, sortByIndex } from "@/lib/content/content-tree-model";
import { FLAT_ROOT_LOCATION, flatHref, flatLevel, readFlatLocation, type FlatContentLocation } from "@/lib/content/flat-content-params";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import { usePackageTopics } from "@/components/management/content-flat/use-package-topics";
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
  listItems(packageId: string): Promise<TItem[]>;
  createItem(packageId: string, input: ContentItemInput<TItem>, demo: boolean): Promise<TItem>;
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
  const packages = useKeyedFetch<ContentPackage[]>(`${config.key}:packages`, () => expectList(client.listPackages(), labels.package.toLowerCase()));
  const items = useKeyedFetch<TItem[]>(packageId ? `${config.key}:items:${packageId}` : null, () => expectList(client.listItems(packageId ?? ""), labels.item.toLowerCase()));

  // Chủ đề trong gói (nếu module khai báo): tải lỗi thì màn vẫn hiện mục như trước, chỉ không hiện chủ đề.
  const topics = usePackageTopics(client.topics, packageId, config.key, demo, items.reload);

  const packageList = packages.state.kind === "ok" ? packages.state.data : (packages.lastData ?? []);
  // Mục theo thứ tự chủ đề rồi theo thứ tự trong gói; mục chưa phân chủ đề đứng cuối.
  const itemList = useMemo(() => (items.state.kind === "ok" ? sortByTopic(sortByIndex(items.state.data), topics.data) : []), [items.state, topics.data]);

  const selectedPackage = packageId ? (packageList.find((p) => p.id === packageId) ?? null) : null;
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

  const savePackage = async (input: ContentPackageInput, editing: ContentPackage | null): Promise<boolean> => {
    if (!input.name.trim()) {
      toast.error(`Vui lòng nhập tên ${labels.package.toLowerCase()}`);
      return false;
    }
    const body = { ...input, name: input.name.trim(), description: input.description?.trim() || undefined };
    const result = editing
      ? await run(`Cập nhật ${labels.package.toLowerCase()} thất bại`, () => client.updatePackage(editing.id, body, demo))
      : await run(`Không thể tạo ${labels.package.toLowerCase()}`, () => client.createPackage(body, demo));
    if (!result) return false;
    toast.success(editing ? `Cập nhật ${labels.package.toLowerCase()} thành công!` : `Tạo ${labels.package.toLowerCase()} thành công!`);
    packages.reload();
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
    if (!packageId) return false;
    const body = config.normalizeItemInput(input);
    const result = editing
      ? await run(`Cập nhật ${labels.item.toLowerCase()} thất bại`, () => client.updateItem(packageId, editing.id, body, demo))
      : await run(`Không thể thêm ${labels.item.toLowerCase()}`, () => client.createItem(packageId, { ...body, index: itemList.length }, demo));
    if (!result) return false;
    toast.success(editing ? `Cập nhật ${labels.item.toLowerCase()} thành công!` : `Đã thêm ${labels.item.toLowerCase()} mới`);
    items.reload();
    return true;
  };

  const removeItem = async (item: TItem): Promise<boolean> => {
    if (!packageId) return false;
    const result = await run(`Xóa ${labels.item.toLowerCase()} thất bại`, () => client.deleteItem(packageId, item.id, demo));
    if (result === null) return false;
    toast.success(`Đã xóa ${labels.item.toLowerCase()} "${config.itemSummary(item)}"`);
    items.reload();
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
    busy: busy || topics.busy,
    packages: { state: packages.state, list: packageList, reload: packages.reload },
    items: { state: items.state, list: itemList, reload: items.reload },
    selectedPackage,
    topicUi: topics.topicUi,
    missing,
    savePackage,
    removePackage,
    togglePublish,
    saveItem,
    removeItem,
  };
}
