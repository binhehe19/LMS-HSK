"use client";

// Client "nối thử" Từ điển Hán tự (HSK) vào repo-lms thật, thay cho dictionary-client.ts (mock, trỏ
// NEXT_PUBLIC_HSK_API_BASE_PATH chưa có backend). Backend: LearningResourceType.DICTIONARY, content dùng chung
// class VocabularyContent.java với VOCABULARY (tách nhau bằng type, không phải bằng class)
// (tài nguyên độc lập trong Kho, inLibrary=true, không gắn ContentPackage — tra từ điển không thuộc syllabus nào).
// Khác hẳn bộ /learning-resources/dictionary/** cũ (từ điển tiếng Anh/IELTS, type=VOCABULARY) — không đụng tới.
//
// Tìm kiếm (lọc hskLevel/isSingleVocab/wordType/radical) dùng 1 endpoint riêng /dictionary-hanzi/search (các trường
// này nằm trong JSON content, endpoint liệt kê chung /learning-resources không lọc được). Tạo/sửa/xoá/lấy 1 từ
// dùng lại nguyên các endpoint chung (POST /learning-resources, GET/POST /{id}/versions, .../publish, DELETE /{id}).
import { lmsClient } from "@/lib/api/lms-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { PageResponse as BackendPageResponse } from "@/types/lms";
import type { StudentVocabularySearchParams, Vocabulary, VocabularyDetail, VocabularyInput, VocabularyPage, VocabularyPinyin, VocabularySearchParams } from "@/types/dictionary";

const enc = encodeURIComponent;

// ---- shape thật của repo-lms (chỉ các trường dùng tới) ----
interface DictionaryMeaningContent {
  meaning: string;
  exampleSentenceCn?: string;
  exampleSentencePinyin?: string;
  exampleSentenceVi?: string;
  exampleSentenceEn?: string;
  exampleWordType?: string;
}
interface DictionaryPinyinContent {
  pinyin: string;
  sinoVietnamese?: string;
  wordTypes?: string;
  isPrimary?: boolean;
  measureWord?: string;
  compounds?: string;
  synonyms?: string;
  antonyms?: string;
  notes?: string;
  meanings: DictionaryMeaningContent[];
}
interface DictionaryContent {
  hanzi: string;
  hskLevel?: number;
  audioUrl?: string;
  imageUrl?: string;
  strokeAnimationUrl?: string;
  etymologyStory?: string;
  etymologyImage?: string;
  radical?: string;
  strokeCount?: number;
  strokes?: string;
  isSingleVocab?: boolean;
  notes?: string;
  pinyins: DictionaryPinyinContent[];
}
interface BackendLearningResource {
  id: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: DictionaryContent | null;
}
interface BackendVersion {
  id: string;
}
/** Hình dạng trả về của /dictionary-hanzi/search — đã khớp sẵn với `Vocabulary` phía FE. */
type DictionaryWordResponse = Vocabulary;

