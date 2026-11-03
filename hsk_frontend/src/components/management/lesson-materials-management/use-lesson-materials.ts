"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch, type FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { createMaterial, createMaterialGroup, deleteMaterial, deleteMaterialGroup, listGroupMaterials, listMaterialGroups, publishMaterialGroup, unpublishMaterialGroup, updateMaterialGroup } from "@/lib/api/lesson-materials-client";
import { isStorageApiConfigured, uploadFile } from "@/lib/api/storage-client";
import { STORAGE_NOT_CONFIGURED_MESSAGE, writeErrorMessage } from "@/lib/api/write-error-message";
import { findDuplicateGroup, NEW_GROUP, type BulkFileItem } from "@/lib/lesson-materials/lesson-material-model";
import type { BulkCreateMaterialResult, BulkItemError, LessonMaterial, LessonMaterialGroup, LessonMaterialType } from "@/types/lesson-materials";

export type MaterialSelection = { id: string } | null;

export interface GroupFormValues {
  id: string | null;
  type: LessonMaterialType;
  name: string;
  description: string;
}

export interface MaterialFormValues {
  title: string;
  /** id bộ có sẵn hoặc NEW_GROUP. */
  groupSelection: string;
  newGroupType: LessonMaterialType;
  newGroupName: string;
}

export type BulkPhase = "idle" | "processing" | "done";

export interface BulkState {
  phase: BulkPhase;
  items: BulkFileItem[];
  progress: { current: number; total: number; phase: string };
  result: BulkCreateMaterialResult | null;
}

const IDLE_BULK: BulkState = { phase: "idle", items: [], progress: { current: 0, total: 0, phase: "" }, result: null };

const DUPLICATE_MESSAGE = "Tên bộ tài liệu đã tồn tại (cùng loại). Vui lòng chọn bộ có sẵn hoặc nhập tên khác.";

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiNotConfiguredError) return STORAGE_NOT_CONFIGURED_MESSAGE;
  return error instanceof Error && error.message ? error.message : "Không thể tải tệp lên";
}

/**
 * Logic màn Quản lý tài liệu học tập — gắn trực tiếp vào ContentPackage/LearningResource có sẵn (xem lesson-materials-client.ts): bộ tài liệu = 1
 * package/loại, tài liệu của bộ đang chọn tải riêng khi chọn bộ (không còn "Chưa phân loại" — mỗi tài liệu luôn thuộc đúng 1 bộ). Tệp tải lên
 * repo-storage (storage-client) rồi mới tạo LearningResource. Trạng thái tài liệu dùng chung trạng thái publish của bộ (không còn trạng thái riêng
 * từng tài liệu); xoá tài liệu là xoá thật (resource không chia sẻ nơi khác).
 */
