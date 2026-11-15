"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError } from "@/lib/api/api-client";
import {
  assignScheduleResourceTopic,
  attachLibraryItemsToSchedule,
  createScheduleTopic,
  deleteScheduleTopic,
  listScheduleResources,
  listScheduleTopics,
  removeScheduleResource,
  renameScheduleTopic,
  reorderScheduleResources,
  reorderScheduleTopics,
  type ScheduleResourceLink,
  type ScheduleTopic,
} from "@/lib/api/syllabus-schedule-resources-client";
import { SCHEDULE_RESOURCE_TYPES, type ScheduleResourceType } from "@/lib/syllabus/schedule-resource-types";

/** Thứ tự id (learningResourceId) mới sau khi đưa 1 resource lên (-1) / xuống (+1) trong cùng buổi×loại; không di chuyển được => null. */
export function movedResourceIds(links: readonly ScheduleResourceLink[], resourceId: string, direction: -1 | 1): string[] | null {
  const ordered = [...links].sort((a, b) => a.displayOrder - b.displayOrder);
  const from = ordered.findIndex((l) => l.learningResourceId === resourceId);
  if (from < 0) return null;
  const to = from + direction;
  if (to < 0 || to >= ordered.length) return null;
  const ids = ordered.map((l) => l.learningResourceId);
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  return ids;
}

/**
 * Như movedResourceIds nhưng chỉ đổi chỗ với module liền kề CÙNG chủ đề (cùng topicId, kể cả cùng "không chủ đề"), vì màn hình hiển thị theo nhóm.
 * Trả về thứ tự đầy đủ của buổi×loại (reorder cần đủ danh sách); không có hàng xóm cùng nhóm => null.
 */
