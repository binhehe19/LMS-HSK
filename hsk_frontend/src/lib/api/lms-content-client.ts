"use client";

// Client "nối thử" kho nội dung Flashcard HSK vào repo-lms thật (LearningResource + ContentPackage có sẵn), thay cho content-tree-client.ts
// (trỏ NEXT_PUBLIC_HSK_API_BASE_PATH chưa có backend). Dùng lmsClient (lms-client.ts) nên cùng base URL/envelope/auth với các màn LMS khác đã chạy.
//
// Mapping (đã chốt với người phụ trách, xem plans/compressed-dancing-shore.md):
//  - Flashcard HSK gộp vào LearningResourceType.VOCABULARY có sẵn, dùng VocabularyContent: term→word, pinyin→pinyin, wordType→partOfSpeech,
//    meaning→commonMeaning, example/examplePinyin/exampleMeaning→examples[0]{en,pinyin,vi}, imageFileId→imageUrl (URL đã resolve qua
//    storage-client), audioFileId→ukAudioUrl, customFields→extraFields[]{label,value}, language="zh".
//  - Package→Folder→StudySet→Item của HSK cũ rút gọn còn Package→resource (phẳng, không Folder/StudySet); sessionNo cố định = 1.
//  - ContentPackage bắt buộc syllabusId/syllabusVersionId (validate ở backend) → dùng cặp đại diện cố định cho mọi gói flashcard HSK.
//  - Mọi thao tác ghi (attach/sửa nội dung/xoá resource) chỉ áp dụng được lên phiên bản DRAFT của package (backend từ chối nếu không phải draft) → luôn
//    ensureDraft trước khi ghi. Publish cần khoá chỉnh sửa (POST .../lock lấy sessionToken) trước khi gọi publish.
import { lmsClient } from "@/lib/api/lms-client";
import { fileUrl } from "@/lib/api/storage-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { ContentItemInput, ContentPackage, ContentPackageInput } from "@/types/content";
import type { PageResponse } from "@/types/lms";
import type { FlashcardCard, FlashcardCardInput } from "@/types/content-flashcard";

const PACKAGE_TYPE = "VOCABULARY";
/** Syllabus đại diện cố định cho mọi gói flashcard HSK (ContentPackage bắt buộc syllabusId/syllabusVersionId nhưng flashcard không thuộc giáo trình nào). */
const HSK_SYLLABUS_ID = "HSK-LIBRARY";
const HSK_SYLLABUS_VERSION_ID = "HSK-LIBRARY-V1";

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
interface VocabularyExample {
  en?: string;
  vi?: string;
  pinyin?: string;
}
interface VocabularyExtraField {
  label?: string;
  value?: string;
}
interface VocabularyContent {
  word: string;
  language?: string;
  partOfSpeech?: string;
  pinyin?: string;
  commonMeaning?: string;
  imageUrl?: string;
  ukAudioUrl?: string;
  examples?: VocabularyExample[];
  extraFields?: VocabularyExtraField[];
}
interface BackendLearningResource {
  id: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: VocabularyContent | null;
}
interface BackendPackageVersionResource {
  id: string;
  learningResourceId: string;
  learningResourceVersionId: string;
  displayOrder: number;
  resourceContent: VocabularyContent | null;
}
interface EditLockResponse {
  acquired: boolean;
  holderUserId?: string | null;
}

