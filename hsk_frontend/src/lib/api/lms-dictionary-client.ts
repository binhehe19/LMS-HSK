"use client";

import { lmsClient } from "@/lib/api/lms-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { PageResponse as BackendPageResponse } from "@/types/lms";
import type { VocabularyZhContent, VocabularyZhMeaning, VocabularyZhPinyin } from "@/types/vocabulary-zh-content";
import type { StudentVocabularySearchParams, Vocabulary, VocabularyDetail, VocabularyInput, VocabularyPage, VocabularyPinyin, VocabularySearchParams } from "@/types/dictionary";

const enc = encodeURIComponent;

// ---- shape thật của repo-lms (chỉ các trường dùng tới) ----
type DictionaryMeaningContent = VocabularyZhMeaning;
// Dạng ghi/đọc của màn Từ điển: phiên âm và nghĩa luôn có (kiểu chung của nội dung ZH để tuỳ chọn vì thẻ nhập tay dùng chung).
type DictionaryPinyinContent = Omit<VocabularyZhPinyin, "pinyin" | "meanings"> & { pinyin: string; meanings: VocabularyZhMeaning[] };
type DictionaryContent = Omit<VocabularyZhContent, "pinyins"> & { pinyins: DictionaryPinyinContent[] };
interface BackendLearningResource {
  id: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: DictionaryContent | null;
}
interface BackendVersion {
  id: string;
  content: DictionaryContent | null;
}
type DictionaryWordResponse = Omit<VocabularyDetail, "pinyins"> & { pinyins: DictionaryPinyinContent[] };

function fromMeaningContent(meaning: DictionaryMeaningContent): VocabularyPinyin["meanings"][number] {
  return {
    meaning: meaning.meaningVi ?? "",
    meaningEn: meaning.meaningEn,
    meaningZh: meaning.meaningZh,
    meaningViHtml: meaning.meaningViHtml,
    meaningZhHtml: meaning.meaningZhHtml,
    exampleWordType: meaning.exampleWordType,
    examples: meaning.examples,
  };
}

function fromDictionaryResponse(response: DictionaryWordResponse): VocabularyDetail {
  return {
    ...response,
    pinyins: (response.pinyins ?? []).map((pinyin) => ({ ...pinyin, meanings: (pinyin.meanings ?? []).map(fromMeaningContent) })),
    components: response.components ?? [],
  };
}

// Chuyển giữa trường ngôn ngữ của API và dạng dữ liệu dùng trong giao diện.
function toDictionaryContent(input: VocabularyInput): DictionaryContent {
  return {
    word: input.hanzi,
    hskLevel: input.hskLevel,
    imageUrl: input.imageUrl,
    etymologyStory: input.etymologyStory,
    etymologyStoryHtml: input.etymologyStoryHtml,
    radical: input.radical,
    isSingleVocab: input.isSingleVocab,
    notes: input.notes,
    notesHtml: input.notesHtml,
    pinyins: (input.pinyins ?? []).map((p) => ({
      pinyin: p.pinyin,
      audioUrl: p.audioUrl,
      sinoVietnamese: p.sinoVietnamese,
      wordTypes: p.wordTypes,
      isPrimary: p.isPrimary,
      measureWord: p.measureWord,
      compounds: p.compounds,
      synonyms: p.synonyms,
      antonyms: p.antonyms,
      notes: p.notes,
      meanings: (p.meanings ?? []).map((m) => ({
        meaningVi: m.meaning || undefined,
        meaningEn: m.meaningEn,
        meaningZh: m.meaningZh,
        meaningViHtml: m.meaningViHtml,
        meaningZhHtml: m.meaningZhHtml,
        exampleWordType: m.exampleWordType,
        examples: m.examples,
      })),
    })),
  };
}

function fromDictionaryContent(id: string, status: Vocabulary["status"], content: DictionaryContent): Vocabulary {
  const pinyins: VocabularyPinyin[] = (content.pinyins ?? []).map((p) => ({
    pinyin: p.pinyin,
    sinoVietnamese: p.sinoVietnamese,
    wordTypes: p.wordTypes,
    isPrimary: p.isPrimary,
    audioUrl: p.audioUrl,
    measureWord: p.measureWord,
    compounds: p.compounds,
    synonyms: p.synonyms,
    antonyms: p.antonyms,
    notes: p.notes,
    meanings: (p.meanings ?? []).map(fromMeaningContent),
  }));
  return {
    id,
    hanzi: content.word,
    hskLevel: content.hskLevel,
    imageUrl: content.imageUrl,
    etymologyStory: content.etymologyStory,
    etymologyStoryHtml: content.etymologyStoryHtml,
    radical: content.radical,
    isSingleVocab: content.isSingleVocab ?? true,
    notes: content.notes,
    notesHtml: content.notesHtml,
    status,
    pinyins,
  };
}

function toSearchQuery(params: VocabularySearchParams): string {
  const q = new URLSearchParams({ language: "zh", includeDrafts: "true" });
  if (params.keySearch) q.set("keyword", params.keySearch);
  if (params.hskLevel !== undefined) q.set("hskLevel", String(params.hskLevel));
  if (params.isSingleVocab !== undefined) q.set("isSingleVocab", String(params.isSingleVocab));
  if (params.wordType) q.set("wordType", params.wordType);
  if (params.radical) q.set("radical", params.radical);
  q.set("page", String(params.page));
  q.set("size", String(params.size));
  return `?${q.toString()}`;
}

