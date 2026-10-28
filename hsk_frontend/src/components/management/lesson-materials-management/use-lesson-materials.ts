"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch, type FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { archiveMaterialGroup, bulkCreateMaterials, createMaterial, createMaterialGroup, listGroupMaterials, listMaterialGroups, listMaterials, updateMaterialGroup, updateMaterialStatus } from "@/lib/api/lesson-materials-client";
import { isStorageApiConfigured, uploadFile } from "@/lib/api/storage-client";
import { STORAGE_NOT_CONFIGURED_MESSAGE, writeErrorMessage } from "@/lib/api/write-error-message";
import {
  findDuplicateGroup,
  flattenGroupedMaterials,
  isDuplicateGroupError,
  isInvalidTransitionError,
  LESSON_MATERIAL_STATUS_LABELS,
  materialsOfGroup,
  NEW_GROUP,
  uploadFailureErrors,
  type BulkFileItem,
} from "@/lib/lesson-materials/lesson-material-model";
import type { BulkCreateMaterialResult, CreateLessonMaterialRequest, LessonMaterial, LessonMaterialCategory, LessonMaterialGroup, LessonMaterialStatus, LessonMaterialType } from "@/types/lesson-materials";

export interface LessonMaterialsData {
  groups: LessonMaterialGroup[];
  materials: LessonMaterial[];
}

/** Bộ đang xem ở cột phải: một bộ tài liệu (theo id, đối tượng lấy lại từ dữ liệu mới nhất) hoặc ngăn "Chưa phân loại". */
export type MaterialSelection = { kind: "group"; id: string } | { kind: "ungrouped" } | null;

export interface GroupFormValues {
  id: string | null;
  name: string;
  description: string;
}

export interface MaterialFormValues {
  title: string;
  description: string;
  category: LessonMaterialCategory;
  type: LessonMaterialType;
  /** "" = Chưa phân loại; id bộ; hoặc NEW_GROUP. */
  groupSelection: string;
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

const ARCHIVED_DUPLICATE_MESSAGE = "Tên bộ tài liệu đã tồn tại trong mục lưu trữ. Vui lòng khôi phục bộ đó hoặc nhập tên khác.";
const DUPLICATE_MESSAGE = "Tên bộ tài liệu đã tồn tại. Vui lòng chọn bộ có sẵn hoặc nhập tên khác.";

/** Lỗi tải tệp lên repo-storage: chưa cấu hình => câu riêng; lỗi API => thông điệp của nó. */
function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiNotConfiguredError) return STORAGE_NOT_CONFIGURED_MESSAGE;
  return error instanceof Error && error.message ? error.message : "Không thể tải tệp lên";
}

/**
 * Logic màn Quản lý tài liệu học tập: bộ tài liệu + toàn bộ tài liệu (một lần, size=200 như bản cũ), tài liệu của bộ đang chọn, và các thao tác ghi
 * (bộ: thêm/sửa/lưu trữ/khôi phục; tài liệu: thêm một, thêm hàng loạt, đổi trạng thái). Tệp tải lên repo-storage của backend chung (storage-client)
 * rồi chỉ gửi `fileId` — khác bản cũ (POST /storage/upload của HSK).
 * Khác bản cũ có chủ đích: lỗi tải là trạng thái màn (bản cũ: toast + lưới rỗng); sau ghi thành công TẢI LẠI từ máy chủ; thao tác ghi qua write gate
 * "lesson-materials"; không giữ "mã tệp đã tải lên" giữa hai lần bấm Thêm (nếu tạo tài liệu lỗi sau khi tải tệp, lần sau tải lại tệp).
 */
