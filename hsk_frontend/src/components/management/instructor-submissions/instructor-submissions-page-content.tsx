"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InstructorSubmissionsView } from "@/components/management/instructor-submissions/instructor-submissions-view";
import { useScheduleStudents } from "@/components/management/instructor-submissions/use-schedule-students";
import { checkGradingParams, gradingWorkspaceHref, readText } from "@/lib/grading/grading-params";
import { filterAndSortStudents, studentDisplayName } from "@/lib/grading/submission-model";
import type { GradingStudentResponse } from "@/types/grading";

// Màn "Danh sách nộp bài" của một buổi (HSK cũ: SubmissionListPage). Query giữ nguyên hợp đồng cũ: classId, courseId, scheduleId, title. Tìm kiếm là state cục bộ.
export function InstructorSubmissionsPageContent() {
  const router = useRouter();
  const params = useSearchParams();

  const check = checkGradingParams({ classId: params.get("classId"), scheduleId: params.get("scheduleId") });
  const courseId = readText(params.get("courseId"));
  const sessionTitle = readText(params.get("title"));
  const classId = check.kind === "ok" ? check.classId : readText(params.get("classId"));
  const scheduleId = check.kind === "ok" ? check.scheduleId : readText(params.get("scheduleId"));

  const { state, reload } = useScheduleStudents(check.kind === "ok" ? { classId: check.classId, scheduleId: check.scheduleId } : null);
  const [keyword, setKeyword] = useState("");
  const students = useMemo(() => (state.kind === "ok" ? state.data : []), [state]);
  const filtered = useMemo(() => filterAndSortStudents(students, keyword), [students, keyword]);

  const openDetail = (student: GradingStudentResponse) => {
    router.push(gradingWorkspaceHref({ scheduleId, userId: student.userId, classId, courseId, title: sessionTitle, studentName: studentDisplayName(student) }));
  };

  return (
    <InstructorSubmissionsView
      state={state}
      paramNotice={check.kind === "notice" ? check.notice : null}
      classId={classId}
      courseId={courseId}
      sessionTitle={sessionTitle}
      keyword={keyword}
      filtered={check.kind === "ok" ? filtered : []}
      onKeywordChange={setKeyword}
      onOpenDetail={openDetail}
      onRetry={reload}
    />
  );
}