// ---- dịch VocabularyInput <-> DictionaryContent (tên trường khớp sẵn, không đổi gì) ----
function toDictionaryContent(input: VocabularyInput): DictionaryContent {
  return {
    hanzi: input.hanzi,
    hskLevel: input.hskLevel,
    audioUrl: input.audioUrl,
    imageUrl: input.imageUrl,
    strokeAnimationUrl: input.strokeAnimationUrl,
    etymologyStory: input.etymologyStory,
    etymologyImage: input.etymologyImage,
    radical: input.radical,
    strokeCount: input.strokeCount,
    strokes: input.strokes,
    isSingleVocab: input.isSingleVocab,
    notes: input.notes,
    pinyins: (input.pinyins ?? []).map((p) => ({
      pinyin: p.pinyin,
      sinoVietnamese: p.sinoVietnamese,
      wordTypes: p.wordTypes,
      isPrimary: p.isPrimary,
      measureWord: p.measureWord,
      compounds: p.compounds,
      synonyms: p.synonyms,
      antonyms: p.antonyms,
      notes: p.notes,
      meanings: (p.meanings ?? []).map((m) => ({
        meaning: m.meaning,
        exampleSentenceCn: m.exampleSentenceCn,
        exampleSentencePinyin: m.exampleSentencePinyin,
        exampleSentenceVi: m.exampleSentenceVi,
        exampleSentenceEn: m.exampleSentenceEn,
        exampleWordType: m.exampleWordType,
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
    measureWord: p.measureWord,
    compounds: p.compounds,
    synonyms: p.synonyms,
    antonyms: p.antonyms,
    notes: p.notes,
    meanings: p.meanings ?? [],
  }));
  return {
    id,
    hanzi: content.hanzi,
    hskLevel: content.hskLevel,
    audioUrl: content.audioUrl,
    imageUrl: content.imageUrl,
    strokeAnimationUrl: content.strokeAnimationUrl,
    etymologyStory: content.etymologyStory,
    etymologyImage: content.etymologyImage,
    radical: content.radical,
    strokeCount: content.strokeCount,
    strokes: content.strokes,
    isSingleVocab: content.isSingleVocab ?? true,
    notes: content.notes,
    status,
    pinyins,
  };
}

function toSearchQuery(params: VocabularySearchParams): string {
  const q = new URLSearchParams();
  if (params.keySearch) q.set("keySearch", params.keySearch);
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
  const res = await lmsClient.get<BackendPageResponse<DictionaryWordResponse>>(`/learning-resources/dictionary-hanzi/search${toSearchQuery(params)}`);
  return { items: res.items ?? [], totalElements: res.total_elements, totalPages: res.total_pages, page: res.page, size: res.size };
}

/** Chi tiết đầy đủ — bản cũ gọi trước khi mở form sửa vì danh sách chỉ là bản rút gọn. */
export async function getVocabulary(id: number | string): Promise<Vocabulary> {
  const resource = await lmsClient.get<BackendLearningResource>(`/learning-resources/${enc(String(id))}`);
  if (!resource.content) throw new Error("Từ chưa có nội dung");
  const status: Vocabulary["status"] = resource.publishedVersionId ? "published" : "draft";
  return fromDictionaryContent(resource.id, status, resource.content);
}

export async function createVocabulary(input: VocabularyInput, demoActive: boolean): Promise<Vocabulary> {
  assertWriteEnabled("content", demoActive);
  const resource = await lmsClient.post<BackendLearningResource>("/learning-resources", {
    type: "DICTIONARY",
    content: toDictionaryContent(input),
    inLibrary: true,
  });
  let status: Vocabulary["status"] = "draft";
  if (input.status === "published" && resource.draftVersionId) {
    await lmsClient.post(`/learning-resources/${enc(resource.id)}/versions/${enc(resource.draftVersionId)}/publish`);
    status = "published";
  }
  return fromDictionaryContent(resource.id, status, resource.content ?? toDictionaryContent(input));
}

export async function updateVocabulary(id: number | string, input: VocabularyInput, demoActive: boolean): Promise<Vocabulary> {
  assertWriteEnabled("content", demoActive);
  const resourceId = enc(String(id));
  const version = await lmsClient.post<BackendVersion>(`/learning-resources/${resourceId}/versions`, {
    content: toDictionaryContent(input),
  });
  let status: Vocabulary["status"] = "draft";
  if (input.status === "published") {
    await lmsClient.post(`/learning-resources/${resourceId}/versions/${enc(version.id)}/publish`);
    status = "published";
  }
  return fromDictionaryContent(String(id), status, toDictionaryContent(input));
}

export async function deleteVocabulary(id: number | string, demoActive: boolean): Promise<void> {
  assertWriteEnabled("content", demoActive);
  await lmsClient.delete(`/learning-resources/${enc(String(id))}`);
}

// ---- Học viên (/vocabulary): endpoint ĐỌC, chỉ từ đã xuất bản, mọi người dùng đã đăng nhập (không cần ROLE_ADMIN) ----
// Tìm/lọc chạy bằng SQL trên cột chuẩn hoá của learning_resources (không nạp toàn bộ từ điển vào bộ nhớ).

function toStudentQuery(params: StudentVocabularySearchParams): string {
  const q = new URLSearchParams();
  const key = params.keySearch?.trim();
  if (key) q.set("keySearch", key);
  if (params.hskLevel !== undefined) q.set("hskLevel", String(params.hskLevel));
  if (params.radical) q.set("radical", params.radical);
  q.set("page", String(params.page));
  q.set("size", String(params.size));
  return `?${q.toString()}`;
}

/**
 * Danh sách từ theo từ khoá (Hán tự / pinyin không dấu / nghĩa), cấp HSK, bộ thủ; thứ tự như từ điển cũ. Dùng chung endpoint tìm kiếm có sẵn của
 * màn quản lý: backend chỉ trả từ ĐÃ XUẤT BẢN cho người không phải Admin.
 */
export async function searchPublishedVocabularies(params: StudentVocabularySearchParams): Promise<VocabularyPage> {
  const res = await lmsClient.get<BackendPageResponse<DictionaryWordResponse>>(`/learning-resources/dictionary-hanzi/search${toStudentQuery(params)}`);
  if (!res || !Array.isArray(res.items)) throw new Error("Dữ liệu từ điển trả về không đúng định dạng.");
  return { items: res.items, totalElements: res.total_elements, totalPages: res.total_pages, page: res.page, size: res.size };
}

/** Chi tiết một từ đã xuất bản (404 nếu không có hoặc chưa xuất bản). */
export async function getPublishedVocabulary(id: string): Promise<VocabularyDetail> {
  const res = await lmsClient.get<VocabularyDetail>(`/learning-resources/dictionary-hanzi/words/${enc(id)}`);
  return { ...res, components: Array.isArray(res.components) ? res.components : [] };
}
