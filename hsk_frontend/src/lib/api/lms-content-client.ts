"use client";

// Client "nối thử" kho nội dung Flashcard HSK vào repo-lms thật (LearningResource + ContentPackage có sẵn), thay cho content-tree-client.ts
// (trỏ NEXT_PUBLIC_HSK_API_BASE_PATH chưa có backend). Dùng lmsClient (lms-client.ts) nên cùng base URL/envelope/auth với các màn LMS khác đã chạy.
//
// Mapping (đã chốt với người phụ trách, xem plans/compressed-dancing-shore.md):
//  - Flashcard HSK là LearningResourceType.VOCABULARY loại phụ ZH, nội dung VocabularyZhContent (chữ Hán → phiên âm → nghĩa) như Từ điển:
//    term→word, pinyin→pinyins[0].pinyin (phiên âm chính), wordType→pinyins[0].wordTypes, meaning→meanings[0].meaningVi,
//    example/examplePinyin/exampleMeaning→meanings[0].exampleSentenceZh/Pinyin/Vi, imageFileId→imageUrl, audioFileId→audioUrl (URL đã
//    resolve qua storage-client), customFields→notes (mỗi dòng "nhãn: giá trị").
//  - Package→Folder→StudySet→Item của HSK cũ rút gọn còn Package→resource (phẳng, không Folder/StudySet); sessionNo cố định = 1.
//  - Gói của Kho là học phần tự do (không có syllabusId/syllabusVersionId).
//  - Mọi thao tác ghi (attach/sửa nội dung/xoá resource) chỉ áp dụng được lên phiên bản DRAFT của package (backend từ chối nếu không phải draft) → luôn
//    ensureDraft trước khi ghi. Publish cần khoá chỉnh sửa (POST .../lock lấy sessionToken) trước khi gọi publish.
import { lmsClient } from "@/lib/api/lms-client";
import { listManagedPackages, syllabusBinding, toContentPackage } from "@/lib/api/package-management-client";
import { fileUrl } from "@/lib/api/storage-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { ContentItemInput, ContentPackage, ContentPackageInput } from "@/types/content";
import type { FlashcardCard, FlashcardCardInput } from "@/types/content-flashcard";
import type { VocabularyZhContent, VocabularyZhMeaning, VocabularyZhPinyin } from "@/types/vocabulary-zh-content";

const PACKAGE_TYPE = "VOCABULARY";

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
/** Nội dung từ vựng ZH (xem types/vocabulary-zh-content.ts). Từ sao chép từ từ điển còn nhiều trường khác (HSK, bộ thủ, nhiều phiên âm...) mà thẻ không sửa: chúng được giữ nguyên khi sửa thẻ. */
type DictionaryMeaning = VocabularyZhMeaning;
type DictionaryPinyin = VocabularyZhPinyin;
type VocabularyContent = VocabularyZhContent;
interface BackendLearningResource {
  id: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: VocabularyContent | null;
}
interface BackendPackageVersionResource {
  sessionNo: number;
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

/** Trường tùy chỉnh của thẻ lưu trong `notes` của từ, mỗi dòng "nhãn: giá trị". */
function customFieldsToNotes(fields: FlashcardCardInput["customFields"]): string | undefined {
  const lines = (fields ?? []).filter((f) => f.label.trim() || f.value.trim()).map((f) => `${f.label.trim()}: ${f.value.trim()}`);
  return lines.length > 0 ? lines.join("\n") : undefined;
}

function notesToCustomFields(notes: string | undefined): FlashcardCard["customFields"] {
  const fields = (notes ?? "").split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^(.+?):\s*(.*)$/);
    return match ? [{ label: match[1], value: match[2] }] : [];
  });
  return fields.length > 0 ? fields : undefined;
}

function toVocabularyContent(input: FlashcardCardInput): VocabularyContent {
  return {
    word: input.term,
    imageUrl: fileUrl(input.imageFileId) ?? undefined,
    audioUrl: fileUrl(input.audioFileId) ?? undefined,
    notes: customFieldsToNotes(input.customFields),
    pinyins: [
      {
        pinyin: input.pinyin ?? "",
        wordTypes: input.wordType || undefined,
        isPrimary: true,
        meanings: [
          {
            meaningVi: input.meaning || undefined,
            exampleSentenceZh: input.example || undefined,
            exampleSentencePinyin: input.examplePinyin || undefined,
            exampleSentenceVi: input.exampleMeaning || undefined,
          },
        ],
      },
    ],
  };
}

/** Ghi thẻ lên nội dung hiện có: chỉ phiên âm chính và nghĩa đầu bị thay; các phiên âm, nghĩa và trường khác của từ được giữ. */
function mergeCardIntoContent(current: VocabularyContent | null, input: FlashcardCardInput): VocabularyContent {
  const next = toVocabularyContent(input);
  if (!current?.pinyins?.length) return { ...(current ?? {}), ...next };
  const at = Math.max(0, current.pinyins.findIndex((p) => p.isPrimary));
  const target = current.pinyins[at];
  const [nextPinyin] = next.pinyins as DictionaryPinyin[];
  const [firstMeaning, ...restMeanings] = target.meanings ?? [];
  const merged: DictionaryPinyin = {
    ...target,
    pinyin: nextPinyin.pinyin,
    wordTypes: nextPinyin.wordTypes,
    meanings: [{ ...(firstMeaning ?? {}), ...(nextPinyin.meanings as DictionaryMeaning[])[0] }, ...restMeanings],
  };
  return { ...current, ...next, pinyins: current.pinyins.map((p, i) => (i === at ? merged : p)) };
}

