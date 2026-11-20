"use client";

// Client "nối thật" màn Quản lý tài liệu học tập vào repo-lms có sẵn (ContentPackage + LearningResource), thay cho hợp đồng đề xuất cũ
// `/lesson-materials/*` (chưa có backend). Cùng cơ chế đã chạy cho Kho Flashcard/Quiz/Ngữ pháp (lms-content-client.ts/lms-quiz-client.ts/
// lms-grammar-client.ts): 1 "bộ tài liệu" = 1 ContentPackage (type SLIDE|MATERIAL), mỗi "tài liệu" = 1 LearningResource (content SlideMaterialContent)
// gắn vào bản DRAFT của package ở sessionNo cố định = 1 (tài liệu không thuộc buổi/giáo trình nào). Dùng lmsClient (base NEXT_PUBLIC_LMS_API_BASE_PATH),
// cùng write-gate "content" như Kho (đã enabled, không còn "lesson-materials" — xem docs/api-requirements/lesson-materials.md).
import { lmsClient } from "@/lib/api/lms-client";
import { listManagedPackages, syllabusBinding, type ManagedPackage } from "./package-management-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { CreateLessonMaterialGroupRequest, CreateLessonMaterialRequest, LessonMaterial, LessonMaterialGroup, LessonMaterialType, UpdateLessonMaterialGroupRequest } from "@/types/lesson-materials";

const FEATURE = "content";

interface BackendPackageVersion {
  id: string;
  title: string | null;
  description: string | null;
}
interface BackendPackage {
  id: string;
  type: string;
  syllabusId?: string | null;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  draftVersion: BackendPackageVersion | null;
  publishedVersion: BackendPackageVersion | null;
  createdAt?: string;
  updatedAt?: string;
}
interface SlideMaterialContent {
  title?: string;
  fileId: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
}
interface BackendLearningResource {
  id: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: SlideMaterialContent | null;
}
interface BackendPackageVersionResource {
  id: string;
  learningResourceId: string;
  learningResourceVersionId: string;
  displayOrder: number;
  resourceContent: SlideMaterialContent | null;
}
interface EditLockResponse {
  acquired: boolean;
  holderUserId?: string | null;
}

function toUiGroup(pkg: ManagedPackage, type: LessonMaterialType): LessonMaterialGroup {
  const version = pkg.draftVersion ?? pkg.publishedVersion;
  return {
    id: pkg.id,
    syllabusId: pkg.syllabusId,
    name: version?.title ?? "",
    description: version?.description ?? undefined,
    type,
    status: pkg.publishedVersionId ? "PUBLISHED" : "DRAFT",
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
}

function toUiMaterial(groupId: string, link: BackendPackageVersionResource): LessonMaterial {
  return {
    id: link.learningResourceId,
    title: link.resourceContent?.title || link.resourceContent?.fileName || "",
    fileId: link.resourceContent?.fileId ?? "",
    filename: link.resourceContent?.fileName,
    mimeType: link.resourceContent?.mimeType,
    sizeBytes: link.resourceContent?.sizeBytes,
    groupId,
    displayOrder: link.displayOrder,
  };
}

// ---- bộ tài liệu (ContentPackage) ----
export async function listMaterialGroups(): Promise<LessonMaterialGroup[]> {
  const types: LessonMaterialType[] = ["SLIDE", "MATERIAL"];
  // Các bộ của Kho: học phần tự do (chưa thuộc giáo trình nào).
  const lists = await Promise.all(types.map((type) => listManagedPackages(type)));
  return types.flatMap((type, i) => lists[i].map((pkg) => toUiGroup(pkg, type)));
}

export async function createMaterialGroup(input: CreateLessonMaterialGroupRequest, demo: boolean): Promise<LessonMaterialGroup> {
  assertWriteEnabled(FEATURE, demo);
  const pkg = await lmsClient.post<BackendPackage>("/content-packages", {
    type: input.type,
    ...await syllabusBinding(input.syllabusId),
    title: input.name,
    description: input.description || undefined,
  });
  return toUiGroup(pkg, input.type);
}

async function ensureDraftVersionId(packageId: string): Promise<string> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  if (pkg.draftVersionId) return pkg.draftVersionId;
  const draft = await lmsClient.post<BackendPackageVersion>(`/content-packages/${encodeURIComponent(packageId)}/draft`);
  return draft.id;
}

