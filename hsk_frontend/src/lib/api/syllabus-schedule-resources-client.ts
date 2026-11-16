"use client";

// "Module ôn luyện theo buổi" của giáo trình THẬT — thích nghi theo cơ chế IELTS (frontend/src/components/management/package-editor/
// use-package-resources.ts): không có entity "module" riêng, chỉ là LearningResource được COPY từ Kho HSK (lms-content-client.ts/lms-quiz-client.ts/
// lms-grammar-client.ts) vào ContentPackage CỦA CHÍNH giáo trình đó (1 package/loại, tạo khi cần), tại sessionNo = vị trí buổi trong `schedule[]` + 1.
// Dùng lmsClient (repo-lms thật), không có backend mới. Xem docs/api-requirements/syllabus-modules.md.
import { lmsClient } from "@/lib/api/lms-client";
import { listSyllabusVersions } from "@/lib/api/lms-syllabus-client";
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
  /** Học liệu nguồn của mục này (nếu nó là bản sao). */
  sourceResourceId?: string | null;
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
  subType?: string;
  skill?: string;
  contentPackageVersionId?: string;
  /** Chủ đề (nhóm) trong buổi; cả ba null/thiếu = không chủ đề. */
  topicId?: string | null;
  topicTitle?: string | null;
  topicOrder?: number | null;
  resourceContent: unknown;
}
/** Chủ đề của một buổi trong học phần của một loại (mỗi loại học liệu có học phần riêng nên chủ đề cũng theo loại). */
export interface ScheduleTopic {
  id: string;
  contentPackageVersionId: string;
  sessionNo: number;
  title: string;
  topicOrder: number;
}

/** Phiên bản hiện tại của giáo trình: bản PUBLISHED, không có thì bản đầu tiên (cùng cách `currentSyllabusVersionId` của IELTS). */
async function currentSyllabusVersionId(syllabusId: string): Promise<string> {
  const versions = await listSyllabusVersions(syllabusId);
  const version = versions.find((v) => v.status === "PUBLISHED") ?? versions[0];
  if (!version) throw new Error("Giáo trình chưa có phiên bản nào");
  return version.id;
}

