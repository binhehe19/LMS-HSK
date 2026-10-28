// Lớp học / buổi học / ghi danh từ backend chung (repo-lms ClassController, proxy chỉ đọc từ ERP). Toàn bộ cần ROLE_ADMIN ở backend.
// Trạng thái: AVAILABLE (endpoint tồn tại trong source backend chung; CHƯA xác minh trên môi trường dev/staging nào — xem docs/FEATURE-STATUS.md).
"use client";

import { ApiError } from "@/lib/api/api-client";
import { lmsClient } from "@/lib/api/lms-client";
import type { ClassDetailResponse, ClassSessionResponse, ClassSummaryResponse, EnrollmentResponse, PageResponse } from "@/types/lms";

export interface ListClassesParams {
  keyword?: string;
  lifecycleStatus?: string;
  teacherId?: string;
  /** Đếm từ 0 (quy ước Spring). */
  page?: number;
  size?: number;
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** PageResponse không đúng hình dạng (vd. backend trả mảng trần hoặc HTML của proxy) bị coi là lỗi hợp đồng, không im lặng coi là rỗng. */
export function assertPageResponse<T>(data: unknown, what: string): PageResponse<T> {
  if (!data || typeof data !== "object" || !Array.isArray((data as PageResponse<T>).items)) {
    throw new ApiError(`Dữ liệu trả về không đúng định dạng ${what}.`, 200);
  }
  return data as PageResponse<T>;
}

function assertArray<T>(data: unknown, what: string): T[] {
  if (!Array.isArray(data)) throw new ApiError(`Dữ liệu trả về không đúng định dạng ${what}.`, 200);
  return data as T[];
}

/** GET /classes — phân trang phía server, lọc keyword/lifecycleStatus/teacherId (cache 5 phút ở backend). */
export async function listClasses(params: ListClassesParams = {}): Promise<PageResponse<ClassSummaryResponse>> {
  const data = await lmsClient.get<PageResponse<ClassSummaryResponse>>(`/classes${query({ ...params })}`);
  return assertPageResponse<ClassSummaryResponse>(data, "danh sách lớp");
}

/**
 * Toàn bộ lớp bằng cách duyệt trang (size 100, tối đa `maxPages`): màn /admin/class-management lọc/thống kê trên toàn bộ danh sách ở client như HSK cũ.
 * `truncated` = còn trang chưa lấy (quá maxPages) — giao diện phải nói rõ thay vì im lặng.
 */
export async function listAllClasses(maxPages = 20): Promise<{ items: ClassSummaryResponse[]; truncated: boolean }> {
  const items: ClassSummaryResponse[] = [];
  let page = 0;
  for (;;) {
    const res = await listClasses({ page, size: 100 });
    items.push(...res.items);
    page += 1;
    if (page >= res.total_pages || res.items.length === 0) return { items, truncated: false };
    if (page >= maxPages) return { items, truncated: true };
  }
}

export function getClass(classId: string): Promise<ClassDetailResponse> {
  return lmsClient.get<ClassDetailResponse>(`/classes/${encodeURIComponent(classId)}`);
}

export async function listClassSessions(classId: string): Promise<ClassSessionResponse[]> {
  const data = await lmsClient.get<ClassSessionResponse[]>(`/classes/${encodeURIComponent(classId)}/sessions`);
  return assertArray<ClassSessionResponse>(data, "danh sách buổi học");
}

export async function listClassEnrollments(classId: string, page = 0, size = 100): Promise<PageResponse<EnrollmentResponse>> {
  const data = await lmsClient.get<PageResponse<EnrollmentResponse>>(`/classes/${encodeURIComponent(classId)}/enrollments${query({ page, size })}`);
  return assertPageResponse<EnrollmentResponse>(data, "danh sách học viên");
}

export async function listAllClassEnrollments(classId: string, maxPages = 20): Promise<{ items: EnrollmentResponse[]; truncated: boolean }> {
  const items: EnrollmentResponse[] = [];
  let page = 0;
  for (;;) {
    const res = await listClassEnrollments(classId, page, 100);
    items.push(...res.items);
    page += 1;
    if (page >= res.total_pages || res.items.length === 0) return { items, truncated: false };
    if (page >= maxPages) return { items, truncated: true };
  }
}
