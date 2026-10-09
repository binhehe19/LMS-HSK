"use client";

// Port của LMS_Frontend/src/features/instructor/class-management/submission-list-page.tsx (cùng DOM, class, style nội tuyến và chữ).
// View thuần: không gọi API, nhận dữ liệu qua props (container: instructor-submissions-page-content.tsx). Chỉ ĐỌC — nút "Chi tiết" chỉ điều hướng sang màn chấm bài.
//
// Khác bản cũ có chủ đích: (1) classId/scheduleId thiếu hoặc không hợp lệ => dòng thông báo, không gọi API (bản cũ: scheduleId rỗng => im lặng, classId tuỳ chọn);
// (2) dịch vụ chưa cấu hình / gọi lỗi => FetchStateNotice (kèm "Thử lại" khi lỗi) thay vì "Chưa có học viên"; (3) không gọi N+1 getGradingAttempt để tính lại điểm
// (xem use-schedule-students.ts); (4) `next/link` cho breadcrumb; (5) type="button" + aria-label cho nút biểu tượng.
import { Progress } from "antd";
import Link from "next/link";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { formatScore, getProgressToneColors, scoreToneClass } from "@/lib/grading/grading-helpers";
import { GRADING_PARAM_NOTICE_TEXT, lessonListHref, type GradingParamNotice } from "@/lib/grading/grading-params";
import { initials, studentBookTone, submittedMaxScore } from "@/lib/grading/submission-model";
import type { GradingStudentResponse } from "@/types/grading";

interface InstructorSubmissionsViewProps {
  /** Trạng thái tải; bị bỏ qua khi `paramNotice` có giá trị (không có lời gọi API). */
  state: FetchState<GradingStudentResponse[]>;
  paramNotice: GradingParamNotice | null;
  classId: string;
  courseId: string;
  sessionTitle: string;
  keyword: string;
  /** Học viên đã tìm + sắp xếp. */
  filtered: GradingStudentResponse[];
  onKeywordChange: (keyword: string) => void;
  onOpenDetail: (student: GradingStudentResponse) => void;
  onRetry: () => void;
}

export function InstructorSubmissionsView({ state, paramNotice, classId, courseId, sessionTitle, keyword, filtered, onKeywordChange, onOpenDetail, onRetry }: InstructorSubmissionsViewProps) {
  const loading = !paramNotice && state.kind === "loading";

  return (
    <ManagementPageFrame>
      <nav className="mb-3 small">
        <Link href="/instructor/list-class" prefetch={false} className="text-primary">
          Danh sách lớp học
        </Link>
        <span className="mx-2 text-muted">›</span>
        <Link href={lessonListHref(classId, courseId)} prefetch={false} className="text-primary">
          Danh sách bài học
        </Link>
        <span className="mx-2 text-muted">›</span>
        <span className="text-muted">Danh sách nộp bài</span>
      </nav>

      <div className="card">
        <div className="card-header d-flex align-items-center gap-2 bg-light">
          <span className="fw-bold">Danh sách học viên gửi bài</span>
          {sessionTitle && <span className="badge bg-danger">{sessionTitle}</span>}
        </div>
        <div className="card-body cm-submission-list-body">
          <div className="row mb-3">
            <div className="col-md-5">
              <label className="form-label text-primary fw-medium" htmlFor="submission-search">
                Tìm kiếm
              </label>
              <input id="submission-search" className="form-control" placeholder="Tìm kiếm tên, mã học viên, email" value={keyword} onChange={(e) => onKeywordChange(e.target.value)} />
            </div>
          </div>

          <div className="cm-submission-header text-muted small fw-semibold border-bottom pb-2 mb-2">
            <div>STT</div>
            <div>Thông tin học viên</div>
            <div className="text-center">Chuyên cần bài tập</div>
            <div className="text-center">Điểm bài tập</div>
            <div className="text-center">Chi tiết</div>
          </div>

          {filtered.map((s, i) => {
            const modules = s.modules ?? [];
            const progressTone = getProgressToneColors(s.completionRate, s.submittedAny);
            const progressToneClass = s.submittedAny && (s.completionRate ?? 0) > 0 ? scoreToneClass(s.completionRate, 100) : "cm-score-tone--muted";
            return (
              <div key={s.userId} className="cm-submission-row py-3 border-bottom" data-testid="submission-row">
                <div className="cm-submission-index">{i + 1}</div>
                <div className="cm-submission-student">
                  <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary fw-bold flex-shrink-0" style={{ width: 38, height: 38, fontSize: 12 }}>
                    {initials(s.name || s.fullName)}
                  </span>
                  <div className="cm-submission-identity">
                    <div className="fw-semibold cm-submission-value">{s.name || s.fullName || "-"}</div>
                    <div className="small cm-submission-value">
                      <span className="text-muted">Mã học viên: </span>
                      {s.studentCode || "-"}
                    </div>
                    <div className="small cm-submission-value">
                      <span className="text-muted">Email: </span>
                      {s.email || "-"}
                    </div>
                  </div>
                </div>
                <div className={`cm-submission-progress text-center ${progressToneClass}`}>
                  <div className="cm-submission-mobile-label">Chuyên cần bài tập</div>
                  <Progress
                    type="circle"
                    percent={s.completionRate ?? 0}
                    size={56}
                    strokeColor={progressTone.stroke}
                    format={(p) => (
                      <span className="cm-progress-percent" style={{ fontSize: 11, color: progressTone.text, fontWeight: 600 }}>
                        {p}%
                      </span>
                    )}
                  />
                </div>
                <div className="cm-submission-score text-center">
                  <div className="cm-submission-mobile-label">Điểm bài tập</div>
                  <div className={`rounded-3 py-2 px-2 ${s.submittedAny ? `cm-score-card ${scoreToneClass(s.totalScore, submittedMaxScore(modules))}` : "bg-light text-muted"}`}>
                    <div className="fw-bold" style={{ fontSize: 22 }}>
                      {formatScore(s.totalScore)}
                    </div>
                    {s.submittedAny ? (
                      <div className="small">
                        <i className="isax isax-tick-circle text-success me-1" />
                        {s.answeredQuestions} / {s.totalQuestions} câu
                      </div>
                    ) : (
                      <div className="small">
                        <i className="isax isax-minus-cirlce me-1" />
                        Chưa nộp bài
                      </div>
                    )}
                  </div>
                </div>
                <div className="cm-submission-detail text-center">
                  <button type="button" className="cm-icon-btn btn btn-icon border" title="Chi tiết" aria-label="Chi tiết" onClick={() => onOpenDetail(s)}>
                    <i className={`isax isax-book ${studentBookTone(modules)}`} />
                  </button>
                </div>
              </div>
            );
          })}

          {paramNotice && (
            <div className="alert alert-warning mb-0" role="status" data-testid="submissions-notice" data-kind={paramNotice}>
              {GRADING_PARAM_NOTICE_TEXT[paramNotice]}
            </div>
          )}
          {!paramNotice && <FetchStateNotice state={state} waitingText="Danh sách nộp bài chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="submissions-notice" />}
          {!paramNotice && state.kind === "ok" && filtered.length === 0 && <div className="text-center text-muted py-4">Chưa có học viên</div>}
          {loading && (
            <div className="text-center py-4">
              <span className="spinner-border text-primary" />
            </div>
          )}
        </div>
      </div>
    </ManagementPageFrame>
  );
}
