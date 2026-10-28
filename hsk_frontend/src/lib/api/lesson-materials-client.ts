// WAITING FOR BACKEND — Hàm gọi API màn Quản lý tài liệu học tập (/learning-path/lesson-materials/manage) theo HỢP ĐỒNG ĐỀ XUẤT, kế thừa đường dẫn
// `/lesson-materials/*` của lesson-materials.service.ts HSK cũ, qua base NEXT_PUBLIC_HSK_API_BASE_PATH (lib/api/hsk-client.ts). Backend chung có
// content-packages MATERIAL/SLIDE + repo-storage nhưng chưa map được "bộ tài liệu"/trạng thái => PARTIAL; production để trống biến => WAITING FOR
// BACKEND. Máy chủ giả lập: scripts/mock/handlers/lesson-materials.mjs. Hợp đồng chi tiết: docs/api-requirements/lesson-materials.md.
//
// Khác bản cũ có chủ đích: byte của tệp đi qua repo-storage của backend chung (`uploadFile` ở lib/api/storage-client.ts: presign → PUT → confirm) rồi
// chỉ gửi `fileId` cho dịch vụ tài liệu — bản cũ POST multipart lên `/storage/upload` của HSK. PATCH không có trong createApiClient nên đi thẳng
// `apiFetch` với cùng base (cùng cookie/Bearer/refresh một lần). Thao tác GHI qua công tắc an toàn (lib/api/write-gate.ts, miền "lesson-materials").
"use client";

import { ApiNotConfiguredError, apiFetch } from "@/lib/api/api-client";
import { hskClient } from "@/lib/api/hsk-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type {
  BulkCreateMaterialResult,
  CreateLessonMaterialGroupRequest,
  CreateLessonMaterialRequest,
  GroupedLessonMaterials,
  LessonMaterial,
  LessonMaterialGroup,
  LessonMaterialGroupStatus,
  LessonMaterialPage,
  LessonMaterialQuery,
  UpdateLessonMaterialGroupRequest,
  UpdateLessonMaterialStatusRequest,
} from "@/types/lesson-materials";

const enc = encodeURIComponent;
const FEATURE = "lesson-materials";
const GROUPS = "/lesson-materials/groups";
const MATERIALS = "/lesson-materials/materials";

async function hskPatch<T>(path: string, body: unknown): Promise<T> {
  const base = process.env.NEXT_PUBLIC_HSK_API_BASE_PATH?.trim().replace(/\/+$/, "");
  if (!base) throw new ApiNotConfiguredError();
  return apiFetch<T>(base, path, { method: "PATCH", body: JSON.stringify(body) });
}

/** Bộ tài liệu (ROLE_ADMIN). `status`/`search` rỗng thì không gửi, như bản cũ. */
export function listMaterialGroups(params: { status?: LessonMaterialGroupStatus; search?: string } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.search?.trim()) q.set("search", params.search.trim());
  const query = q.toString();
  return hskClient.get<LessonMaterialGroup[]>(query ? `${GROUPS}?${query}` : GROUPS);
}

export function listGroupMaterials(groupId: string) {
  return hskClient.get<GroupedLessonMaterials>(`${GROUPS}/${enc(groupId)}/materials`);
}

/** Danh sách tài liệu phân trang (màn quản lý gọi `size=200` một lần để đếm theo bộ, như bản cũ). */
export function listMaterials(query: LessonMaterialQuery = {}) {
  const q = new URLSearchParams();
  if (query.keyword) q.set("keyword", query.keyword);
  if (query.category) q.set("category", query.category);
  if (query.type) q.set("type", query.type);
  if (query.status) q.set("status", query.status);
  if (query.groupId) q.set("groupId", query.groupId);
  q.set("page", String(query.page ?? 0));
  q.set("size", String(query.size ?? 20));
  q.set("sort", query.sort ?? "createdAt,desc");
  return hskClient.get<LessonMaterialPage>(`${MATERIALS}?${q.toString()}`);
}

// ---- thao tác GHI (write gate "lesson-materials") ----

export function createMaterialGroup(body: CreateLessonMaterialGroupRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<LessonMaterialGroup>(GROUPS, body);
}

export function updateMaterialGroup(groupId: string, body: UpdateLessonMaterialGroupRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskPatch<LessonMaterialGroup>(`${GROUPS}/${enc(groupId)}`, body);
}

/** DELETE của bản cũ là LƯU TRỮ (status → ARCHIVED), không xoá dữ liệu; khôi phục bằng PATCH {status: "ACTIVE"}. */
export function archiveMaterialGroup(groupId: string, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.delete<LessonMaterialGroup>(`${GROUPS}/${enc(groupId)}`);
}

/** Tạo tài liệu từ `fileId` đã tải lên repo-storage; chỉ gửi các trường an toàn như bản cũ. */
export function createMaterial(body: CreateLessonMaterialRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<LessonMaterial>(MATERIALS, {
    title: body.title,
    description: body.description || undefined,
    category: body.category,
    type: body.type,
    fileId: body.fileId,
    groupId: body.groupId || undefined,
  });
}

export function bulkCreateMaterials(items: CreateLessonMaterialRequest[], demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<BulkCreateMaterialResult>(`${MATERIALS}/bulk`, { items });
}

export function updateMaterialStatus(materialId: string, body: UpdateLessonMaterialStatusRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskPatch<LessonMaterial>(`${MATERIALS}/${enc(materialId)}/status`, body);
}
