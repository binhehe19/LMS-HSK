// Giáo trình từ backend chung (repo-lms SyllabusController, proxy chỉ đọc từ ERP IELTS backup-erp.thespace.edu.vn; chỉ cần đã đăng nhập — backend chung
// không giới hạn role). Dùng chính thức nguồn này cho hsk_frontend (quyết định giữ nguyên, không chờ ERP riêng của HSK nữa —
// luồng /hsk-syllabuses + HskCmsClient bên repo-lms đã bị loại bỏ).
"use client";

import { ApiError } from "@/lib/api/api-client";
import { lmsClient } from "@/lib/api/lms-client";
import { toast } from "sonner";
import type { SyllabusDetailResponse, SyllabusSummaryResponse, SyllabusVersionResponse } from "@/types/lms";

function assertArray<T>(data: unknown, what: string): T[] {
  if (!Array.isArray(data)) throw new ApiError(`Dữ liệu trả về không đúng định dạng ${what}.`, 200);
  return data as T[];
}

// repo-lms cache dữ liệu lấy từ ERP (lớp, buổi, học viên, giáo trình) trong Redis 5–15 phút (CacheConfig). Nút "Tải lại" của màn Lớp học và
// Giáo trình gọi requestCmsCacheEvict() để xoá cache rồi mới tải lại; các hàm đọc dữ liệu ERP bên dưới (và admin-class-source) chờ lệnh xoá
// đang chạy xong rồi mới gọi API, tránh lấy lại bản cũ khi xoá và tải chạy song song. POST /syllabuses/cache/evict chỉ cho ROLE_ADMIN và xoá
// TOÀN BỘ cache ERP (mọi người dùng), giống nút tải lại của frontend IELTS (evictCmsCache).
let pendingEvict: Promise<void> | null = null;

/** Bắt đầu xoá cache ERP ở backend. Lỗi không chặn việc tải lại: báo toast rồi vẫn đọc dữ liệu (có thể còn là bản cache). */
export function requestCmsCacheEvict(): Promise<void> {
  const run: Promise<void> = lmsClient
    .post<unknown>("/syllabuses/cache/evict")
    .then(() => undefined)
    .catch((error: unknown) => {
      toast.warning((error instanceof ApiError && error.message) || "Không xoá được bộ nhớ đệm", { description: "Dữ liệu hiển thị có thể chưa phải bản mới nhất." });
    })
    .finally(() => {
      if (pendingEvict === run) pendingEvict = null;
    });
  pendingEvict = run;
  return run;
}

/** Chờ lệnh xoá cache đang chạy (nếu có). */
export function waitForCmsCacheEvict(): Promise<void> {
  return pendingEvict ?? Promise.resolve();
}

export async function listSyllabuses(): Promise<SyllabusSummaryResponse[]> {
  await waitForCmsCacheEvict();
  return assertArray<SyllabusSummaryResponse>(await lmsClient.get<SyllabusSummaryResponse[]>("/syllabuses"), "danh sách giáo trình");
}

export async function getSyllabus(syllabusId: string): Promise<SyllabusDetailResponse> {
  await waitForCmsCacheEvict();
  return lmsClient.get<SyllabusDetailResponse>(`/syllabuses/${encodeURIComponent(syllabusId)}`);
}

export async function listSyllabusVersions(syllabusId: string): Promise<SyllabusVersionResponse[]> {
  await waitForCmsCacheEvict();
  return assertArray<SyllabusVersionResponse>(await lmsClient.get<SyllabusVersionResponse[]>(`/syllabuses/${encodeURIComponent(syllabusId)}/versions`), "phiên bản giáo trình");
}
