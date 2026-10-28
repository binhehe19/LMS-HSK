"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InstructorLessonListView, type LessonListNotice } from "@/components/management/instructor-lesson-list/instructor-lesson-list-view";
import { useClassLessons } from "@/components/management/instructor-lesson-list/use-class-lessons";
import { LESSON_LIST_PAGE_SIZE, filterAndSortLessons, lessonTargetHref, type LessonTarget } from "@/lib/lesson-list/lesson-list-model";
import { checkClassId, clampPage, parsePage, readCourseId } from "@/lib/lesson-list/lesson-list-params";
import type { GradingScheduleResponse } from "@/types/grading";

// Màn "Danh sách bài học" của một lớp (HSK cũ: LessonListPage). classId/courseId/page lấy từ URL (hợp đồng URL giữ nguyên); số trang nằm trong URL (?page=)
// để nút "quay lại" của trình duyệt về đúng trang đang xem. Tìm kiếm là state cục bộ.
export function InstructorLessonListPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const classCheck = checkClassId(params.get("classId"));
  const classId = classCheck.kind === "ok" ? classCheck.classId : null;
  const courseId = readCourseId(params.get("courseId"));
  const paramNotice: LessonListNotice | null = classCheck.kind === "ok" ? null : { kind: classCheck.kind === "missing" ? "missing-class" : "invalid-class" };

  const { state, reload } = useClassLessons(classId); // classId không hợp lệ => không gọi API
  const [keyword, setKeyword] = useState("");
  const lessons = useMemo(() => (state.kind === "ok" ? state.data : []), [state]);
  const filtered = useMemo(() => filterAndSortLessons(lessons, keyword), [lessons, keyword]);
  const page = clampPage(parsePage(params.get("page")), filtered.length, LESSON_LIST_PAGE_SIZE);

  // Ghi số trang vào URL bằng replace (như bản cũ: setSearchParams(..., { replace: true })), giữ nguyên các tham số khác.
  const setPage = (next: number) => {
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set("page", String(next));
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };
  // Chỉ khi NGƯỜI DÙNG gõ tìm kiếm mới về trang 1 (không làm khi vào trang, để giữ trang đã lưu trong URL).
  const changeKeyword = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  const go = (target: LessonTarget) => (l: GradingScheduleResponse) => {
    if (classId) router.push(lessonTargetHref(target, classId, courseId, l));
  };

  return (
    <InstructorLessonListView
      state={state}
      paramNotice={paramNotice}
      keyword={keyword}
      filtered={paramNotice ? [] : filtered}
      page={page}
      onKeywordChange={changeKeyword}
      onPageChange={setPage}
      onOpenDetail={go("lesson-detail")}
      onOpenSubmissions={go("submissions")}
      onOpenLearningAnalysis={go("learning-analysis")}
      onRetry={reload}
    />
  );
}