/** Package của CHÍNH giáo trình theo loại — tạo mới nếu chưa có (1 package/loại/giáo trình). */
async function ensureSyllabusPackage(syllabusId: string, type: ScheduleResourceType): Promise<BackendPackage> {
  const existing = await lmsClient.get<PageResponse<BackendPackage>>(`/content-packages?type=${type}&syllabusId=${encodeURIComponent(syllabusId)}&size=1`);
  if (existing.items.length > 0) return existing.items[0];
  return lmsClient.post<BackendPackage>("/content-packages", {
    type,
    syllabusId,
    syllabusVersionId: await currentSyllabusVersionId(syllabusId),
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
export type ScheduleReadResourceType = ScheduleResourceType | "SLIDE" | "MATERIAL";

export async function listScheduleResources(syllabusId: string, type: ScheduleReadResourceType, sessionNo: number): Promise<ScheduleResourceLink[]> {
  // A syllabus can contain several packages of the same type. A newly created empty
  // package must not hide resources already attached to another package.
  const packages: BackendPackage[] = [];
  for (let page = 0; ; page++) {
    const found = await lmsClient.get<PageResponse<BackendPackage>>(`/content-packages?type=${type}&syllabusId=${encodeURIComponent(syllabusId)}&page=${page}&size=100`);
    packages.push(...found.items);
    if (page + 1 >= found.total_pages || found.items.length === 0) break;
  }
  const resources: ScheduleResourceLink[] = [];
  const seen = new Set<string>();
  for (const pkg of packages) {
    const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
    if (!versionId) continue;
    const rows = await lmsClient.get<ScheduleResourceLink[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources?sessionNo=${sessionNo}`);
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      resources.push({...row, contentPackageVersionId:row.contentPackageVersionId || versionId, publication:pkg.draftVersionId ? "DRAFT" : "PUBLISHED"});
    }
  }
  return resources;
}

/** Chủ đề (kể cả rỗng) của một buổi, gộp từ mọi học phần cùng loại của giáo trình; sắp theo topicOrder. */
export async function listScheduleTopics(syllabusId: string, type: ScheduleResourceType, sessionNo: number): Promise<ScheduleTopic[]> {
  const topics: ScheduleTopic[] = [];
  for (let page = 0; ; page++) {
    const found = await lmsClient.get<PageResponse<BackendPackage>>(`/content-packages?type=${type}&syllabusId=${encodeURIComponent(syllabusId)}&page=${page}&size=100`);
    for (const pkg of found.items) {
      const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
      if (!versionId) continue;
      const rows = await lmsClient.get<Omit<ScheduleTopic, "contentPackageVersionId">[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/topics?sessionNo=${sessionNo}`);
      topics.push(...rows.map((t) => ({ ...t, contentPackageVersionId: versionId })));
    }
    if (page + 1 >= found.total_pages || found.items.length === 0) break;
  }
  return topics.sort((a, b) => a.topicOrder - b.topicOrder);
}

/** Phiên bản nháp của học phần (cùng loại) mà mọi thao tác ghi trên giáo trình đang dùng. */
async function draftVersionOf(syllabusId: string, type: ScheduleResourceType): Promise<string> {
  const pkg = await ensureSyllabusPackage(syllabusId, type);
  return ensureDraftVersionId(pkg.id);
}

export async function createScheduleTopic(syllabusId: string, type: ScheduleResourceType, sessionNo: number, title: string, demo: boolean): Promise<ScheduleTopic> {
  assertWriteEnabled(FEATURE, demo);
  const versionId = await draftVersionOf(syllabusId, type);
  const created = await lmsClient.post<Omit<ScheduleTopic, "contentPackageVersionId">>(`/content-packages/versions/${encodeURIComponent(versionId)}/topics`, { sessionNo, title });
  return { ...created, contentPackageVersionId: versionId };
}

export async function renameScheduleTopic(syllabusId: string, type: ScheduleResourceType, topicId: string, title: string, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const versionId = await draftVersionOf(syllabusId, type);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/topics/${encodeURIComponent(topicId)}`, { title });
}

export async function deleteScheduleTopic(syllabusId: string, type: ScheduleResourceType, topicId: string, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const versionId = await draftVersionOf(syllabusId, type);
  await lmsClient.delete(`/content-packages/versions/${encodeURIComponent(versionId)}/topics/${encodeURIComponent(topicId)}`);
}

export async function reorderScheduleTopics(syllabusId: string, type: ScheduleResourceType, sessionNo: number, topicIdsInOrder: string[], demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const versionId = await draftVersionOf(syllabusId, type);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/topics/reorder`, { sessionNo, topicIdsInOrder });
}

/** topicId null = bỏ khỏi chủ đề. */
export async function assignScheduleResourceTopic(syllabusId: string, type: ScheduleResourceType, resourceId: string, topicId: string | null, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const versionId = await draftVersionOf(syllabusId, type);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}/topic`, { topicId });
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
  topicId: string | null = null,
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
        // Nguồn là BẢN GỐC: mục chọn từ bộ trong Kho có thể đã là bản sao (vd từ vựng sao chép từ từ điển), khi đó trỏ tiếp về từ điển để đồng bộ
        // và sao chép tiến độ đi tới bản ở buổi học. Mục không có nguồn (ngữ pháp, bài tập, tài liệu soạn trong gói) thì nguồn là chính nó.
        sourceResourceId: source.sourceResourceId ?? src.id,
      });
      const resourceVersionId = created.publishedVersionId ?? created.draftVersionId;
      if (!resourceVersionId) throw new Error("Không lấy được phiên bản của tài nguyên vừa tạo.");
      await lmsClient.post(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`, {
        learningResourceId: created.id,
        learningResourceVersionId: resourceVersionId,
        sessionNo,
        displayOrder: nextOrder++,
        topicId,
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
