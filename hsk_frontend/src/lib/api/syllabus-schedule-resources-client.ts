"use client";

// "Module ôn luyện theo buổi" của giáo trình THẬT — thích nghi theo cơ chế IELTS (frontend/src/components/management/package-editor/
// use-package-resources.ts): không có entity "module" riêng, chỉ là LearningResource được COPY từ Kho HSK (lms-content-client.ts/lms-quiz-client.ts/
// lms-grammar-client.ts) vào ContentPackage CỦA CHÍNH giáo trình đó (1 package/loại, tạo khi cần), tại sessionNo = vị trí buổi trong `schedule[]` + 1.
// Dùng lmsClient (repo-lms thật), không có backend mới. Xem docs/api-requirements/syllabus-modules.md.
import { lmsClient } from "@/lib/api/lms-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { ScheduleResourceType } from "@/lib/syllabus/schedule-resource-types";
import type { PageResponse } from "@/types/lms";

const FEATURE = "content";

interface BackendPackageVersion {
  id: string;
  title: string | null;
}
interface BackendPackage {
  id: string;
  type: string;
  syllabusId?: string | null;
  draftVersionId: string | null;
  publishedVersionId: string | null;
}
interface BackendLearningResource {
  id: string;
  type: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: unknown;
}
export interface ScheduleResourceLink {
  id: string;
  learningResourceId: string;
  learningResourceVersionId: string;
  sessionNo: number;
  displayOrder: number;
  resourceType: string;
  publication?: "DRAFT" | "PUBLISHED";
  resourceTitle?: string;
  assessmentType?: string;
  contentPackageVersionId?: string;
  resourceContent: unknown;
}

function syllabusVersionIdOf(syllabusId: string): string {
  return `${syllabusId}-v1`;
}

/** Package của CHÍNH giáo trình theo loại — tạo mới nếu chưa có (1 package/loại/giáo trình). */
async function ensureSyllabusPackage(syllabusId: string, type: ScheduleResourceType): Promise<BackendPackage> {
  const existing = await lmsClient.get<PageResponse<BackendPackage>>(`/content-packages?type=${type}&syllabusId=${encodeURIComponent(syllabusId)}&size=1`);
  if (existing.items.length > 0) return existing.items[0];
  return lmsClient.post<BackendPackage>("/content-packages", {
    type,
    syllabusId,
    syllabusVersionId: syllabusVersionIdOf(syllabusId),
    title: `Module ôn luyện — ${type}`,
  });
}

async function ensureDraftVersionId(packageId: string): Promise<string> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  if (pkg.draftVersionId) return pkg.draftVersionId;
  const draft = await lmsClient.post<BackendPackageVersion>(`/content-packages/${encodeURIComponent(packageId)}/draft`);
  return draft.id;
}

/** Resource đã gắn vào buổi (sessionNo) của giáo trình, theo 1 loại; package chưa tồn tại => []. */
export async function listScheduleResources(syllabusId: string, type: ScheduleResourceType, sessionNo: number): Promise<ScheduleResourceLink[]> {
  const found = await lmsClient.get<PageResponse<BackendPackage>>(`/content-packages?type=${type}&syllabusId=${encodeURIComponent(syllabusId)}&size=1`);
  const pkg = found.items[0];
  const versionId = pkg ? pkg.draftVersionId ?? pkg.publishedVersionId : null;
  if (!versionId) return [];
  const resources=await lmsClient.get<ScheduleResourceLink[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources?sessionNo=${sessionNo}`);
  return resources.map(resource=>({...resource,publication:pkg.draftVersionId ? "DRAFT" : "PUBLISHED"}));
}

export interface AttachFailure {
  label: string;
  message: string;
}
export interface AttachResult {
  added: number;
  failed: AttachFailure[];
}

const errorText = (err: unknown) => (err instanceof Error && err.message) || "Không thể kết nối máy chủ";

/**
 * Copy TỪNG mục đã chọn trong Kho (sourceResourceId) thành 1 LearningResource riêng của package giáo trình rồi gắn vào buổi — đúng kỹ thuật
 * copy-on-attach của `usePackageResources.attachCopies` (IELTS). Mục lỗi không làm dừng các mục còn lại; tạo resource xong mà gắn lỗi thì xoá
 * resource vừa tạo (không để bản mồ côi).
 */
export async function attachLibraryItemsToSchedule(
  syllabusId: string,
  type: ScheduleResourceType,
  sessionNo: number,
  sources: { id: string; label: string }[],
  demo: boolean,
): Promise<AttachResult> {
  assertWriteEnabled(FEATURE, demo);
  const pkg = await ensureSyllabusPackage(syllabusId, type);
  const versionId = await ensureDraftVersionId(pkg.id);
  const existing = await lmsClient.get<ScheduleResourceLink[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources?sessionNo=${sessionNo}`);
  let nextOrder = existing.length ? Math.max(...existing.map((r) => r.displayOrder)) + 1 : 0;

  const result: AttachResult = { added: 0, failed: [] };
  for (const src of sources) {
    let created: BackendLearningResource | null = null;
    try {
      const source = await lmsClient.get<BackendLearningResource>(`/learning-resources/${encodeURIComponent(src.id)}`);
      created = await lmsClient.post<BackendLearningResource>("/learning-resources", {
        type: source.type,
        content: source.content,
        publishImmediately: true,
        inLibrary: false,
        sourceResourceId: src.id,
      });
      const resourceVersionId = created.publishedVersionId ?? created.draftVersionId;
      if (!resourceVersionId) throw new Error("Không lấy được phiên bản của tài nguyên vừa tạo.");
      await lmsClient.post(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`, {
        learningResourceId: created.id,
        learningResourceVersionId: resourceVersionId,
        sessionNo,
        displayOrder: nextOrder++,
      });
      result.added++;
    } catch (err) {
      if (created) await lmsClient.delete(`/learning-resources/${encodeURIComponent(created.id)}`).catch(() => undefined);
      result.failed.push({ label: src.label, message: errorText(err) });
    }
  }
  return result;
}

export async function reorderScheduleResources(syllabusId: string, type: ScheduleResourceType, sessionNo: number, resourceIdsInOrder: string[], demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const pkg = await ensureSyllabusPackage(syllabusId, type);
  const versionId = await ensureDraftVersionId(pkg.id);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/reorder`, { sessionNo, learningResourceIdsInOrder: resourceIdsInOrder });
}

export async function removeScheduleResource(syllabusId: string, type: ScheduleResourceType, resourceId: string, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const pkg = await ensureSyllabusPackage(syllabusId, type);
  const versionId = await ensureDraftVersionId(pkg.id);
  await lmsClient.delete(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}`);
}