// ---- dịch field FlashcardCard <-> VocabularyContent ----
function fileIdFromUrl(url: string | undefined | null): string | undefined {
  const match = url?.match(/\/file\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function toVocabularyContent(input: FlashcardCardInput): VocabularyContent {
  const example: VocabularyExample | null =
    input.example || input.exampleMeaning || input.examplePinyin ? { en: input.example || undefined, vi: input.exampleMeaning || undefined, pinyin: input.examplePinyin || undefined } : null;
  const extraFields = (input.customFields ?? []).filter((f) => f.label.trim() || f.value.trim()).map((f) => ({ label: f.label.trim() || undefined, value: f.value.trim() || undefined }));
  return {
    word: input.term,
    language: "zh",
    partOfSpeech: input.wordType || undefined,
    pinyin: input.pinyin || undefined,
    commonMeaning: input.meaning || undefined,
    imageUrl: fileUrl(input.imageFileId) ?? undefined,
    ukAudioUrl: fileUrl(input.audioFileId) ?? undefined,
    examples: example ? [example] : undefined,
    extraFields: extraFields.length > 0 ? extraFields : undefined,
  };
}

function fromVocabularyContent(id: string, index: number, content: VocabularyContent | null): FlashcardCard {
  const example = content?.examples?.[0];
  return {
    id,
    studySetId: "",
    index,
    term: content?.word ?? "",
    pinyin: content?.pinyin || undefined,
    wordType: content?.partOfSpeech || undefined,
    meaning: content?.commonMeaning ?? "",
    example: example?.en || undefined,
    examplePinyin: example?.pinyin || undefined,
    exampleMeaning: example?.vi || undefined,
    imageFileId: fileIdFromUrl(content?.imageUrl),
    audioFileId: fileIdFromUrl(content?.ukAudioUrl),
    customFields: content?.extraFields && content.extraFields.length > 0 ? content.extraFields.map((f) => ({ label: f.label ?? "", value: f.value ?? "" })) : undefined,
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
export async function listFlashcardPackages(): Promise<ContentPackage[]> {
  const res = await lmsClient.get<PageResponse<BackendPackage>>(`/content-packages?type=${PACKAGE_TYPE}&syllabusId=${encodeURIComponent(HSK_SYLLABUS_ID)}&size=200`);
  return (res.items ?? []).map(toUiPackage);
}

export async function createFlashcardPackage(input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
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

export async function updateFlashcardPackage(packageId: string, input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.put(`/content-packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}`, {
    title: input.name,
    description: input.description || undefined,
  });
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  return toUiPackage(pkg);
}

export async function deleteFlashcardPackage(packageId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  await lmsClient.delete(`/content-packages/${encodeURIComponent(packageId)}`);
}

export async function publishFlashcardPackage(packageId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const sessionToken = crypto.randomUUID();
  const lock = await lmsClient.post<EditLockResponse>(`/content-packages/${encodeURIComponent(packageId)}/lock`, { sessionToken });
  if (!lock.acquired) throw new Error("Không khoá được phiên chỉnh sửa (có thể người khác đang sửa gói này).");
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.post(`/content-packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}/publish?sessionToken=${encodeURIComponent(sessionToken)}`);
}

export async function unpublishFlashcardPackage(packageId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  if (!pkg.publishedVersionId) return;
  // Tạo/đảm bảo có draft TRƯỚC khi archive bản published (ensureDraft nhân bản từ published, kể cả các thẻ đã gắn) để không mất nội dung.
  await ensureDraftVersionId(packageId);
  await lmsClient.post(`/content-packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(pkg.publishedVersionId)}/archive`);
}

// ---- mục (thẻ), phẳng trong gói — sessionNo cố định = 1 ----
export async function listPackageItems(packageId: string): Promise<FlashcardCard[]> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
  if (!versionId) return [];
  const links = await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`);
  return links
    .map((link) => fromVocabularyContent(link.learningResourceId, link.displayOrder, link.resourceContent))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export async function createFlashcardItem(packageId: string, input: ContentItemInput<FlashcardCard>, demo: boolean): Promise<FlashcardCard> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  const resource = await lmsClient.post<BackendLearningResource>("/learning-resources", {
    type: PACKAGE_TYPE,
    content: toVocabularyContent(input),
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
  return fromVocabularyContent(resource.id, input.index ?? 0, resource.content);
}

export async function updateFlashcardItem(packageId: string, resourceId: string, input: ContentItemInput<FlashcardCard>, demo: boolean): Promise<FlashcardCard> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}/content`, {
    content: toVocabularyContent(input),
  });
  return fromVocabularyContent(resourceId, input.index ?? 0, toVocabularyContent(input));
}

export async function deleteFlashcardItem(packageId: string, resourceId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.delete(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}`);
}
