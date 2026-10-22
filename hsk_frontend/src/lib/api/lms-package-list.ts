"use client";

// Liệt kê học phần tự do (ContentPackage chưa thuộc giáo trình nào, `syllabusId` null) của repo-lms cho các màn Kho HSK
// (bài tập, ngữ pháp, thẻ ghi nhớ/từ vựng, tài liệu học tập). Backend lọc bằng `library=true`; học phần của một giáo trình cụ thể
// không hiện ở Kho.
import { lmsClient } from "@/lib/api/lms-client";
import type { PageResponse } from "@/types/lms";

// Backend kẹp `size` tối đa 100 (ContentPackageService.searchPackageResponses) nên phải đi hết các trang.
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/** Mọi học phần tự do thuộc `type`. */
export async function listFreeContentPackages<T>(type: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await lmsClient.get<PageResponse<T>>(`/content-packages?type=${encodeURIComponent(type)}&library=true&page=${page}&size=${PAGE_SIZE}`);
    const items = res.items ?? [];
    all.push(...items);
    if (items.length < PAGE_SIZE || page + 1 >= (res.total_pages ?? 0)) break;
  }
  return all;
}
