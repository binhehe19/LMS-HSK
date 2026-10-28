"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { useContentAccess } from "@/hooks/use-content-access";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError } from "@/lib/api/api-client";
import { createItemsBulk, createStudySet, deleteItem, getFolder, getStudySet, listFolders, listItems, listPackages, updateItem, updateStudySet, type ContentApiTarget } from "@/lib/api/content-tree-client";
import { diffContentItems, type EditableContentItem } from "@/lib/content/content-item-diff";
import { sortByIndex } from "@/lib/content/content-tree-model";
import { normalizeStudySetInput, writeErrorMessage } from "@/lib/content/content-tree-validate";
import type { ContentFolder, ContentItemBase, ContentItemInput, ContentModuleConfig, ContentPackage, ContentStudySet } from "@/types/content";

export type ContentSetEditorMode = { kind: "create"; packageId: string | null; folderId: string | null } | { kind: "edit"; studySetId: string };

interface ContentSetDraft<TItem extends ContentItemBase> {
  title: string;
  description: string;
  skill: string;
  packageId: string;
  folderId: string;
  items: EditableContentItem<TItem>[];
}

export interface ContentSetSaved {
  studySetId: string;
  folderId: string;
  /** Có thể rỗng ở chế độ sửa nếu không tải được thư mục. */
  packageId: string;
}

interface LoadedSet<TItem extends ContentItemBase> {
  set: ContentStudySet;
  items: TItem[];
  folder: ContentFolder | null;
}

// Khoá cục bộ cho mục mới (chưa có id máy chủ); bộ đếm mô-đun để không đụng quy tắc không đổi ref trong lúc render.
let localSeq = 0;
const nextLocalId = () => `local-${++localSeq}`;

async function expectList<T>(promise: Promise<T[]>): Promise<T[]> {
  const data = await promise;
  if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách.", 200, "CONTRACT");
  return data;
}

function draftFromLoaded<TItem extends ContentItemBase>(loaded: LoadedSet<TItem>, config: ContentModuleConfig<TItem>): ContentSetDraft<TItem> {
  return {
    title: loaded.set.title,
    description: loaded.set.description ?? "",
    skill: loaded.set.skill ?? "",
    packageId: loaded.folder?.packageId ?? "",
    folderId: loaded.set.folderId,
    items: loaded.items.map((item) => ({ localId: item.id, id: item.id, input: config.itemToInput(item) })),
  };
}

/**
 * Trang tạo/sửa một bộ kèm danh sách mục (create-set-page / update-set-page của HSK cũ, generic): bản nháp trong bộ nhớ, lưu bằng
 * tạo bộ + bulk mục (tạo) hoặc cập nhật bộ + so khớp mục (sửa, giữ id mục cũ). Thao tác ghi qua write gate "content" + quyền ticket.
 * Khác bản cũ có chủ đích: lỗi tải là trạng thái hiển thị; không "thành công giả"; mục bắt buộc hợp lệ hết trước khi gửi (bản cũ cũng vậy).
 */
