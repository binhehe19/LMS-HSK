"use client";

// Client "nối thử" kho nội dung Ngữ pháp HSK vào repo-lms thật (LearningResource + ContentPackage có sẵn), thay cho content-tree-client.ts
// (trỏ NEXT_PUBLIC_HSK_API_BASE_PATH chưa có backend). Cùng mẫu với lms-content-client.ts (Flashcard).
//
// Mapping: GrammarPoint HSK là LearningResourceType.GRAMMAR với loại phụ ZH (GrammarZhContent, độc lập với ngữ pháp EN của IELTS):
// title/category/generalDefinition/structure/explanation/hskLevel giữ tên; note→usageNote (đổi tên, cùng nghĩa); exampleSentenceZh/Pinyin/Vi→1 phần tử
// examples[]{sentenceZh, pinyin, translationVi}. hskLevel được backend phản chiếu vào cột cefr_level để lọc. linkedQuizStudySetId KHÔNG có chỗ lưu
// (bài tập gắn qua học phần ở LMS 2.0) → không gửi lên, không đọc lại.
// Package→Folder→StudySet→Item rút gọn còn Package→resource (phẳng); sessionNo cố định = 1. Gói của Kho là học phần tự do (không có syllabusId).
import { lmsClient } from "@/lib/api/lms-client";
import { listManagedPackages, syllabusBinding, toContentPackage } from "@/lib/api/package-management-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { ContentItemInput, ContentPackage, ContentPackageInput } from "@/types/content";
import type { GrammarPoint, GrammarPointInput } from "@/types/content-grammar";
import type { PageResponse } from "@/types/lms";

const PACKAGE_TYPE = "GRAMMAR";

