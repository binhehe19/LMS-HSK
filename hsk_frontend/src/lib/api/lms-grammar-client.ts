"use client";

// Client "nối thử" kho nội dung Ngữ pháp HSK vào repo-lms thật (LearningResource + ContentPackage có sẵn), thay cho content-tree-client.ts
// (trỏ NEXT_PUBLIC_HSK_API_BASE_PATH chưa có backend). Cùng mẫu với lms-content-client.ts (Flashcard).
//
// Mapping (đã chốt với người phụ trách): GrammarPoint HSK gộp vào LearningResourceType.GRAMMAR/ContentPackageType.GRAMMAR có sẵn, dùng GrammarContent:
// title/category/generalDefinition/structure/explanation giữ tên; note→usageNote (đổi tên, cùng nghĩa); exampleSentenceZh/Pinyin/Vi→1 phần tử
// examples[]{sentence: Zh, pronunciation: Pinyin, translation: Vi, exampleType: EXAMPLE} (tên trường khớp đúng GrammarContent.GrammarExampleItem
// của backend — sentence/translation, không phải sentenceEn/translationVi). hskLevel và linkedQuizStudySetId KHÔNG có chỗ lưu ở
// GrammarContent (không có field tương ứng) → TẠM BỎ QUA, không gửi lên, không đọc lại, cho tới khi có quyết định thêm field thật ở backend.
// Package→Folder→StudySet→Item rút gọn còn Package→resource (phẳng); sessionNo cố định = 1. syllabusId/syllabusVersionId dùng cặp đại diện cố định
// riêng cho ngữ pháp (khác cặp của flashcard, để không trộn 2 module khi liệt kê theo syllabusId).
import { lmsClient } from "@/lib/api/lms-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { ContentItemInput, ContentPackage, ContentPackageInput } from "@/types/content";
import type { PageResponse } from "@/types/lms";
import type { GrammarPoint, GrammarPointInput } from "@/types/content-grammar";

const PACKAGE_TYPE = "GRAMMAR";
const HSK_SYLLABUS_ID = "HSK-LIBRARY-GRAMMAR";
const HSK_SYLLABUS_VERSION_ID = "HSK-LIBRARY-GRAMMAR-V1";

// ---- shape thật của repo-lms (chỉ các trường dùng tới) ----
interface BackendPackageVersion {
  id: string;
  title: string | null;
  description: string | null;
}
interface BackendPackage {
  id: string;
  type: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  draftVersion: BackendPackageVersion | null;
  publishedVersion: BackendPackageVersion | null;
  createdAt?: string;
  updatedAt?: string;
}
interface GrammarExampleItem {
  exampleIndex?: number;
  exampleType?: "EXAMPLE" | "COMMON_MISTAKE";
  sentence?: string;
  translation?: string;
  pronunciation?: string;
}
interface GrammarContent {
  title: string;
  category?: string;
  generalDefinition?: string;
  structure?: string;
  explanation?: string;
  usageNote?: string;
  examples?: GrammarExampleItem[];
}
interface BackendLearningResource {
  id: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: GrammarContent | null;
}
interface BackendPackageVersionResource {
  id: string;
  learningResourceId: string;
  learningResourceVersionId: string;
  displayOrder: number;
  resourceContent: GrammarContent | null;
}
interface EditLockResponse {
  acquired: boolean;
  holderUserId?: string | null;
}

// ---- dịch field GrammarPoint <-> GrammarContent ----
function toGrammarContent(input: GrammarPointInput): GrammarContent {
  const example: GrammarExampleItem | null =
    input.exampleSentenceZh || input.exampleSentencePinyin || input.exampleSentenceVi
      ? { exampleIndex: 0, exampleType: "EXAMPLE", sentence: input.exampleSentenceZh || undefined, pronunciation: input.exampleSentencePinyin || undefined, translation: input.exampleSentenceVi || undefined }
      : null;
  return {
    title: input.title,
    category: input.category || undefined,
    generalDefinition: input.generalDefinition || undefined,
    structure: input.structure || undefined,
    explanation: input.explanation || undefined,
    usageNote: input.note || undefined,
    examples: example ? [example] : undefined,
  };
}

function fromGrammarContent(id: string, index: number, content: GrammarContent | null): GrammarPoint {
  const example = content?.examples?.[0];
  return {
    id,
    studySetId: "",
    index,
    title: content?.title ?? "",
    category: content?.category || undefined,
    generalDefinition: content?.generalDefinition || undefined,
    structure: content?.structure || undefined,
    explanation: content?.explanation || undefined,
    note: content?.usageNote || undefined,
    exampleSentenceZh: example?.sentence || undefined,
    exampleSentencePinyin: example?.pronunciation || undefined,
    exampleSentenceVi: example?.translation || undefined,
  };
}

