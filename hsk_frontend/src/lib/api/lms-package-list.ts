"use client";

// Liệt kê ContentPackage của repo-lms cho các màn Kho HSK (bài tập, ngữ pháp, thẻ ghi nhớ/từ vựng, tài liệu học tập).
// Kho HSK tạo gói với syllabusId GIẢ `HSK-LIBRARY*` (backend bắt buộc mỗi gói thuộc một giáo trình). Trước đây danh sách lọc theo đúng mã giả
// đó nên không thấy gói gắn giáo trình thật (tạo từ LMS khác dùng chung backend). Giờ lấy MỌI gói cùng loại và gắn kèm nguồn giáo trình để
// giao diện hiển thị/lọc — phân biệt gói của Kho với gói của một giáo trình cụ thể.
import { lmsClient } from "@/lib/api/lms-client";
import { listSyllabuses } from "@/lib/api/lms-syllabus-client";
import type { PageResponse } from "@/types/lms";

/** Tiền tố syllabusId giả của Kho HSK (HSK-LIBRARY, HSK-LIBRARY-QUIZ, HSK-LIBRARY-GRAMMAR, HSK-LIBRARY-SLIDE...). */
export const HSK_LIBRARY_PREFIX = "HSK-LIBRARY";
export const HSK_LIBRARY_LABEL = "Kho HSK";

// Backend kẹp `size` tối đa 100 (ContentPackageService.searchPackageResponses) nên phải đi hết các trang.
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export interface PackageSyllabusSource {
  syllabusId?: string;
  /** "Kho HSK" cho gói của Kho; tên (mã) giáo trình cho gói gắn giáo trình thật; mã thô khi không tra được tên. */
  syllabusName?: string;
}

export function isHskLibrarySyllabus(syllabusId: string | null | undefined): boolean {
  return typeof syllabusId === "string" && syllabusId.startsWith(HSK_LIBRARY_PREFIX);
}

/** Mọi gói thuộc `type`, không lọc theo giáo trình. */
export async function listAllContentPackages<T>(type: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await lmsClient.get<PageResponse<T>>(`/content-packages?type=${encodeURIComponent(type)}&page=${page}&size=${PAGE_SIZE}`);
    const items = res.items ?? [];
    all.push(...items);
    if (items.length < PAGE_SIZE || page + 1 >= (res.total_pages ?? 0)) break;
  }
  return all;
}

/**
 * Hàm tra nguồn giáo trình của một gói. Tên giáo trình lấy từ GET /syllabuses và CHỈ được gọi khi có gói gắn giáo trình thật;
 * lỗi tra tên không làm hỏng danh sách gói (hiện mã giáo trình thay cho tên).
 */
export async function syllabusSourceResolver(syllabusIds: readonly (string | null | undefined)[]): Promise<(syllabusId: string | null | undefined) => PackageSyllabusSource> {
  const names = new Map<string, string>();
  if (syllabusIds.some((id) => id && !isHskLibrarySyllabus(id))) {
    try {
      for (const s of await listSyllabuses()) {
        const name = s.name?.trim();
        const code = s.code?.trim();
        names.set(s.id, name && code ? `${name} (${code})` : name || code || s.id);
      }
    } catch {
      // Không tra được tên: vẫn hiện danh sách, nguồn hiển thị bằng mã giáo trình.
    }
  }
  return (syllabusId) => {
    if (!syllabusId) return {};
    if (isHskLibrarySyllabus(syllabusId)) return { syllabusId, syllabusName: HSK_LIBRARY_LABEL };
    return { syllabusId, syllabusName: names.get(syllabusId) ?? syllabusId };
  };
}
