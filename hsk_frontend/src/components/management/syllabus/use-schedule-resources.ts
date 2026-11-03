"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError } from "@/lib/api/api-client";
import { attachLibraryItemsToSchedule, listScheduleResources, removeScheduleResource, reorderScheduleResources, type ScheduleResourceLink } from "@/lib/api/syllabus-schedule-resources-client";
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
    async (syllabusId: string, scheduleId: string, type: ScheduleResourceType, sessionNo: number, sources: { id: string; label: string }[]): Promise<boolean> => {
      setBusyScheduleId(scheduleId);
      try {
        const result = await attachLibraryItemsToSchedule(syllabusId, type, sessionNo, sources, demoActive);
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
    }),
    [busyScheduleId, add, demoActive, run],
  );
}
