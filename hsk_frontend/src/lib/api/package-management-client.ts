"use client";

import { lmsClient } from "./lms-client";
import { listSyllabusVersions } from "./lms-syllabus-client";
import { assertWriteEnabled } from "./write-gate";
import type { ContentPackage } from "@/types/content";
import type { PageResponse } from "@/types/lms";

type ManagedVersion = { title: string | null; description?: string | null; sessionCount?: number | null; level?: string | null; topic?: string | null; version?: number };

export interface ManagedPackage {
  id: string;
  type: string;
  createdAt?: string;
  updatedAt?: string;
  syllabusId?: string | null;
  draftVersionId?: string | null;
  publishedVersionId?: string | null;
  resourceCount?: number;
  sessionCount?: number;
  draftVersion?: ManagedVersion | null;
  publishedVersion?: ManagedVersion | null;
}
export interface PackageLink {
  id: string;
  learningResourceId: string;
  learningResourceVersionId: string;
  resourceType: string;
  resourceTitle?: string;
  resourceContent: unknown;
  subType?: string;
  skill?: string;
  sessionNo: number;
  displayOrder: number;
}
export type PackageResourceSource = Pick<PackageLink, "id" | "learningResourceId" | "resourceType" | "resourceTitle" | "resourceContent" | "subType" | "skill"> & { sessionNo?: number; fromDictionary?: true };
export const packageTitle = (p: ManagedPackage) => p.draftVersion?.title || p.publishedVersion?.title || p.id;

export function toContentPackage(pkg: ManagedPackage): ContentPackage {
  const version = pkg.draftVersion ?? pkg.publishedVersion;
  return {
    id: pkg.id,
    type: pkg.type,
    name: version?.title ?? "",
    description: version?.description ?? undefined,
    syllabusId: pkg.syllabusId,
    resourceCount: pkg.resourceCount,
    sessionCount: Math.max(1, pkg.sessionCount ?? 0, version?.sessionCount ?? 0),
    level: version?.level,
    topic: version?.topic,
    publishedVersion: pkg.publishedVersion?.version,
    hasDraft: !!pkg.draftVersionId,
    publishStatus: pkg.publishedVersionId ? "PUBLISHED" : "DRAFT",
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
}

export function packageResourceTitle(row: PackageResourceSource): string {
  const content = row.resourceContent as { title?: unknown; word?: unknown } | null;
  const title = content?.title || content?.word;
  return row.resourceTitle || (typeof title === "string" && title ? title : row.learningResourceId);
}

export async function listManagedPackages(type?: string, syllabusId?: string): Promise<ManagedPackage[]> {
  const items: ManagedPackage[] = [];
  for (let page = 0; ; page++) {
    const query = new URLSearchParams({ page: String(page), size: "100" });
    if (type) query.set("type", type);
    if (syllabusId) query.set("syllabusId", syllabusId);
    const result = await lmsClient.get<PageResponse<ManagedPackage>>(`/content-packages?${query}`);
    items.push(...result.items);
    if (!result.items.length || page + 1 >= result.total_pages) return items;
  }
}
export async function syllabusBinding(syllabusId?: string) {
  if (!syllabusId) return {};
  const versions = await listSyllabusVersions(syllabusId);
  const version = versions.find(v => v.status === "PUBLISHED") ?? versions[0];
  if (!version) throw new Error("Giáo trình chưa có phiên bản.");
  return { syllabusId, syllabusVersionId: version.id };
}
export async function attachOrCopyPackage(packageId: string, syllabusId: string, demo: boolean) {
  assertWriteEnabled("content", demo);
  const pkg = await lmsClient.get<ManagedPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  return pkg.syllabusId
    ? copyPackageToSyllabus(packageId, syllabusId, demo)
    : attachPackageToSyllabus(packageId, syllabusId, demo);
}

export async function copyPackageToSyllabus(packageId: string, syllabusId: string, demo: boolean) {
  assertWriteEnabled("content", demo);
  return lmsClient.post<ManagedPackage>(`/content-packages/${encodeURIComponent(packageId)}/copy`, await syllabusBinding(syllabusId));
}

export async function attachPackageToSyllabus(packageId: string, syllabusId: string, demo: boolean) {
  assertWriteEnabled("content", demo);
  return lmsClient.put<ManagedPackage>(`/content-packages/${encodeURIComponent(packageId)}/syllabus`, await syllabusBinding(syllabusId));
}
export async function packageLinks(packageId: string, activeVersionId?: string): Promise<PackageLink[]> {
  if (activeVersionId) return lmsClient.get<PackageLink[]>(`/content-packages/versions/${encodeURIComponent(activeVersionId)}/resources`);
  const pkg = await lmsClient.get<ManagedPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
  return versionId ? lmsClient.get<PackageLink[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`) : [];
}

/** Copy the pinned version from a source package, or the published resource from the dictionary. */
export async function importPackageResources(packageId: string, rows: PackageResourceSource[], sessionNo: number, demo: boolean) {
  assertWriteEnabled("content", demo);
  if (!Number.isInteger(sessionNo) || sessionNo < 1) throw new Error("Buổi học không hợp lệ.");
  const pkg = await lmsClient.get<ManagedPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  const versionId = pkg.draftVersionId ?? (await lmsClient.post<{ id: string }>(`/content-packages/${encodeURIComponent(packageId)}/draft`)).id;
  const path = `/content-packages/versions/${encodeURIComponent(versionId)}/resources`;
  const existing = await lmsClient.get<PackageLink[]>(`${path}?sessionNo=${sessionNo}`);
  let order = Math.max(-1, ...existing.map(r => r.displayOrder)) + 1;
  const result = { added: 0, failed: [] as { id: string; message: string }[] };
  for (const row of rows) {
    let createdId: string | undefined;
    try {
      if (row.resourceType !== pkg.type) throw new Error("Loại học liệu không khớp học phần đích.");
      let content = row.resourceContent;
      if (row.fromDictionary) {
        const source = await lmsClient.get<{ type: string; subType: string; inLibrary: boolean; publishedVersionId: string | null; content: unknown }>(
          `/learning-resources/${encodeURIComponent(row.learningResourceId)}`,
        );
        if (source.type !== "VOCABULARY" || source.subType !== "ZH" || !source.inLibrary || !source.publishedVersionId || !source.content) {
          throw new Error("Từ không còn khả dụng trong Từ điển.");
        }
        content = source.content;
      }
      const created = await lmsClient.post<{ id: string; publishedVersionId?: string; draftVersionId?: string }>("/learning-resources", {
        type: row.resourceType, content, subType: row.subType, skill: row.skill,
        sourceResourceId: row.learningResourceId, inLibrary: false, publishImmediately: true,
      });
      createdId = created.id;
      const resourceVersionId = created.publishedVersionId ?? created.draftVersionId;
      if (!resourceVersionId) throw new Error("Không lấy được phiên bản học liệu vừa sao chép.");
      await lmsClient.post(path, { learningResourceId: created.id, learningResourceVersionId: resourceVersionId, sessionNo, displayOrder: order++ });
      result.added++;
    } catch (error) {
      let message = error instanceof Error ? error.message : "Không thể nhập học liệu.";
      if (createdId) {
        try { await lmsClient.delete(`/learning-resources/${encodeURIComponent(createdId)}`); }
        catch { message += ` Không thể dọn bản sao ${createdId}.`; }
      }
      result.failed.push({ id: row.id, message });
    }
  }
  return result;
}