export function useLessonMaterials() {
  const { enabled: writeEnabled, demo } = useWriteGate("lesson-materials");
  const storageConfigured = isStorageApiConfigured();

  const all = useKeyedFetch<LessonMaterialsData>("lesson-materials", async () => {
    const [groups, page] = await Promise.all([listMaterialGroups(), listMaterials({ size: 200 })]);
    if (!Array.isArray(groups)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách bộ tài liệu.", 200, "CONTRACT");
    if (!page || !Array.isArray(page.content)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách tài liệu.", 200, "CONTRACT");
    return { groups, materials: page.content };
  });

  const [selection, setSelection] = useState<MaterialSelection>(null);
  const groupId = selection?.kind === "group" ? selection.id : null;
  const groupDetail = useKeyedFetch<LessonMaterial[]>(groupId === null ? null : `group-materials:${groupId}`, async () => flattenGroupedMaterials(await listGroupMaterials(groupId as string)));

  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<BulkState>(IDLE_BULK);
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

  const data = all.state.kind === "ok" ? all.state.data : (all.lastData ?? { groups: [], materials: [] });
  const groups = data.groups;
  const materials = data.materials;
  const selectedGroup = groupId === null ? null : (groups.find((g) => g.id === groupId) ?? null);

  const reloadAll = () => {
    all.reload();
    if (groupId !== null) groupDetail.reload();
  };

  /** Tài liệu của cột phải: bộ đang chọn (từ máy chủ) hoặc "Chưa phân loại" (lọc từ danh sách tổng). */
  const detailState: FetchState<LessonMaterial[]> =
    selection === null ? { kind: "ok", data: [] } : selection.kind === "ungrouped" ? (all.state.kind === "ok" ? { kind: "ok", data: materialsOfGroup(all.state.data.materials, null) } : all.state.kind === "loading" && all.lastData ? { kind: "ok", data: materialsOfGroup(all.lastData.materials, null) } : (all.state as FetchState<LessonMaterial[]>)) : groupDetail.state;

  // ---- bộ tài liệu ----
  const saveGroup = async (values: GroupFormValues): Promise<boolean> => {
    const name = values.name.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên bộ tài liệu");
      return false;
    }
    const duplicated = findDuplicateGroup(groups, name, values.id);
    if (duplicated) {
      toast.error(duplicated.status === "ARCHIVED" ? ARCHIVED_DUPLICATE_MESSAGE : "Tên bộ tài liệu đã tồn tại. Vui lòng nhập tên khác.");
      return false;
    }
    const description = values.description.trim() || undefined;
    const result = await run("Không thể lưu bộ tài liệu", async () => {
      try {
        return values.id ? await updateMaterialGroup(values.id, { name, description }, demo) : await createMaterialGroup({ name, description }, demo);
      } catch (error) {
        if (error instanceof ApiError && isDuplicateGroupError(error.status, error.errorCode)) throw new ApiError("Tên bộ tài liệu đã tồn tại. Vui lòng nhập tên khác.", error.status, error.errorCode);
        throw error;
      }
    });
    if (!result) return false;
    toast.success(values.id ? "Đã cập nhật bộ tài liệu" : "Đã thêm bộ tài liệu");
    reloadAll();
    return true;
  };

  const toggleGroupArchive = async (group: LessonMaterialGroup): Promise<boolean> => {
    const restoring = group.status === "ARCHIVED";
    const result = await run("Không thể thay đổi trạng thái bộ tài liệu", () => (restoring ? updateMaterialGroup(group.id, { status: "ACTIVE" }, demo) : archiveMaterialGroup(group.id, demo)));
    if (!result) return false;
    toast.success(restoring ? "Đã khôi phục bộ tài liệu" : "Đã lưu trữ bộ tài liệu");
    reloadAll();
    return true;
  };

  /** Bộ đích của tài liệu mới: "" => không bộ; NEW_GROUP => dùng bộ cùng tên nếu có (lưu trữ thì từ chối) hoặc tạo mới; trả về `false` khi phải dừng. */
  const resolveGroupId = async (groupSelection: string, newGroupName: string): Promise<string | undefined | false> => {
    if (groupSelection !== NEW_GROUP) return groupSelection || undefined;
    const name = newGroupName.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên bộ tài liệu mới");
      return false;
    }
    const existing = findDuplicateGroup(groups, name);
    if (existing?.status === "ARCHIVED") {
      toast.error(ARCHIVED_DUPLICATE_MESSAGE);
      return false;
    }
    if (existing) {
      toast.info(`Đã dùng bộ tài liệu hiện có: ${existing.name}`);
      return existing.id;
    }
    try {
      return (await createMaterialGroup({ name }, demo)).id;
    } catch (error) {
      toast.error(error instanceof ApiError && isDuplicateGroupError(error.status, error.errorCode) ? DUPLICATE_MESSAGE : writeErrorMessage(error, "Không thể tạo bộ tài liệu mới"));
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
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      setUploadProgress(0);
      let fileId: string;
      try {
        fileId = (await uploadFile(file, setUploadProgress)).fileId;
      } catch (error) {
        toast.error(uploadErrorMessage(error));
        return false;
      } finally {
        setUploadProgress(null);
      }
      const groupTarget = await resolveGroupId(values.groupSelection, values.newGroupName);
      if (groupTarget === false) return false;
      const payload: CreateLessonMaterialRequest = { title, description: values.description.trim() || undefined, category: values.category, type: values.type, fileId, groupId: groupTarget };
      try {
        await createMaterial(payload, demo);
      } catch (error) {
        toast.error(writeErrorMessage(error, "Không thể thêm tài liệu học tập"));
        return false;
      }
      toast.success("Đã thêm tài liệu học tập");
      reloadAll();
      return true;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const changeStatus = async (material: LessonMaterial, next: LessonMaterialStatus): Promise<boolean> => {
    setTransitioningId(material.id);
    try {
      await updateMaterialStatus(material.id, { status: next }, demo);
      toast.success(`Đã chuyển tài liệu sang trạng thái ${LESSON_MATERIAL_STATUS_LABELS[next]}`);
      reloadAll();
      return true;
    } catch (error) {
      if (error instanceof ApiError && isInvalidTransitionError(error.status, error.errorCode)) {
        toast.error("Trạng thái chuyển đổi không còn hợp lệ. Danh sách đã được tải lại.");
        reloadAll();
      } else {
        toast.error(writeErrorMessage(error, "Không thể cập nhật trạng thái tài liệu"));
      }
      return false;
    } finally {
      setTransitioningId(null);
    }
  };

  // ---- thêm hàng loạt: tải từng tệp lên repo-storage rồi POST /materials/bulk cho các tệp thành công ----
  const startBulk = async (items: BulkFileItem[], groupSelection: string, newGroupName: string) => {
    if (items.length === 0) return;
    if (items.some((item) => !item.title.trim())) {
      toast.error("Vui lòng nhập tên cho tất cả tài liệu");
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const current: BulkFileItem[] = items.map((item) => ({ ...item, uploadStatus: "idle", fileId: "", errorMessage: "" }));
    const publish = (progress: BulkState["progress"]) => setBulk({ phase: "processing", items: [...current], progress, result: null });
    try {
      publish({ current: 0, total: items.length, phase: "Đang chuẩn bị..." });
      const groupTarget = await resolveGroupId(groupSelection, newGroupName);
      if (groupTarget === false) {
        setBulk(IDLE_BULK);
        return;
      }
      for (let i = 0; i < current.length; i += 1) {
        const item = current[i];
        current[i] = { ...item, uploadStatus: "uploading" };
        publish({ current: i + 1, total: current.length, phase: `Đang tải tệp lên kho: ${item.file.name} (${i + 1}/${current.length})` });
        try {
          const meta = await uploadFile(item.file);
          current[i] = { ...current[i], uploadStatus: "uploaded", fileId: meta.fileId };
        } catch (error) {
          current[i] = { ...current[i], uploadStatus: "error", errorMessage: uploadErrorMessage(error) };
        }
      }
      const uploaded = current.filter((item) => item.uploadStatus === "uploaded" && item.fileId);
      const uploadErrors = uploadFailureErrors(current);
      if (uploaded.length === 0) {
        toast.error("Không có tệp nào được tải lên thành công");
        setBulk({ phase: "done", items: [...current], progress: { current: current.length, total: current.length, phase: "" }, result: { created: [], errors: uploadErrors, totalRequested: current.length, totalCreated: 0, totalFailed: current.length } });
        return;
      }
      publish({ current: current.length, total: current.length, phase: `Đang tạo ${uploaded.length} tài liệu...` });
      let result: BulkCreateMaterialResult;
      try {
        result = await bulkCreateMaterials(
          uploaded.map((item) => ({ title: item.title.trim(), category: item.category, type: item.type, fileId: item.fileId, groupId: groupTarget })),
          demo,
        );
      } catch (error) {
        toast.error(writeErrorMessage(error, "Không thể tạo tài liệu hàng loạt"));
        setBulk(IDLE_BULK);
        return;
      }
      const merged: BulkCreateMaterialResult = { ...result, errors: [...(result.errors ?? []), ...uploadErrors], totalRequested: current.length, totalFailed: result.totalFailed + uploadErrors.length };
      if (merged.totalCreated > 0) toast.success(`Đã tạo ${merged.totalCreated}/${merged.totalRequested} tài liệu`);
      if (merged.totalFailed > 0) toast.error(`${merged.totalFailed} tài liệu gặp lỗi`);
      setBulk({ phase: "done", items: [...current], progress: { current: current.length, total: current.length, phase: "" }, result: merged });
      if (merged.totalCreated > 0) reloadAll();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return {
    state: all.state,
    groups,
    materials,
    refreshing: all.state.kind === "loading" && all.lastData !== null,
    reload: all.reload,
    writeEnabled,
    storageConfigured,
    busy,
    uploadProgress,
    transitioningId,
    selection,
    selectedGroup,
    detailState,
    select: (next: MaterialSelection) => setSelection(next),
    retryDetail: groupDetail.reload,
    saveGroup,
    toggleGroupArchive,
    createOne,
    changeStatus,
    bulk,
    startBulk,
    resetBulk: () => setBulk(IDLE_BULK),
  };
}

export type LessonMaterials = ReturnType<typeof useLessonMaterials>;
