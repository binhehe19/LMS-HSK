"use client";

// Tên buổi (tùy chọn) của một học phần theo id gói. Cùng backend và cùng hợp đồng với package-topics-client.ts, nhưng khóa theo số buổi nên khi gói
// vừa được tạo bản nháp thì không phải tra lại id.
//
// Backend chỉ ghi tên buổi trên phiên bản NHÁP: gói đã xuất bản mà chưa có nháp thì lần ghi đầu tạo nháp bằng cách nhân bản (tên buổi được nhân bản theo).
import { ApiError } from "@/lib/api/api-client";
import { lmsClient } from "@/lib/api/lms-client";
import { getPackage, writableVersion } from "@/lib/api/package-topics-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";

const FEATURE = "content";

interface BackendSessionName {
  sessionNo: number;
  title: string;
}

const enc = encodeURIComponent;

/** sessionNo → tên; buổi chưa đặt tên không có khóa. Đọc bản nháp nếu có, không thì bản đã xuất bản; backend chưa có API (404) thì coi như chưa có tên. */
export async function listPackageSessionNames(packageId: string): Promise<Record<number, string>> {
  const pkg = await getPackage(packageId);
  const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
  if (!versionId) return {};
  try {
    const rows = await lmsClient.get<BackendSessionName[]>(`/content-packages/versions/${enc(versionId)}/sessions`);
    return Object.fromEntries(rows.map((row) => [row.sessionNo, row.title]));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return {};
    throw error;
  }
}

/** Đặt hoặc đổi tên buổi. */
export async function renamePackageSession(packageId: string, sessionNo: number, title: string, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const { versionId } = await writableVersion(packageId);
  await lmsClient.put(`/content-packages/versions/${enc(versionId)}/sessions/${sessionNo}`, { title });
}

/** Xóa tên buổi; buổi và học liệu trong buổi không đổi. */
export async function clearPackageSession(packageId: string, sessionNo: number, demo: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demo);
  const { versionId } = await writableVersion(packageId);
  await lmsClient.delete(`/content-packages/versions/${enc(versionId)}/sessions/${sessionNo}`);
}
