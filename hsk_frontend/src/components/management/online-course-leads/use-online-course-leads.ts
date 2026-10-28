"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch, type FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { listOnlineCourseLeads, listOnlineCourses } from "@/lib/api/online-course-client";
import { buildCourseTypeDictionary } from "@/lib/online-course/lead-model";
import type { OnlineCourseLeadPage } from "@/types/online-course";

/** Kích thước trang cố định của bản cũ (`useState(20)`). */
export const LEADS_PAGE_SIZE = 20;

export interface LeadsQuery {
  courseCode: string;
  /** YYYY-MM-DD hoặc "" */
  from: string;
  to: string;
  page: number;
}

export const EMPTY_LEADS_QUERY: LeadsQuery = { courseCode: "", from: "", to: "", page: 0 };

/**
 * Tải danh sách đăng ký (phân trang máy chủ) theo bộ lọc ĐÃ ÁP DỤNG (bấm "Lọc"), và từ điển loại khoá học từ GET /courses để điền cột "Loại khóa học".
 * Khác bản cũ có chủ đích: lỗi tải là trạng thái màn (bản cũ: toast + bảng rỗng); từ điển lỗi thì bỏ qua lặng lẽ như bản cũ (không chặn màn).
 */
export function useOnlineCourseLeads() {
  const [query, setQuery] = useState<LeadsQuery>(EMPTY_LEADS_QUERY);

  const leads = useKeyedFetch<OnlineCourseLeadPage>(`leads:${query.courseCode}|${query.from}|${query.to}|${query.page}`, async () => {
    try {
      const page = await listOnlineCourseLeads({ courseCode: query.courseCode || undefined, from: query.from || undefined, to: query.to || undefined, page: query.page, size: LEADS_PAGE_SIZE });
      if (!page || !Array.isArray(page.content)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách đăng ký.", 200, "CONTRACT");
      return { ...page, totalElements: Number(page.totalElements ?? page.content.length), totalPages: Math.max(1, Number(page.totalPages ?? 1)), number: Number(page.number ?? query.page) };
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không thể tải danh sách đăng ký"); // như bản cũ
      throw error;
    }
  });

  const courses = useKeyedFetch<Record<string, string>>("leads-course-types", async () => {
    try {
      const list = await listOnlineCourses();
      return buildCourseTypeDictionary(Array.isArray(list) ? list : []);
    } catch {
      return {};
    }
  });

  const state: FetchState<OnlineCourseLeadPage> = leads.state;
  const page = state.kind === "ok" ? state.data : (leads.lastData ?? null);

  return {
    state,
    /** Trang đang hiển thị (kết quả mới nhất hoặc trước đó trong lúc tải). */
    page,
    refreshing: state.kind === "loading" && leads.lastData !== null,
    query,
    /** Áp bộ lọc mới và về trang đầu. */
    applyFilters: (filters: Omit<LeadsQuery, "page">) => setQuery({ ...filters, page: 0 }),
    goToPage: (next: number) => setQuery((prev) => ({ ...prev, page: Math.max(0, next) })),
    reload: leads.reload,
    courseTypes: courses.state.kind === "ok" ? courses.state.data : {},
  };
}
