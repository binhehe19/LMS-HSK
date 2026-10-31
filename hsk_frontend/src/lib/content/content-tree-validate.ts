// Kiểm tra + chuẩn hoá form gói/thư mục/bộ (thông điệp giữ nguyên bản cũ manage-flashcard.tsx) và thông điệp lỗi thao tác ghi thống nhất.
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import type { ContentFolderInput, ContentLabels, ContentPackageInput, ContentStudySetInput } from "@/types/content";

export const WRITE_NOT_INTEGRATED_MESSAGE = "Thao tác chưa được tích hợp với backend (WAITING FOR BACKEND).";

/** Công tắc đóng / dịch vụ chưa cấu hình => "chưa tích hợp"; lỗi API => thông điệp của nó; khác => câu dự phòng của bản cũ. */
export function writeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof WriteDisabledError || error instanceof ApiNotConfiguredError) return WRITE_NOT_INTEGRATED_MESSAGE;
  if (error instanceof ApiError) return error.message;
  return fallback;
}

const clean = (value: string | undefined | null): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};

export function validatePackageInput(input: ContentPackageInput): string | null {
  if (!input.name.trim() || !input.type.trim()) return "Vui lòng điền đầy đủ các trường bắt buộc";
  return null;
}

export function normalizePackageInput(input: ContentPackageInput): ContentPackageInput {
  return { name: input.name.trim(), type: input.type.trim(), description: clean(input.description) };
}

export function validateFolderInput(input: ContentFolderInput, labels: ContentLabels): string | null {
  if (!input.name.trim()) return `Vui lòng nhập tên ${labels.folder.toLowerCase()}`;
  if (!input.packageId) return `Vui lòng chọn ${labels.package.toLowerCase()} trước`;
  return null;
}

export function normalizeFolderInput(input: ContentFolderInput): ContentFolderInput {
  return { packageId: input.packageId, name: input.name.trim(), description: clean(input.description), isPrivate: input.isPrivate ?? false };
}

export function validateStudySetInput(input: ContentStudySetInput, labels: ContentLabels, hasSkill: boolean): string | null {
  if (!input.title.trim()) return `Vui lòng nhập tên ${labels.studySet}`;
  if (!input.folderId) return `Vui lòng chọn ${labels.folder.toLowerCase()} trước`;
  if (hasSkill && !input.skill?.trim()) return "Vui lòng chọn kỹ năng";
  return null;
}

export function normalizeStudySetInput(input: ContentStudySetInput, hasSkill: boolean): ContentStudySetInput {
  return { folderId: input.folderId, title: input.title.trim(), description: clean(input.description), isPrivate: input.isPrivate ?? true, skill: hasSkill ? clean(input.skill) : undefined };
}