export function useContentSetEditor<TItem extends ContentItemBase>(config: ContentModuleConfig<TItem>, mode: ContentSetEditorMode) {
  const access = useContentAccess(config.module);
  const { enabled: writeEnabled, demo } = useWriteGate("content");
  const canWrite = access.canManage && writeEnabled;
  const target: ContentApiTarget = useMemo(() => ({ apiPrefix: config.apiPrefix, itemsPath: config.itemsPath }), [config.apiPrefix, config.itemsPath]);
  const { labels } = config;
  const editId = mode.kind === "edit" ? mode.studySetId : null;

  const [draft, setDraft] = useState<ContentSetDraft<TItem> | null>(() =>
    mode.kind === "create" ? { title: "", description: "", skill: "", packageId: mode.packageId ?? "", folderId: mode.folderId ?? "", items: [{ localId: nextLocalId(), input: config.emptyItemInput() }] } : null,
  );

  const loaded = useKeyedFetch<LoadedSet<TItem>>(editId ? `${config.key}:set-editor:${editId}` : null, async () => {
    const set = await getStudySet(target, editId ?? "");
    if (!set || typeof set.id !== "string") throw new ApiError(`Dữ liệu ${labels.studySet.toLowerCase()} trả về không đúng định dạng.`, 200, "CONTRACT");
    const [list, folder] = await Promise.all([expectList(listItems<TItem>(target, set.id)), set.folderId ? getFolder(target, set.folderId).catch(() => null) : Promise.resolve(null)]);
    return { set, items: sortByIndex(list), folder };
  });
  const loadedData = loaded.state.kind === "ok" ? loaded.state.data : null;
  // Bản nháp hiệu lực: người dùng đã sửa thì dùng bản sửa; chưa thì suy từ dữ liệu tải về (không setState trong effect).
  const effective = draft ?? (loadedData ? draftFromLoaded(loadedData, config) : null);
  const update = (patch: Partial<ContentSetDraft<TItem>> | ((prev: ContentSetDraft<TItem>) => ContentSetDraft<TItem>)) =>
    setDraft((prev) => {
      const base = prev ?? (loadedData ? draftFromLoaded(loadedData, config) : null);
      if (!base) return prev;
      return typeof patch === "function" ? patch(base) : { ...base, ...patch };
    });

  // Chọn gói/thư mục (chế độ tạo) — danh sách gói và thư mục của gói đang chọn.
  const packages = useKeyedFetch<ContentPackage[]>(mode.kind === "create" ? `${config.key}:packages` : null, () => expectList(listPackages(target)));
  const selectedPackageId = effective?.packageId ?? "";
  const folders = useKeyedFetch<ContentFolder[]>(mode.kind === "create" && selectedPackageId ? `${config.key}:folders:${selectedPackageId}` : null, () => expectList(listFolders(target, selectedPackageId)));

  const setItem = (localId: string, input: ContentItemInput<TItem>) => update((prev) => ({ ...prev, items: prev.items.map((it) => (it.localId === localId ? { ...it, input } : it)) }));
  const addItem = () => update((prev) => ({ ...prev, items: [...prev.items, { localId: nextLocalId(), input: config.emptyItemInput() }] }));
  const addItems = (inputs: ContentItemInput<TItem>[]) => update((prev) => ({ ...prev, items: [...prev.items, ...inputs.map((input) => ({ localId: nextLocalId(), input }))] }));
  const removeItem = (localId: string) => update((prev) => ({ ...prev, items: prev.items.filter((it) => it.localId !== localId) }));

  const [saving, setSaving] = useState(false);
  const save = async (): Promise<ContentSetSaved | null> => {
    if (!effective) return null;
    const title = effective.title.trim();
    if (!title) return toast.error(`Vui lòng nhập tên ${labels.studySet}`), null;
    if (!effective.folderId) return toast.error(`Vui lòng chọn ${labels.folder.toLowerCase()}`), null;
    if (config.hasSkill && !effective.skill) return toast.error("Vui lòng chọn kỹ năng"), null;
    if (effective.items.length === 0) return toast.error(`Vui lòng thêm ít nhất một ${labels.item.toLowerCase()}`), null;
    for (const [i, item] of effective.items.entries()) {
      const invalid = config.validateItemInput(item.input);
      if (invalid) return toast.error(`${labels.item} ${i + 1}: ${invalid}`), null;
    }
    setSaving(true);
    try {
      const setInput = normalizeStudySetInput({ folderId: effective.folderId, title, description: effective.description, isPrivate: true, skill: effective.skill }, Boolean(config.hasSkill));
      if (mode.kind === "create") {
        const created = await createStudySet(target, setInput, demo);
        if (!created?.id) throw new ApiError(`Máy chủ không trả id của ${labels.studySet.toLowerCase()} vừa tạo.`, 200, "CONTRACT");
        await createItemsBulk(target, created.id, effective.items.map((it, index) => ({ ...config.normalizeItemInput(it.input), index })), demo);
        toast.success(`Tạo ${labels.studySet} thành công!`);
        return { studySetId: created.id, folderId: effective.folderId, packageId: effective.packageId };
      }
      await updateStudySet(target, mode.studySetId, setInput, demo);
      const diff = diffContentItems(loadedData?.items ?? [], effective.items, config);
      await Promise.all(diff.toUpdate.map((entry) => updateItem<TItem>(target, entry.id, entry.input, demo)));
      await Promise.all(diff.toDeleteIds.map((id) => deleteItem(target, id, demo)));
      if (diff.toCreate.length > 0) await createItemsBulk(target, mode.studySetId, diff.toCreate, demo);
      toast.success(`Cập nhật ${labels.studySet} thành công!`);
      loaded.reload();
      setDraft(null);
      return { studySetId: mode.studySetId, folderId: effective.folderId, packageId: effective.packageId };
    } catch (error) {
      toast.error(writeErrorMessage(error, `Lưu ${labels.studySet.toLowerCase()} thất bại`));
      return null;
    } finally {
      setSaving(false);
    }
  };

  return {
    access,
    writeEnabled,
    canWrite,
    draft: effective,
    loadState: loaded.state,
    reload: loaded.reload,
    loadedFolder: loadedData?.folder ?? null,
    packages: packages.state.kind === "ok" ? packages.state.data : [],
    packagesState: packages.state,
    folders: folders.state.kind === "ok" ? folders.state.data : [],
    foldersState: folders.state,
    update,
    setItem,
    addItem,
    addItems,
    removeItem,
    saving,
    save,
  };
}
