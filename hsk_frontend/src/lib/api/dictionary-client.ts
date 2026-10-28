// WAITING FOR BACKEND — Từ điển (/dictionary/vocabularies) theo HỢP ĐỒNG ĐỀ XUẤT kế thừa core/services/vocabulary.service.ts của LMS_Frontend cũ
// (dịch vụ từ điển đã có ở LMS_Backend, backend chung LMS_IELTS chưa có): docs/api-requirements/dictionary.md. Qua hskClient (NEXT_PUBLIC_HSK_API_BASE_PATH).
// Mock: scripts/mock/handlers/dictionary.mjs. Import Excel bất đồng bộ (/import, /import/status/{jobId}) KHÔNG chuyển ở M5.
// Thao tác GHI qua công tắc an toàn "content" (lib/api/write-gate.ts): chỉ chạy ở chế độ xem trước cục bộ hoặc khi NEXT_PUBLIC_WRITE_CONTENT=enabled.
"use client";

import { hskClient } from "@/lib/api/hsk-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import { buildSearchQuery } from "@/lib/dictionary/vocabulary-model";
import type { Vocabulary, VocabularyInput, VocabularyPage, VocabularySearchParams } from "@/types/dictionary";

const PREFIX = "/dictionary/vocabularies";
const id = (value: number | string) => encodeURIComponent(String(value));

/** Tìm kiếm + phân trang phía máy chủ (`page` từ 0). */
export function searchVocabularies(params: VocabularySearchParams) {
  return hskClient.get<VocabularyPage>(`${PREFIX}/search${buildSearchQuery(params)}`);
}

/** Chi tiết đầy đủ (pinyins/meanings) — bản cũ gọi trước khi mở form sửa vì danh sách chỉ là bản rút gọn. */
export function getVocabulary(vocabId: number | string) {
  return hskClient.get<Vocabulary>(`${PREFIX}/${id(vocabId)}`);
}

export function createVocabulary(input: VocabularyInput, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.post<Vocabulary>(PREFIX, input);
}

export function updateVocabulary(vocabId: number | string, input: VocabularyInput, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.put<Vocabulary>(`${PREFIX}/${id(vocabId)}`, input);
}

export function deleteVocabulary(vocabId: number | string, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.delete<unknown>(`${PREFIX}/${id(vocabId)}`);
}
