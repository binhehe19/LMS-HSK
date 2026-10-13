"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getSyllabus, listSyllabusVersions } from "@/lib/api/lms-syllabus-client";
import type { SyllabusDetailResponse, SyllabusVersionResponse } from "@/types/lms";

/**
 * Chi tiết + danh sách phiên bản của một giáo trình (hai lời gọi độc lập: phiên bản lỗi không che chi tiết). `syllabusId = null` => không gọi.
 * Khoá theo id: đổi giáo trình => bỏ phản hồi của giáo trình cũ.
 */
export function useSyllabusDetail(syllabusId: string | null) {
  const detail = useKeyedFetch<SyllabusDetailResponse>(syllabusId === null ? null : `syllabus:${syllabusId}`, async () => {
    try {
      const data = await getSyllabus(syllabusId as string);
      if (!data || typeof data !== "object" || typeof data.id !== "string") throw new ApiError("Dữ liệu giáo trình trả về không đúng định dạng.", 200);
      return data;
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không thể tải chi tiết syllabus");
      throw error;
    }
  });
  const versions = useKeyedFetch<SyllabusVersionResponse[]>(syllabusId === null ? null : `syllabus-versions:${syllabusId}`, () => listSyllabusVersions(syllabusId as string));

  const reloadDetail = detail.reload;
  const reloadVersions = versions.reload;
  const reload = useCallback(() => {
    reloadDetail();
    reloadVersions();
  }, [reloadDetail, reloadVersions]);

  return { detail: detail.state, versions: versions.state, reload, reloadVersions };
}