function toUiPackage(pkg: BackendPackage): ContentPackage {
  const version = pkg.draftVersion ?? pkg.publishedVersion;
  return {
    id: pkg.id,
    name: version?.title ?? "",
    description: version?.description ?? undefined,
    type: PACKAGE_TYPE,
    publishStatus: pkg.publishedVersionId ? "PUBLISHED" : "DRAFT",
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
}

// ---- gói ----
export async function listGrammarPackages(): Promise<ContentPackage[]> {
  const res = await lmsClient.get<PageResponse<BackendPackage>>(`/content-packages?type=${PACKAGE_TYPE}&syllabusId=${encodeURIComponent(HSK_SYLLABUS_ID)}&size=200`);
  return (res.items ?? []).map(toUiPackage);
}

export async function createGrammarPackage(input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
  assertWriteEnabled("content", demo);
  const pkg = await lmsClient.post<BackendPackage>("/content-packages", {
    type: PACKAGE_TYPE,
    syllabusId: HSK_SYLLABUS_ID,
    syllabusVersionId: HSK_SYLLABUS_VERSION_ID,
    title: input.name,
    description: input.description || undefined,
  });
  return toUiPackage(pkg);
}

async function ensureDraftVersionId(packageId: string): Promise<string> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  if (pkg.draftVersionId) return pkg.draftVersionId;
  const draft = await lmsClient.post<BackendPackageVersion>(`/content-packages/${encodeURIComponent(packageId)}/draft`);
  return draft.id;
}

export async function updateGrammarPackage(packageId: string, input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.put(`/content-packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}`, {
    title: input.name,
    description: input.description || undefined,
  });
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  return toUiPackage(pkg);
}

export async function deleteGrammarPackage(packageId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  await lmsClient.delete(`/content-packages/${encodeURIComponent(packageId)}`);
}

export async function publishGrammarPackage(packageId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const sessionToken = crypto.randomUUID();
  const lock = await lmsClient.post<EditLockResponse>(`/content-packages/${encodeURIComponent(packageId)}/lock`, { sessionToken });
  if (!lock.acquired) throw new Error("Không khoá được phiên chỉnh sửa (có thể người khác đang sửa gói này).");
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.post(`/content-packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}/publish?sessionToken=${encodeURIComponent(sessionToken)}`);
}

export async function unpublishGrammarPackage(packageId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  if (!pkg.publishedVersionId) return;
  // Tạo/đảm bảo có draft TRƯỚC khi archive bản published (ensureDraft nhân bản từ published, kể cả các mục đã gắn) để không mất nội dung.
  await ensureDraftVersionId(packageId);
  await lmsClient.post(`/content-packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(pkg.publishedVersionId)}/archive`);
}

// ---- mục (điểm ngữ pháp), phẳng trong gói — sessionNo cố định = 1 ----
export async function listPackageGrammarPoints(packageId: string): Promise<GrammarPoint[]> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
  if (!versionId) return [];
  const links = await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`);
  return links
    .map((link) => fromGrammarContent(link.learningResourceId, link.displayOrder, link.resourceContent))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export async function createGrammarItem(packageId: string, input: ContentItemInput<GrammarPoint>, demo: boolean): Promise<GrammarPoint> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  const resource = await lmsClient.post<BackendLearningResource>("/learning-resources", {
    type: PACKAGE_TYPE,
    content: toGrammarContent(input),
    publishImmediately: true,
    inLibrary: false,
  });
  const resourceVersionId = resource.publishedVersionId ?? resource.draftVersionId;
  await lmsClient.post(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`, {
    learningResourceId: resource.id,
    learningResourceVersionId: resourceVersionId,
    sessionNo: 1,
    displayOrder: input.index ?? 0,
  });
  return fromGrammarContent(resource.id, input.index ?? 0, resource.content);
}

export async function updateGrammarItem(packageId: string, resourceId: string, input: ContentItemInput<GrammarPoint>, demo: boolean): Promise<GrammarPoint> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}/content`, {
    content: toGrammarContent(input),
  });
  return fromGrammarContent(resourceId, input.index ?? 0, toGrammarContent(input));
}

export async function deleteGrammarItem(packageId: string, resourceId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.delete(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}`);
}
