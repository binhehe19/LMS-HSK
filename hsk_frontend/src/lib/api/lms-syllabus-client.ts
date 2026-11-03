// Giáo trình từ backend chung (repo-lms SyllabusController, proxy chỉ đọc từ ERP IELTS backup-erp.thespace.edu.vn; chỉ cần đã đăng nhập — backend chung
// không giới hạn role). TẠM dùng lại nguồn này cho hsk_frontend (chưa phải syllabus thật của HSK) trong lúc chờ erp.hoc-ba.edu.vn whitelist repo-lms
// cho endpoint /hsk-syllabuses (xem HskSyllabusController + HskCmsClient bên repo-lms - giữ nguyên, sẵn sàng đổi lại khi được cấp quyền).
"use client";

import { ApiError } from "@/lib/api/api-client";
import { lmsClient } from "@/lib/api/lms-client";
import type { SyllabusDetailResponse, SyllabusSummaryResponse, SyllabusVersionResponse } from "@/types/lms";

function assertArray<T>(data: unknown, what: string): T[] {
  if (!Array.isArray(data)) throw new ApiError(`Dữ liệu trả về không đúng định dạng ${what}.`, 200);
  return data as T[];
}

export async function listSyllabuses(): Promise<SyllabusSummaryResponse[]> {
  return assertArray<SyllabusSummaryResponse>(await lmsClient.get<SyllabusSummaryResponse[]>("/syllabuses"), "danh sách giáo trình");
}

export function getSyllabus(syllabusId: string): Promise<SyllabusDetailResponse> {
  return lmsClient.get<SyllabusDetailResponse>(`/syllabuses/${encodeURIComponent(syllabusId)}`);
}

export async function listSyllabusVersions(syllabusId: string): Promise<SyllabusVersionResponse[]> {
  return assertArray<SyllabusVersionResponse>(await lmsClient.get<SyllabusVersionResponse[]>(`/syllabuses/${encodeURIComponent(syllabusId)}/versions`), "phiên bản giáo trình");
}
