"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AttemptGradingPanel } from "@/components/management/instructor-grading/attempt-grading-panel";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { listLmsStudentAttempts } from "@/lib/api/lms-grading-source";
import { GRADING_PARAM_NOTICE_TEXT, checkGradingParams, readText, submissionsHref } from "@/lib/grading/grading-params";

/**
 * Màn chấm bài của một học viên trong một buổi, trên backend chung (`/management/assessment-attempts`, chỉ ROLE_ADMIN). Giữ nguyên query của màn
 * cũ (scheduleId = id buổi học của lớp, userId = id học viên). Mỗi bài làm của học viên trong buổi là một khung chấm riêng, có khoá chấm riêng.
 */
export function LmsGradingWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const check = checkGradingParams({ classId: params.get("classId"), scheduleId: params.get("scheduleId"), userId: params.get("userId") });
  const courseId = readText(params.get("courseId"));
  const sessionTitle = readText(params.get("title"));
  const studentName = readText(params.get("studentName")) || "—";
  const classId = check.kind === "ok" ? check.classId : readText(params.get("classId"));
  const scheduleId = check.kind === "ok" ? check.scheduleId : readText(params.get("scheduleId"));

  const { state, reload } = useKeyedFetch(check.kind === "ok" ? `lms-grading:${check.classId}:${check.scheduleId}:${check.userId}` : null, () =>
    listLmsStudentAttempts((check as { classId: string }).classId, (check as { scheduleId: string }).scheduleId, (check as { userId: string }).userId),
  );
  const attempts = state.kind === "ok" ? state.data.filter((a) => a.status === "SUBMITTED") : [];

  return (
    <ManagementPageFrame contentClassName="cm-grading-workspace-page">
      <div className="cm-sticky-header d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="cm-icon-btn btn btn-sm border" aria-label="Quay lại" onClick={() => router.push(submissionsHref({ classId, courseId, scheduleId, title: sessionTitle }))}>
            <i className="isax isax-arrow-left-2" />
          </button>
          <h6 className="mb-0 fw-bold">
            Bài làm của học viên: <span className="text-danger">{studentName}</span>
          </h6>
        </div>
        <h6 className="mb-0 fw-bold text-danger">{sessionTitle}</h6>
      </div>
      <div className="cm-grading-workspace-body p-3">
        {check.kind === "notice" ? (
          <div className="alert alert-warning mb-0" role="status" data-testid="grading-notice" data-kind={check.notice}>
            {GRADING_PARAM_NOTICE_TEXT[check.notice]}
          </div>
        ) : (
          <FetchStateNotice state={state} waitingText="Màn chấm bài chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={reload} testId="grading-notice" />
        )}
        {state.kind === "loading" && check.kind === "ok" && (
          <div className="text-center py-4">
            <span className="spinner-border text-primary" />
          </div>
        )}
        {state.kind === "ok" && attempts.length === 0 && (
          <div className="card">
            <div className="card-body text-muted text-center py-5">Học viên chưa nộp bài nào</div>
          </div>
        )}
        {attempts.map((attempt) => (
          <AttemptGradingPanel key={attempt.attemptId} attemptId={attempt.attemptId} title={attempt.title || "Bài tập"} />
        ))}
      </div>
    </ManagementPageFrame>
  );
}