function fromVocabularyContent(id: string, index: number, content: VocabularyContent | null): FlashcardCard {
  const primary = content?.pinyins?.find((p) => p.isPrimary) ?? content?.pinyins?.[0];
  const firstMeaning = primary?.meanings?.[0];
  return {
    id,
    studySetId: "",
    index,
    term: content?.word ?? "",
    pinyin: primary?.pinyin || undefined,
    wordType: primary?.wordTypes || undefined,
    meaning: firstMeaning?.meaningVi ?? "",
    example: firstMeaning?.exampleSentenceZh || undefined,
    examplePinyin: firstMeaning?.exampleSentencePinyin || undefined,
    exampleMeaning: firstMeaning?.exampleSentenceVi || undefined,
    imageFileId: fileIdFromUrl(content?.imageUrl),
    audioFileId: fileIdFromUrl(content?.audioUrl),
    customFields: notesToCustomFields(content?.notes),
  };
}

// ---- gói ----
export async function listFlashcardPackages(): Promise<ContentPackage[]> {
  return (await listManagedPackages(PACKAGE_TYPE)).map(toContentPackage);
}

export async function createFlashcardPackage(input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
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

export async function updateFlashcardPackage(packageId: string, input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
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
export async function listPackageItems(packageId: string, sessionNo?: number): Promise<FlashcardCard[]> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
  if (!versionId) return [];
  const links = await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`);
  return links
    .filter(link => sessionNo === undefined || link.sessionNo === sessionNo)
    .map((link) => fromVocabularyContent(link.learningResourceId, link.displayOrder, link.resourceContent))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export async function createFlashcardItem(packageId: string, input: ContentItemInput<FlashcardCard>, demo: boolean, sessionNo = 1): Promise<FlashcardCard> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  const resource = await lmsClient.post<BackendLearningResource>("/learning-resources", {
    type: PACKAGE_TYPE,
    subType: "ZH", // thẻ nhập tay ở HSK là từ tiếng Trung
    content: toVocabularyContent(input),
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
  return fromVocabularyContent(resource.id, input.index ?? 0, resource.content);
}

export async function updateFlashcardItem(packageId: string, resourceId: string, input: ContentItemInput<FlashcardCard>, demo: boolean): Promise<FlashcardCard> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  // Ghi đè lên nội dung hiện có (không thay hẳn): từ sao chép từ từ điển còn nhiều phiên âm/nghĩa mà form thẻ không sửa, giữ nguyên chúng.
  const current = await lmsClient.get<BackendLearningResource>(`/learning-resources/${encodeURIComponent(resourceId)}`);
  const content = mergeCardIntoContent(current.content, input);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}/content`, { content });
  return fromVocabularyContent(resourceId, input.index ?? 0, content);
}

export interface AddWordsResult {
  added: number;
  failed: { label: string; message: string }[];
}

/**
 * Thêm các từ chọn từ TỪ ĐIỂN (`/vocabulary/manage`, inLibrary = true) vào bộ: mỗi từ là một BẢN SAO riêng với nội dung nguyên văn và
 * `sourceResourceId` trỏ về từ ở từ điển (đồng bộ và sao chép tiến độ đi theo nguồn đó). Từ lỗi không làm dừng các từ còn lại; tạo bản sao xong mà
 * gắn lỗi thì xóa bản sao vừa tạo (không để bản mồ côi).
 */
export async function addDictionaryWordsToPackage(packageId: string, words: { id: string; label: string }[], demo: boolean, sessionNo = 1): Promise<AddWordsResult> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  const existing = await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`);
  let nextOrder = existing.length ? Math.max(...existing.map((r) => r.displayOrder)) + 1 : 0;
  const result: AddWordsResult = { added: 0, failed: [] };
  for (const word of words) {
    let created: BackendLearningResource | null = null;
    try {
      const source = await lmsClient.get<BackendLearningResource>(`/learning-resources/${encodeURIComponent(word.id)}`);
      if (!source.content) throw new Error("Từ chưa có nội dung");
      created = await lmsClient.post<BackendLearningResource>("/learning-resources", { type: PACKAGE_TYPE, content: source.content, publishImmediately: true, inLibrary: false, sourceResourceId: word.id });
      const resourceVersionId = created.publishedVersionId ?? created.draftVersionId;
      if (!resourceVersionId) throw new Error("Không lấy được phiên bản của từ vừa tạo.");
      await lmsClient.post(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`, { learningResourceId: created.id, learningResourceVersionId: resourceVersionId, sessionNo, displayOrder: nextOrder++ });
      result.added++;
    } catch (error) {
      if (created) await lmsClient.delete(`/learning-resources/${encodeURIComponent(created.id)}`).catch(() => undefined);
      result.failed.push({ label: word.label, message: (error instanceof Error && error.message) || "Không thể kết nối máy chủ" });
    }
  }
  return result;
}

export async function deleteFlashcardItem(packageId: string, resourceId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.delete(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}`);
}
