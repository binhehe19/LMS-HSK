"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError } from "@/lib/api/api-client";
import { createScheduleModule, deleteScheduleModule, listScheduleModules, reorderScheduleModules } from "@/lib/api/syllabus-modules-client";
import { moduleActionErrorMessage, sortModules } from "@/lib/syllabus/schedule-modules-model";
import type { CreateScheduleModuleRequest, ScheduleModule } from "@/types/syllabus-modules";

/** scheduleId => module đã sắp theo `order`. */
export type ScheduleModulesMap = Readonly<Record<string, ScheduleModule[]>>;

/**
 * Module ôn luyện của MỌI buổi trong giáo trình (một lời gọi mỗi buổi, song song — như loadScheduleModules của bản cũ). `scheduleIds = null`
 * (chưa mở tab Lịch trình / chưa có chi tiết) => không gọi. Bản cũ coi buổi lỗi là "[]" (che lỗi); ở đây một buổi lỗi => cả khối lỗi + "Thử lại".
 */
export function useScheduleModules(scheduleIds: readonly string[] | null) {
  const key = scheduleIds === null ? null : `schedule-modules:${scheduleIds.join("|")}`;
  return useKeyedFetch<ScheduleModulesMap>(key, async () => {
    const entries = await Promise.all(
      (scheduleIds ?? []).map(async (id) => {
        const data = await listScheduleModules(id);
        if (!Array.isArray(data)) throw new ApiError("Dữ liệu module ôn luyện trả về không đúng định dạng.", 200);
        return [id, sortModules(data)] as const;
      }),
    );
    return Object.fromEntries(entries);
  });
}

/**
 * Thao tác ghi trên module của một buổi: khoá các nút của buổi đó trong lúc chạy (`busyScheduleId`), toast kết quả (chữ như bản cũ), rồi `onChanged()`
 * để tải lại danh sách. Trả về true khi thành công (modal thêm dùng để tự đóng). Không bao giờ báo thành công khi request không được tạo.
 */
export function useScheduleModuleActions(demoActive: boolean, onChanged: () => void) {
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
        toast.error(moduleActionErrorMessage(error, failText));
        return false;
      } finally {
        setBusyScheduleId(null);
      }
    },
    [onChanged],
  );

  return useMemo(
    () => ({
      busyScheduleId,
      add: (body: CreateScheduleModuleRequest) => run(body.scheduleId, () => createScheduleModule(body, demoActive), "Đã thêm module", "Không thể thêm module"),
      reorder: (scheduleId: string, ids: string[]) => run(scheduleId, () => reorderScheduleModules(scheduleId, ids, demoActive), "Đã cập nhật thứ tự học module", "Không thể cập nhật thứ tự module"),
      remove: (scheduleId: string, moduleId: string) => run(scheduleId, () => deleteScheduleModule(moduleId, demoActive), "Đã xóa module", "Không thể xóa module"),
    }),
    [busyScheduleId, demoActive, run],
  );
}
