// WAITING FOR BACKEND — hàm gọi API GENERIC cho kho nội dung HSK dạng cây (Package → Folder → Study set → mục) theo HỢP ĐỒNG ĐỀ XUẤT, dùng chung cho
// mọi module (/flashcard, /writing, /quiz, /grammar, /pronunciation) qua hskClient (NEXT_PUBLIC_HSK_API_BASE_PATH). Đường dẫn RÚT GỌN từ 5 service
// của LMS_Frontend cũ (flashcard.service.ts, hanzi.service.ts, quiz.service.ts, grammar.service.ts, pronunciation.service.ts) — khác bản cũ có chủ đích:
//   - thư mục/bộ gắn cha ngay khi tạo (`packageId`/`folderId` trong body) thay cho 2 bước "tạo rồi POST /packages/{id}/folders/{folderId}";
//   - một tên tài nguyên mục theo module (`itemsPath`: cards/words/quizzes/grammar-points/pronunciation-items) thay cho `/cards/study-set?studySetId=`.
// Hợp đồng chi tiết + bảng module: docs/api-requirements/content-tree.md. Mock: scripts/mock/handlers/content-tree.mjs.
// Thao tác GHI đi qua công tắc an toàn "content" (lib/api/write-gate.ts): mặc định MỞ, chỉ bị chặn khi NEXT_PUBLIC_WRITE_CONTENT=disabled.
"use client";

import { hskClient } from "@/lib/api/hsk-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type {
  ContentFolder,
  ContentFolderInput,
  ContentItemBase,
  ContentItemInput,
  ContentItemWithContext,
  ContentPackage,
  ContentPackageInput,
  ContentPage,
  ContentStudySet,
  ContentStudySetInput,
} from "@/types/content";

/** Phần cấu hình module mà client cần: tiền tố dịch vụ và tên tài nguyên mục. */
export interface ContentApiTarget {
  apiPrefix: string;
  itemsPath: string;
}

const enc = encodeURIComponent;
const base = (t: ContentApiTarget) => t.apiPrefix.replace(/\/+$/, "");
const items = (t: ContentApiTarget) => `${base(t)}/${t.itemsPath.replace(/^\/+|\/+$/g, "")}`;

// ---- gói (package) ----

export function listPackages(t: ContentApiTarget) {
  return hskClient.get<ContentPackage[]>(`${base(t)}/packages`);
}

export function getPackage(t: ContentApiTarget, id: string) {
  return hskClient.get<ContentPackage>(`${base(t)}/packages/${enc(id)}`);
}

export function createPackage(t: ContentApiTarget, input: ContentPackageInput, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.post<ContentPackage>(`${base(t)}/packages`, input);
}

export function updatePackage(t: ContentApiTarget, id: string, input: ContentPackageInput, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.put<ContentPackage>(`${base(t)}/packages/${enc(id)}`, input);
}

export function deletePackage(t: ContentApiTarget, id: string, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.delete<unknown>(`${base(t)}/packages/${enc(id)}`);
}

/** Chỉ Admin/Teacher-manager (canPublishContent); backend phải kiểm tra lại. */
export function publishPackage(t: ContentApiTarget, id: string, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.post<ContentPackage>(`${base(t)}/packages/${enc(id)}/publish`);
}

export function unpublishPackage(t: ContentApiTarget, id: string, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.post<ContentPackage>(`${base(t)}/packages/${enc(id)}/unpublish`);
}

// ---- thư mục (folder) ----

export function listFolders(t: ContentApiTarget, packageId: string) {
  return hskClient.get<ContentFolder[]>(`${base(t)}/folders?packageId=${enc(packageId)}`);
}

export function getFolder(t: ContentApiTarget, id: string) {
  return hskClient.get<ContentFolder>(`${base(t)}/folders/${enc(id)}`);
}

export function createFolder(t: ContentApiTarget, input: ContentFolderInput, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.post<ContentFolder>(`${base(t)}/folders`, input);
}

export function updateFolder(t: ContentApiTarget, id: string, input: ContentFolderInput, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.put<ContentFolder>(`${base(t)}/folders/${enc(id)}`, input);
}

export function deleteFolder(t: ContentApiTarget, id: string, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.delete<unknown>(`${base(t)}/folders/${enc(id)}`);
}

// ---- bộ (study set) ----

export function listStudySets(t: ContentApiTarget, folderId: string) {
  return hskClient.get<ContentStudySet[]>(`${base(t)}/study-sets?folderId=${enc(folderId)}`);
}

export function getStudySet(t: ContentApiTarget, id: string) {
  return hskClient.get<ContentStudySet>(`${base(t)}/study-sets/${enc(id)}`);
}

export function createStudySet(t: ContentApiTarget, input: ContentStudySetInput, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.post<ContentStudySet>(`${base(t)}/study-sets`, input);
}

export function updateStudySet(t: ContentApiTarget, id: string, input: ContentStudySetInput, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.put<ContentStudySet>(`${base(t)}/study-sets/${enc(id)}`, input);
}

export function deleteStudySet(t: ContentApiTarget, id: string, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.delete<unknown>(`${base(t)}/study-sets/${enc(id)}`);
}

// ---- mục nội dung (thẻ/từ/quiz/điểm ngữ pháp/mục phát âm) ----

export function listItems<TItem extends ContentItemBase>(t: ContentApiTarget, studySetId: string) {
  return hskClient.get<TItem[]>(`${items(t)}?studySetId=${enc(studySetId)}`);
}

export function createItem<TItem extends ContentItemBase>(t: ContentApiTarget, studySetId: string, input: ContentItemInput<TItem>, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.post<TItem>(items(t), { studySetId, ...input });
}

/** Thêm nhiều mục một lần (`/cards/bulk` của bản cũ); thứ tự = thứ tự mảng. */
export function createItemsBulk<TItem extends ContentItemBase>(t: ContentApiTarget, studySetId: string, inputs: ContentItemInput<TItem>[], demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.post<TItem[]>(`${items(t)}/bulk`, { studySetId, items: inputs });
}

export function updateItem<TItem extends ContentItemBase>(t: ContentApiTarget, id: string, input: ContentItemInput<TItem>, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.put<TItem>(`${items(t)}/${enc(id)}`, input);
}

export function deleteItem(t: ContentApiTarget, id: string, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.delete<unknown>(`${items(t)}/${enc(id)}`);
}

/** Tìm mục trên toàn cây (tab "Quản lý từ vựng" của flashcard), phân trang phía máy chủ (page từ 0). */
export function searchItems<TItem extends ContentItemBase>(t: ContentApiTarget, q: string, page = 0, size = 20) {
  return hskClient.get<ContentPage<ContentItemWithContext<TItem>>>(`${items(t)}/search?q=${enc(q)}&page=${page}&size=${size}`);
}