export function useLessonMaterials() {
  const { enabled: writeEnabled, demo } = useWriteGate("content");
  const storageConfigured = isStorageApiConfigured();

  const groupsFetch = useKeyedFetch<LessonMaterialGroup[]>("lesson-materials-groups", listMaterialGroups);
  const groups = groupsFetch.state.kind === "ok" ? groupsFetch.state.data : (groupsFetch.lastData ?? []);

  const [selection, setSelection] = useState<MaterialSelection>(null);
  const selectedGroup = selection === null ? null : (groups.find((g) => g.id === selection.id) ?? null);
  const detailFetch = useKeyedFetch<LessonMaterial[]>(selection === null ? null : `group-materials:${selection.id}`, () => listGroupMaterials(selection!.id));
  const detailState: FetchState<LessonMaterial[]> = selection === null ? { kind: "ok", data: [] } : detailFetch.state;

  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [bulk, setBulk] = useState<BulkState>(IDLE_BULK);

  const reloadAll = () => {
    groupsFetch.reload();
    if (selection !== null) detailFetch.reload();
  };

  // ---- bộ tài liệu ----
  const saveGroup = async (values: GroupFormValues): Promise<boolean> => {
    const name = values.name.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên bộ tài liệu");
      return false;
    }
    if (findDuplicateGroup(groups, values.type, name, values.id)) {
      toast.error("Tên bộ tài liệu đã tồn tại (cùng loại). Vui lòng nhập tên khác.");
      return false;
    }
    setBusy(true);
    try {
      const description = values.description.trim() || undefined;
      if (values.id) await updateMaterialGroup(values.id, values.type, { name, description }, demo);
      else await createMaterialGroup({ type: values.type, name, description }, demo);
    } catch (error) {
      toast.error(writeErrorMessage(error, "Không thể lưu bộ tài liệu"));
      return false;
    } finally {
      setBusy(false);
    }
    toast.success(values.id ? "Đã cập nhật bộ tài liệu" : "Đã thêm bộ tài liệu");
    reloadAll();
    return true;
  };

  const togglePublish = async (group: LessonMaterialGroup): Promise<boolean> => {
    const publishing = group.status === "DRAFT";
    setBusy(true);
    try {
      await (publishing ? publishMaterialGroup(group.id, demo) : unpublishMaterialGroup(group.id, demo));
    } catch (error) {
      toast.error(writeErrorMessage(error, "Không thể thay đổi trạng thái bộ tài liệu"));
      return false;
    } finally {
      setBusy(false);
    }
    toast.success(publishing ? "Đã xuất bản bộ tài liệu" : "Đã chuyển bộ tài liệu về nháp");
    reloadAll();
    return true;
  };

  const removeGroup = async (group: LessonMaterialGroup): Promise<boolean> => {
    setBusy(true);
    try {
      await deleteMaterialGroup(group.id, demo);
    } catch (error) {
      toast.error(writeErrorMessage(error, "Không thể xoá bộ tài liệu"));
      return false;
    } finally {
      setBusy(false);
    }
    toast.success("Đã xoá bộ tài liệu");
    if (selection?.id === group.id) setSelection(null);
    reloadAll();
    return true;
  };

  /** Bộ đích của tài liệu mới: id bộ có sẵn, hoặc tạo bộ mới (NEW_GROUP) cùng loại `type`. Trả `false` khi phải dừng. */
  const resolveGroup = async (groupSelection: string, type: LessonMaterialType, newGroupName: string): Promise<LessonMaterialGroup | false> => {
    if (groupSelection !== NEW_GROUP) return groups.find((g) => g.id === groupSelection) ?? false;
    const name = newGroupName.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên bộ tài liệu mới");
      return false;
    }
    const existing = findDuplicateGroup(groups, type, name);
    if (existing) {
      toast.info(`Đã dùng bộ tài liệu hiện có: ${existing.name}`);
      return existing;
    }
    try {
      return await createMaterialGroup({ type, name }, demo);
    } catch (error) {
      toast.error(error instanceof ApiError ? DUPLICATE_MESSAGE : writeErrorMessage(error, "Không thể tạo bộ tài liệu mới"));
      return false;
    }
  };

  // ---- tài liệu ----
  const createOne = async (values: MaterialFormValues, file: File | null): Promise<boolean> => {
    const title = values.title.trim();
    if (!title) {
      toast.error("Vui lòng nhập tên tài liệu");
      return false;
    }
    if (!file) {
      toast.error("Vui lòng tải tệp lên");
      return false;
    }
    setBusy(true);
    try {
      setUploadProgress(0);
      let meta: { fileId: string; filename?: string; mimeType?: string; sizeBytes?: number };
      try {
        meta = await uploadFile(file, setUploadProgress);
      } catch (error) {
        toast.error(uploadErrorMessage(error));
        return false;
      } finally {
        setUploadProgress(null);
      }
      const group = await resolveGroup(values.groupSelection, values.newGroupType, values.newGroupName);
      if (group === false) return false;
      try {
        await createMaterial(group.id, group.type, group.status === "PUBLISHED", { title, fileId: meta.fileId, filename: meta.filename || file.name, mimeType: meta.mimeType, sizeBytes: meta.sizeBytes }, demo);
      } catch (error) {
        toast.error(writeErrorMessage(error, "Không thể thêm tài liệu học tập"));
        return false;
      }
    } finally {
      setBusy(false);
    }
    toast.success("Đã thêm tài liệu học tập");
    reloadAll();
    return true;
  };

  const removeMaterial = async (material: LessonMaterial): Promise<boolean> => {
    setBusy(true);
    try {
      await deleteMaterial(material.groupId, material.id, demo);
    } catch (error) {
      toast.error(writeErrorMessage(error, "Không thể xoá tài liệu"));
      return false;
    } finally {
      setBusy(false);
    }
    toast.success("Đã xoá tài liệu");
    reloadAll();
    return true;
  };

  // ---- thêm hàng loạt: tải từng tệp lên repo-storage rồi tạo+gắn từng LearningResource tuần tự vào 1 bộ đích ----
  const startBulk = async (items: BulkFileItem[], groupSelection: string, newGroupType: LessonMaterialType, newGroupName: string) => {
    if (items.length === 0) return;
    if (items.some((item) => !item.title.trim())) {
      toast.error("Vui lòng nhập tên cho tất cả tài liệu");
      return;
    }
    setBusy(true);
    const current: BulkFileItem[] = items.map((item) => ({ ...item, uploadStatus: "idle", fileId: "", errorMessage: "" }));
    const publish = (progress: BulkState["progress"]) => setBulk({ phase: "processing", items: [...current], progress, result: null });
    try {
      publish({ current: 0, total: items.length, phase: "Đang chuẩn bị..." });
      const group = await resolveGroup(groupSelection, newGroupType, newGroupName);
      if (group === false) {
        setBulk(IDLE_BULK);
        return;
      }
      const created: LessonMaterial[] = [];
      const createErrors: BulkItemError[] = [];
      for (let i = 0; i < current.length; i += 1) {
        const item = current[i];
        current[i] = { ...item, uploadStatus: "uploading" };
        publish({ current: i + 1, total: current.length, phase: `Đang tải tệp lên kho: ${item.file.name} (${i + 1}/${current.length})` });
        try {
          const meta = await uploadFile(item.file);
          current[i] = { ...current[i], uploadStatus: "uploaded", fileId: meta.fileId };
          const material = await createMaterial(group.id, group.type, group.status === "PUBLISHED", { title: item.title.trim(), fileId: meta.fileId, filename: meta.filename || item.file.name, mimeType: meta.mimeType, sizeBytes: meta.sizeBytes }, demo);
          created.push(material);
        } catch (error) {
          current[i] = { ...current[i], uploadStatus: "error", errorMessage: error instanceof Error && error.message ? error.message : uploadErrorMessage(error) };
          createErrors.push({ index: i, title: item.title.trim(), errorCode: "UPLOAD_FAILED", message: current[i].errorMessage });
        }
      }
      const result: BulkCreateMaterialResult = { created, errors: createErrors, totalRequested: current.length, totalCreated: created.length, totalFailed: current.length - created.length };
      if (result.totalCreated > 0) toast.success(`Đã tạo ${result.totalCreated}/${result.totalRequested} tài liệu`);
      if (result.totalFailed > 0) toast.error(`${result.totalFailed} tài liệu gặp lỗi`);
      setBulk({ phase: "done", items: [...current], progress: { current: current.length, total: current.length, phase: "" }, result });
      if (result.totalCreated > 0) reloadAll();
    } finally {
      setBusy(false);
    }
  };

  return {
    state: groupsFetch.state,
    groups,
    refreshing: groupsFetch.state.kind === "loading" && groupsFetch.lastData !== null,
    reload: groupsFetch.reload,
    writeEnabled,
    storageConfigured,
    busy,
    uploadProgress,
    selection,
    selectedGroup,
    detailState,
    select: (next: MaterialSelection) => setSelection(next),
    retryDetail: detailFetch.reload,
    saveGroup,
    togglePublish,
    removeGroup,
    createOne,
    removeMaterial,
    bulk,
    startBulk,
    resetBulk: () => setBulk(IDLE_BULK),
  };
}

export type LessonMaterials = ReturnType<typeof useLessonMaterials>;