/** Tìm kiếm + phân trang phía máy chủ (`page` từ 0). */
export async function searchVocabularies(params: VocabularySearchParams): Promise<VocabularyPage> {
  const res = await lmsClient.get<BackendPageResponse<DictionaryWordResponse>>(`/learning-resources/dictionary${toSearchQuery(params)}`);
  return { items: (res.items ?? []).map(fromDictionaryResponse), totalElements: res.total_elements, totalPages: res.total_pages, page: res.page, size: res.size };
}

/** Chi tiết đầy đủ — bản cũ gọi trước khi mở form sửa vì danh sách chỉ là bản rút gọn. */
export async function getVocabulary(id: number | string): Promise<Vocabulary> {
  const path = `/learning-resources/${enc(String(id))}`;
  const resource = await lmsClient.get<BackendLearningResource>(path);
  let content = resource.content;
  if (resource.draftVersionId && resource.publishedVersionId) {
    const versions = await lmsClient.get<BackendVersion[]>(`${path}/versions`);
    content = versions.find(version => version.id === resource.draftVersionId)?.content ?? null;
    if (!content) throw new Error("Không tải được bản nháp của từ vựng.");
  }
  if (!content) throw new Error("Từ chưa có nội dung");
  return fromDictionaryContent(resource.id, resource.draftVersionId ? "draft" : "published", content);
}

export async function createVocabulary(input: VocabularyInput, demoActive: boolean): Promise<Vocabulary> {
  assertWriteEnabled("content", demoActive);
  const resource = await lmsClient.post<BackendLearningResource>("/learning-resources", {
    type: "VOCABULARY",
    subType: "ZH",
    content: toDictionaryContent(input),
    inLibrary: true,
    publishImmediately: input.status === "published",
  });
  return fromDictionaryContent(resource.id, resource.publishedVersionId ? "published" : "draft", resource.content ?? toDictionaryContent(input));
}

export async function updateVocabulary(id: number | string, input: VocabularyInput, demoActive: boolean): Promise<Vocabulary> {
  assertWriteEnabled("content", demoActive);
  const path = `/learning-resources/${enc(String(id))}`;
  const resource = await lmsClient.get<BackendLearningResource>(path);
  const content = toDictionaryContent(input);
  const publishImmediately = input.status === "published";
  if (resource.draftVersionId) {
    const draftPath = `${path}/versions/${enc(resource.draftVersionId)}`;
    await lmsClient.put(draftPath, { content });
    if (publishImmediately) await lmsClient.post(`${draftPath}/publish`);
  } else {
    await lmsClient.post(`${path}/versions`, { content, publishImmediately });
  }
  return fromDictionaryContent(String(id), publishImmediately ? "published" : "draft", content);
}

export async function deleteVocabulary(id: number | string, demoActive: boolean): Promise<void> {
  assertWriteEnabled("content", demoActive);
  await lmsClient.delete(`/learning-resources/${enc(String(id))}`);
}

// ---- Học viên (/vocabulary): endpoint ĐỌC, chỉ từ đã xuất bản, mọi người dùng đã đăng nhập (không cần ROLE_ADMIN) ----
// Tìm/lọc chạy bằng SQL trên cột chuẩn hoá của learning_resources (không nạp toàn bộ từ điển vào bộ nhớ).

function toStudentQuery(params: StudentVocabularySearchParams): string {
  const q = new URLSearchParams({ language: "zh" });
  const key = params.keySearch?.trim();
  if (key) q.set("keyword", key);
  if (params.hskLevel !== undefined) q.set("hskLevel", String(params.hskLevel));
  if (params.radical) q.set("radical", params.radical);
  q.set("page", String(params.page));
  q.set("size", String(params.size));
  return `?${q.toString()}`;
}

/**
 * Danh sách từ theo từ khoá (Hán tự / pinyin không dấu / bộ thủ), cấp HSK, bộ thủ; thứ tự như từ điển cũ. Dùng chung endpoint tìm kiếm có sẵn của
 * màn quản lý: backend chỉ trả từ ĐÃ XUẤT BẢN cho người không phải Admin.
 */
export async function searchPublishedVocabularies(params: StudentVocabularySearchParams): Promise<VocabularyPage> {
  const res = await lmsClient.get<BackendPageResponse<DictionaryWordResponse>>(`/learning-resources/dictionary${toStudentQuery(params)}`);
  if (!res || !Array.isArray(res.items)) throw new Error("Dữ liệu từ điển trả về không đúng định dạng.");
  return { items: res.items.map(fromDictionaryResponse), totalElements: res.total_elements, totalPages: res.total_pages, page: res.page, size: res.size };
}

/** Chi tiết một từ đã xuất bản (404 nếu không có hoặc chưa xuất bản). */
export async function getPublishedVocabulary(id: string): Promise<VocabularyDetail> {
  const res = await lmsClient.get<DictionaryWordResponse>(`/learning-resources/dictionary/${enc(id)}?language=zh`);
  return fromDictionaryResponse(res);
}
