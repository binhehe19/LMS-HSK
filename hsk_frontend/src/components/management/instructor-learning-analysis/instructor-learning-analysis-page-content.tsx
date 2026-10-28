"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InstructorLearningAnalysisView } from "@/components/management/instructor-learning-analysis/instructor-learning-analysis-view";
import { useScheduleStudents } from "@/components/management/instructor-learning-analysis/use-schedule-students";
import { filterStudents, learningAnalysisDetailHref, lessonListHref } from "@/lib/learning-analysis/learning-analysis-model";
import { paramNoticeText, readListParams } from "@/lib/learning-analysis/learning-analysis-params";
import type { GradingStudentResponse } from "@/types/grading";

// Màn "Phân tích học tập" (danh sách học viên của buổi; HSK cũ: LearningAnalysisListPage). classId/courseId/scheduleId/title lấy từ URL (hợp đồng giữ nguyên);
// tìm kiếm là state cục bộ. Nút "Xem chi tiết" sang /detail với query cũ (userId định danh; studentEmail chỉ để tương thích liên kết).
export function InstructorLearningAnalysisPageContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const check = readListParams((name) => sp.get(name));
  const params = check.kind === "ok" ? check.params : null;
  const paramNotice = check.kind === "ok" ? null : paramNoticeText(check, "Danh sách bài học");

  const { state, reload } = useScheduleStudents(params); // tham số lỗi => không gọi API
  const [keyword, setKeyword] = useState("");
  const students = useMemo(() => (state.kind === "ok" ? state.data : []), [state]);
  const filtered = useMemo(() => filterStudents(students, keyword), [students, keyword]);

  const openDetail = (s: GradingStudentResponse) => {
    if (params) router.push(learningAnalysisDetailHref(params, s));
  };

  return (
    <InstructorLearningAnalysisView
      state={state}
      paramNotice={paramNotice}
      title={(sp.get("title") ?? "").trim()}
      lessonListHref={params ? lessonListHref(params.classId, params.courseId) : "/instructor/list-class"}
      keyword={keyword}
      filtered={filtered}
      onKeywordChange={setKeyword}
      onOpenDetail={openDetail}
      onRetry={reload}
    />
  );
}