export function movedResourceIdsInTopic(links: readonly ScheduleResourceLink[], resourceId: string, direction: -1 | 1): string[] | null {
  const ordered = [...links].sort((a, b) => a.displayOrder - b.displayOrder);
  const from = ordered.findIndex((l) => l.learningResourceId === resourceId);
  if (from < 0) return null;
  const topic = ordered[from].topicId ?? null;
  let to = from + direction;
  while (to >= 0 && to < ordered.length && (ordered[to].topicId ?? null) !== topic) to += direction;
  if (to < 0 || to >= ordered.length) return null;
  const ids = ordered.map((l) => l.learningResourceId);
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/** scheduleId => loại => resource đã gắn (sắp theo displayOrder). */
export type ScheduleResourcesMap = Readonly<Record<string, Readonly<Record<ScheduleResourceType, ScheduleResourceLink[]>>>>;

/**
 * Module ôn luyện của MỌI buổi × MỌI loại trong giáo trình (một lời gọi mỗi buổi×loại, song song). `syllabusId`/`sessionNoOf` = null (chưa mở tab
 * Lịch trình / chưa có chi tiết) => không gọi. Một buổi×loại lỗi => cả khối lỗi + "Thử lại" (như use-schedule-modules.ts cũ).
 */
export function useScheduleResources(syllabusId: string | null, scheduleIds: readonly string[] | null, sessionNoOf: ((scheduleId: string) => number) | null) {
  const key = syllabusId === null || scheduleIds === null ? null : `schedule-resources:${syllabusId}:${scheduleIds.join("|")}`;
  return useKeyedFetch<ScheduleResourcesMap>(key, async () => {
    const entries = await Promise.all(
      (scheduleIds ?? []).map(async (scheduleId) => {
        const sessionNo = sessionNoOf ? sessionNoOf(scheduleId) : 1;
        const byType = await Promise.all(
          SCHEDULE_RESOURCE_TYPES.map(async (type) => {
            const links = await listScheduleResources(syllabusId as string, type, sessionNo);
            if (!Array.isArray(links)) throw new ApiError("Dữ liệu module ôn luyện trả về không đúng định dạng.", 200);
            return [type, [...links].sort((a, b) => a.displayOrder - b.displayOrder)] as const;
          }),
        );
        return [scheduleId, Object.fromEntries(byType)] as const;
      }),
    );
    return Object.fromEntries(entries) as ScheduleResourcesMap;
  });
}

/** scheduleId => loại => chủ đề của buổi (kể cả chủ đề rỗng), sắp theo topicOrder. */
export type ScheduleTopicsMap = Readonly<Record<string, Readonly<Record<ScheduleResourceType, ScheduleTopic[]>>>>;

/** Cùng khoá và điều kiện tải như useScheduleResources; tách riêng để lỗi chủ đề không làm hỏng danh sách module. */
export function useScheduleTopics(syllabusId: string | null, scheduleIds: readonly string[] | null, sessionNoOf: ((scheduleId: string) => number) | null) {
  const key = syllabusId === null || scheduleIds === null ? null : `schedule-topics:${syllabusId}:${scheduleIds.join("|")}`;
  return useKeyedFetch<ScheduleTopicsMap>(key, async () => {
    const entries = await Promise.all(
      (scheduleIds ?? []).map(async (scheduleId) => {
        const sessionNo = sessionNoOf ? sessionNoOf(scheduleId) : 1;
        const byType = await Promise.all(SCHEDULE_RESOURCE_TYPES.map(async (type) => [type, await listScheduleTopics(syllabusId as string, type, sessionNo)] as const));
        return [scheduleId, Object.fromEntries(byType)] as const;
      }),
    );
    return Object.fromEntries(entries) as ScheduleTopicsMap;
  });
}

/** Thao tác ghi trên module của một buổi: khoá nút của buổi đó trong lúc chạy, toast kết quả, rồi `onChanged()` để tải lại danh sách. */
export function useScheduleResourceActions(demoActive: boolean, onChanged: () => void) {
  const [busyScheduleId, setBusyScheduleId] = useState<string | null>(null);

  const run = useCallback(
    async (scheduleId: string, action: () => Promise<unknown>, successText: string, failText: string): Promise<boolean> => {
      setBusyScheduleId(scheduleId);
      try {
        await action();
        toast.success(successText);
        onChanged();
        return true;
      } catch (error) {
        toast.error((error instanceof ApiError && error.message) || failText);
        return false;
      } finally {
        setBusyScheduleId(null);
      }
    },
    [onChanged],
  );

  /** Thêm nhiều mục cùng lúc: toast riêng cho số mục thêm được + từng mục lỗi (như reportAttach/attachCopies của IELTS); trả về true (đóng hộp) chỉ khi không mục nào lỗi. */
  const add = useCallback(
    async (syllabusId: string, scheduleId: string, type: ScheduleResourceType, sessionNo: number, sources: { id: string; label: string }[], topicId: string | null = null): Promise<boolean> => {
      setBusyScheduleId(scheduleId);
      try {
        const result = await attachLibraryItemsToSchedule(syllabusId, type, sessionNo, sources, demoActive, topicId);
        if (result.added > 0) toast.success(`Đã thêm ${result.added} mục vào buổi.`);
        result.failed.forEach((f) => toast.error(`Không thêm được "${f.label}": ${f.message}`));
        if (result.added > 0) onChanged();
        return result.failed.length === 0;
      } catch (error) {
        toast.error((error instanceof ApiError && error.message) || "Không thể thêm module");
        return false;
      } finally {
        setBusyScheduleId(null);
      }
    },
    [demoActive, onChanged],
  );

  return useMemo(
    () => ({
      busyScheduleId,
      add,
      reorder: (syllabusId: string, scheduleId: string, type: ScheduleResourceType, sessionNo: number, ids: string[]) =>
        run(scheduleId, () => reorderScheduleResources(syllabusId, type, sessionNo, ids, demoActive), "Đã cập nhật thứ tự học module", "Không thể cập nhật thứ tự module"),
      remove: (syllabusId: string, scheduleId: string, type: ScheduleResourceType, resourceId: string) =>
        run(scheduleId, () => removeScheduleResource(syllabusId, type, resourceId, demoActive), "Đã xóa module", "Không thể xóa module"),
      createTopic: (syllabusId: string, scheduleId: string, type: ScheduleResourceType, sessionNo: number, title: string) =>
        run(scheduleId, () => createScheduleTopic(syllabusId, type, sessionNo, title, demoActive), "Đã tạo chủ đề", "Không thể tạo chủ đề"),
      renameTopic: (syllabusId: string, scheduleId: string, type: ScheduleResourceType, topicId: string, title: string) =>
        run(scheduleId, () => renameScheduleTopic(syllabusId, type, topicId, title, demoActive), "Đã đổi tên chủ đề", "Không thể đổi tên chủ đề"),
      deleteTopic: (syllabusId: string, scheduleId: string, type: ScheduleResourceType, topicId: string) =>
        run(scheduleId, () => deleteScheduleTopic(syllabusId, type, topicId, demoActive), "Đã xóa chủ đề", "Không thể xóa chủ đề"),
      reorderTopics: (syllabusId: string, scheduleId: string, type: ScheduleResourceType, sessionNo: number, ids: string[]) =>
        run(scheduleId, () => reorderScheduleTopics(syllabusId, type, sessionNo, ids, demoActive), "Đã cập nhật thứ tự chủ đề", "Không thể cập nhật thứ tự chủ đề"),
      assignTopic: (syllabusId: string, scheduleId: string, type: ScheduleResourceType, resourceId: string, topicId: string | null) =>
        run(scheduleId, () => assignScheduleResourceTopic(syllabusId, type, resourceId, topicId, demoActive), "Đã chuyển module sang chủ đề", "Không thể chuyển chủ đề"),
    }),
    [busyScheduleId, add, demoActive, run],
  );
}