// ---- shape thật của repo-lms (chỉ các trường dùng tới) ----
interface BackendPackageVersion {
  sessionCount?: number;
  id: string;
  title: string | null;
  description?: string | null;
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
interface GrammarExampleItem {
  exampleIndex?: number;
  sentenceZh?: string;
  pinyin?: string;
  translationVi?: string;
  explanation?: string;
}
interface GrammarContent {
  title: string;
  category?: string;
  generalDefinition?: string;
  structure?: string;
  explanation?: string;
  usageNote?: string;
  /** Cấp HSK dạng chuỗi "1".."9". */
  hskLevel?: string;
  examples?: GrammarExampleItem[];
}
interface BackendLearningResource {
  id: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: GrammarContent | null;
}
interface BackendPackageVersionResource {
  sessionNo: number;
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
      ? { exampleIndex: 0, sentenceZh: input.exampleSentenceZh || undefined, pinyin: input.exampleSentencePinyin || undefined, translationVi: input.exampleSentenceVi || undefined }
      : null;
  return {
    title: input.title,
    category: input.category || undefined,
    generalDefinition: input.generalDefinition || undefined,
    structure: input.structure || undefined,
    explanation: input.explanation || undefined,
    usageNote: input.note || undefined,
    hskLevel: input.hskLevel || undefined,
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
    hskLevel: content?.hskLevel || undefined,
    exampleSentenceZh: example?.sentenceZh || undefined,
    exampleSentencePinyin: example?.pinyin || undefined,
    exampleSentenceVi: example?.translationVi || undefined,
  };
}

export type GrammarLibraryEntry = BackendLearningResource & { point: GrammarPoint };

function toLibraryEntry(resource: BackendLearningResource): GrammarLibraryEntry {
  return { ...resource, point: fromGrammarContent(resource.id, 0, resource.content) };
}

export async function listGrammarLibrary({ page, size, keyword, level, publishedOnly }: {
  page: number; size: number; keyword: string; level?: string; publishedOnly?: boolean;
}): Promise<PageResponse<GrammarLibraryEntry>> {
  const query = new URLSearchParams({ type: PACKAGE_TYPE, subType: "ZH", inLibrary: "true", page: String(page - 1), size: String(size) });
  if (keyword.trim()) query.set("keyword", keyword.trim());
  if (level) query.set("cefrLevel", level);
  if (publishedOnly) query.set("publishedOnly", "true");
  const result = await lmsClient.get<PageResponse<BackendLearningResource>>(`/learning-resources?${query}`);
  return { ...result, items: result.items.map(toLibraryEntry) };
}

export async function getGrammarLibraryDraft(resourceId: string): Promise<GrammarLibraryEntry> {
  const path = `/learning-resources/${encodeURIComponent(resourceId)}`;
  const resource = await lmsClient.get<BackendLearningResource>(path);
  if (!resource.draftVersionId || !resource.publishedVersionId) return toLibraryEntry(resource);
  const versions = await lmsClient.get<{ id: string; content: GrammarContent }[]>(`${path}/versions`);
  const draft = versions.find(version => version.id === resource.draftVersionId);
  if (!draft) throw new Error("Không tải được bản nháp đang chỉnh sửa.");
  return toLibraryEntry({ ...resource, content: draft.content });
}

export async function saveGrammarLibraryDraft(input: GrammarPointInput, entry: GrammarLibraryEntry | null, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const content = toGrammarContent(input);
  if (!entry) {
    await lmsClient.post("/learning-resources", { type: PACKAGE_TYPE, subType: "ZH", inLibrary: true, publishImmediately: false, content });
    return;
  }

  const otherExamples = entry.content?.examples?.slice(1) ?? [];
  const explanation = entry.content?.examples?.[0]?.explanation;
  if (explanation && content.examples?.[0]) content.examples[0].explanation = explanation;
  if (otherExamples.length) content.examples = [...(content.examples ?? []), ...otherExamples];
  const path = `/learning-resources/${encodeURIComponent(entry.id)}/versions`;
  if (entry.draftVersionId) {
    await lmsClient.put(`${path}/${encodeURIComponent(entry.draftVersionId)}`, { content });
  } else {
    await lmsClient.post(path, { content });
  }
}

export async function publishGrammarLibraryDraft(entry: GrammarLibraryEntry, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  if (!entry.draftVersionId) throw new Error("Điểm ngữ pháp chưa có bản nháp để xuất bản.");
  await lmsClient.post(`/learning-resources/${encodeURIComponent(entry.id)}/versions/${encodeURIComponent(entry.draftVersionId)}/publish`);
}

export async function deleteGrammarLibraryEntry(id: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  await lmsClient.delete(`/learning-resources/${encodeURIComponent(id)}`);
}

// ---- gói ----
export async function listGrammarPackages(): Promise<ContentPackage[]> {
  return (await listManagedPackages(PACKAGE_TYPE)).map(toContentPackage);
}

export async function createGrammarPackage(input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
  assertWriteEnabled("content", demo);
  const pkg = await lmsClient.post<BackendPackage>("/content-packages", {
    type: PACKAGE_TYPE,
    title: input.name,
    ...await syllabusBinding(input.syllabusId),
    description: input.description || undefined,
    sessionCount: input.sessionCount,
  });
  return toContentPackage(pkg);
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
    sessionCount: input.sessionCount,
  });
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  return toContentPackage(pkg);
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
export async function listPackageGrammarPoints(packageId: string, sessionNo?: number): Promise<GrammarPoint[]> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
  if (!versionId) return [];
  const links = await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`);
  return links
    .filter(link => sessionNo === undefined || link.sessionNo === sessionNo)
    .map((link) => fromGrammarContent(link.learningResourceId, link.displayOrder, link.resourceContent))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export async function createGrammarItem(packageId: string, input: ContentItemInput<GrammarPoint>, demo: boolean, sessionNo = 1): Promise<GrammarPoint> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  const resource = await lmsClient.post<BackendLearningResource>("/learning-resources", {
    type: PACKAGE_TYPE,
    subType: "ZH", // Ngữ pháp HSK là tiếng Trung; nội dung theo GrammarZhContent.
    content: toGrammarContent(input),
    publishImmediately: true,
    inLibrary: false,
  });
  const resourceVersionId = resource.publishedVersionId ?? resource.draftVersionId;
  await lmsClient.post(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`, {
    learningResourceId: resource.id,
    learningResourceVersionId: resourceVersionId,
    sessionNo,
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