export async function updateMaterialGroup(groupId: string, type: LessonMaterialType, input: UpdateLessonMaterialGroupRequest, demo: boolean): Promise<LessonMaterialGroup> {
  assertWriteEnabled(FEATURE, demo);
  const versionId = await ensureDraftVersionId(groupId);
  await lmsClient.put(`/content-packages/${encodeURIComponent(groupId)}/versions/${encodeURIComponent(versionId)}`, { title: input.name, description: input.description || undefined });
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(groupId)}`);
  return toUiGroup(pkg, type);
}

export async function publishMaterialGroup(groupId: string, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const sessionToken = crypto.randomUUID();
  const lock = await lmsClient.post<EditLockResponse>(`/content-packages/${encodeURIComponent(groupId)}/lock`, { sessionToken });
  if (!lock.acquired) throw new Error("Không khoá được phiên chỉnh sửa (có thể người khác đang sửa bộ này).");
  const versionId = await ensureDraftVersionId(groupId);
  await lmsClient.post(`/content-packages/${encodeURIComponent(groupId)}/versions/${encodeURIComponent(versionId)}/publish?sessionToken=${encodeURIComponent(sessionToken)}`);
}

export async function unpublishMaterialGroup(groupId: string, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(groupId)}`);
  if (!pkg.publishedVersionId) return;
  await ensureDraftVersionId(groupId);
  await lmsClient.post(`/content-packages/${encodeURIComponent(groupId)}/versions/${encodeURIComponent(pkg.publishedVersionId)}/archive`);
}

/** Xoá thật cả bộ (package không có cờ lưu trữ mềm riêng). */
export async function deleteMaterialGroup(groupId: string, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  await lmsClient.delete(`/content-packages/${encodeURIComponent(groupId)}`);
}

// ---- tài liệu (LearningResource), phẳng trong bộ — sessionNo cố định = 1 ----
export async function listGroupMaterials(groupId: string, sessionNo = 1): Promise<LessonMaterial[]> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(groupId)}`);
  const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
  if (!versionId) return [];
  const links = await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources?sessionNo=${sessionNo}`);
  return links.map((link) => toUiMaterial(groupId, link)).sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function createMaterial(groupId: string, groupType: LessonMaterialType, groupPublished: boolean, input: CreateLessonMaterialRequest, demo: boolean, sessionNo = 1): Promise<LessonMaterial> {
  assertWriteEnabled(FEATURE, demo);
  const versionId = await ensureDraftVersionId(groupId);
  const content: SlideMaterialContent = { title: input.title, fileId: input.fileId, fileName: input.filename || input.title, mimeType: input.mimeType, sizeBytes: input.sizeBytes };
  const resource = await lmsClient.post<BackendLearningResource>("/learning-resources", {
    type: groupType,
    content,
    publishImmediately: groupPublished,
    inLibrary: false,
  });
  const existing = await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources?sessionNo=${sessionNo}`);
  const displayOrder = existing.length ? Math.max(...existing.map((r) => r.displayOrder)) + 1 : 0;
  const resourceVersionId = resource.publishedVersionId ?? resource.draftVersionId;
  await lmsClient.post(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`, { learningResourceId: resource.id, learningResourceVersionId: resourceVersionId, sessionNo, displayOrder });
  return toUiMaterial(groupId, { id: resource.id, learningResourceId: resource.id, learningResourceVersionId: resourceVersionId ?? "", displayOrder, resourceContent: resource.content });
}

export async function deleteMaterial(groupId: string, resourceId: string, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const versionId = await ensureDraftVersionId(groupId);
  await lmsClient.delete(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}`);
  await lmsClient.delete(`/learning-resources/${encodeURIComponent(resourceId)}`).catch(() => undefined);
}
