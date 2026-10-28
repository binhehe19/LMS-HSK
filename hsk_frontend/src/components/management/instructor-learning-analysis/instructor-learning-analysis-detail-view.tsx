"use client";

// Port của LMS_Frontend/src/features/instructor/class-management/learning-analysis-detail-page.tsx (cùng DOM, class, style nội tuyến và chữ).
// View thuần: không gọi API; mọi dữ liệu/trạng thái qua props (container: instructor-learning-analysis-detail-page-content.tsx).
//
// Khác bản cũ có chủ đích: (1) tham số URL thiếu/không hợp lệ => thông báo, không gọi API; (2) mỗi khối (bài tập, chuyên cần, kỹ năng, AI, nhận xét) có
// trạng thái loading/waiting/error riêng với "Thử lại" — bản cũ IM LẶNG bỏ qua lỗi chuyên cần/kỹ năng/AI và chỉ toast lỗi bài tập; (3) biểu đồ
// "Điểm theo kỹ năng" được RENDER (bản cũ tính `skillChart` nhưng không đưa vào JSX); (4) đường "Trung bình lớp" vẽ nét đứt để phân biệt không chỉ bằng
// màu (xám #9a9690 tương phản 2.87:1); (5) thẻ biểu đồ vẫn ẨN khi dữ liệu rỗng thật như bản cũ ("không dựng card rỗng"), chỉ hiện khi đang tải/lỗi;
// (6) thao tác ghi khoá theo công tắc "teacher-note" (xem personalization-panel.tsx).
import Link from "next/link";
import type { LearningAnalysisDetailData } from "@/components/management/instructor-learning-analysis/use-learning-analysis-detail";
import { PersonalizationPanel } from "@/components/management/instructor-learning-analysis/personalization-panel";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { ApexChart } from "@/components/shared/apex-chart";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { initials } from "@/lib/class-list/class-list-model";
import {
  ATTENDANCE_BADGE_CLASS,
  ATTENDANCE_CHIP_COLOR,
  attendanceChipText,
  attendanceLabel,
  attendanceTone,
  countDone,
  formatScore,
  groupAssignments,
  skillChartSpec,
  trendChartSpec,
} from "@/lib/learning-analysis/learning-analysis-model";
import type { LearningAnalysisDetailParams } from "@/lib/learning-analysis/learning-analysis-params";

interface InstructorLearningAnalysisDetailViewProps {
  params: LearningAnalysisDetailParams | null;
  paramNotice: string | null;
  /** Đích của breadcrumb "Phân tích học tập" (danh sách học viên của buổi). */
  backHref: string;
  data: LearningAnalysisDetailData;
  writeEnabled: boolean;
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onSendNote: () => void;
  sendingNote: boolean;
  generating: boolean;
  onGenerate: () => void;
  approving: boolean;
  onApprove: () => void;
}

/** Thân thẻ biểu đồ khi chưa có dữ liệu để vẽ: spinner lúc tải, thông báo khi waiting/error. */
function ChartPlaceholder<T>({ state, waitingText, onRetry, testId }: { state: FetchState<T>; waitingText: string; onRetry: () => void; testId: string }) {
  if (state.kind === "loading") {
    return (
      <div className="text-center py-4" role="status">
        <span className="spinner-border text-primary" />
      </div>
    );
  }
  return <FetchStateNotice state={state} waitingText={waitingText} onRetry={onRetry} testId={testId} />;
}

export function InstructorLearningAnalysisDetailView({ params, paramNotice, backHref, data, writeEnabled, noteDraft, onNoteDraftChange, onSendNote, sendingNote, generating, onGenerate, approving, onApprove }: InstructorLearningAnalysisDetailViewProps) {
  const studentName = params?.studentName ?? "";
  const sessionTitle = params?.title ?? "";
  const assignments = data.assignments.kind === "ok" ? data.assignments.data : [];
  const groups = groupAssignments(assignments);
  const trend = data.attendance.kind === "ok" ? data.attendance.data.trend : [];
  const log = data.attendance.kind === "ok" ? data.attendance.data.log : [];
  const skills = data.skills.kind === "ok" ? data.skills.data : [];
  const showTrendCard = data.attendance.kind !== "ok" || trend.length > 0;
  const showSkillCard = data.skills.kind !== "ok" || skills.length > 0;

  return (
    <ManagementPageFrame>
      <nav className="mb-3 small">
        <Link href="/instructor/list-class" prefetch={false} className="text-primary">
          Danh sách lớp học
        </Link>
        <span className="mx-2 text-muted">›</span>
        <Link href={backHref} prefetch={false} className="text-primary">
          Phân tích học tập
        </Link>
        <span className="mx-2 text-muted">›</span>
        <span className="text-muted">{studentName || "Chi tiết học viên"}</span>
      </nav>

      {paramNotice && (
        <div className="alert alert-warning" role="status" data-testid="la-param-notice">
          {paramNotice}
        </div>
      )}

      {params && (
        <>
          {/* ---- Header ---- */}
          <div className="card mb-3">
            <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div className="d-flex align-items-center gap-3">
                <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary fw-bold flex-shrink-0" style={{ width: 48, height: 48, fontSize: 15 }} aria-hidden="true">
                  {initials(studentName)}
                </span>
                <div>
                  <div className="fw-bold" style={{ fontSize: 17 }}>
                    {studentName || "—"}
                  </div>
                  {sessionTitle && <span className="badge bg-danger">{sessionTitle}</span>}
                </div>
              </div>
              <div className="text-muted small" data-testid="assignment-summary">
                Bài tập buổi này:{" "}
                <span className="fw-semibold text-dark">
                  {data.assignments.kind === "waiting" || data.assignments.kind === "error" ? "–/–" : `${countDone(assignments)}/${assignments.length}`}
                </span>{" "}
                đã làm
              </div>
            </div>
          </div>

          {data.assignments.kind === "loading" && (
            <div className="text-center py-4" role="status">
              <span className="spinner-border text-primary" />
            </div>
          )}

          <PersonalizationPanel
            state={data.personalization}
            scheduleId={params.scheduleId}
            onRetry={data.reload.personalization}
            writeEnabled={writeEnabled}
            generating={generating}
            onGenerate={onGenerate}
            approving={approving}
            onApprove={onApprove}
            noteState={data.note}
            onRetryNote={data.reload.note}
            noteDraft={noteDraft}
            onNoteDraftChange={onNoteDraftChange}
            onSendNote={onSendNote}
            sendingNote={sendingNote}
          />

          {(showTrendCard || showSkillCard) && (
            <div className="row g-3 mb-3">
              {showTrendCard && (
                <div className="col-12">
                  <div className="card h-100" data-testid="trend-card">
                    <div className="card-header bg-light fw-bold">Xu hướng chuyên cần (từ đầu lớp đến buổi này)</div>
                    <div className="card-body">
                      {trend.length > 0 ? (
                        <>
                          <ApexChart {...trendChartSpec(trend)} type="line" height={260} />
                          {log.length > 0 && (
                            <div className="d-flex flex-wrap gap-1 mt-2" data-testid="attendance-chips">
                              {log.map((entry, idx) => (
                                <span
                                  key={`${entry.sessionLabel}-${idx}`}
                                  title={`${entry.sessionLabel} (${entry.date || "-"}): ${attendanceLabel(entry.status)}${entry.note ? " — " + entry.note : ""}`}
                                  className="rounded-2"
                                  style={{ width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", background: ATTENDANCE_CHIP_COLOR[attendanceTone(entry.status)], cursor: "default" }}
                                >
                                  {attendanceChipText(entry.sessionLabel)}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <ChartPlaceholder state={data.attendance} waitingText="Chuyên cần chưa được kết nối API (WAITING FOR BACKEND)." onRetry={data.reload.attendance} testId="attendance-notice" />
                      )}
                    </div>
                  </div>
                </div>
              )}
              {showSkillCard && (
                <div className="col-12">
                  <div className="card h-100" data-testid="skill-card">
                    <div className="card-header bg-light fw-bold">Điểm theo kỹ năng của buổi học (học viên so với trung bình lớp)</div>
                    <div className="card-body">
                      {skills.length > 0 ? (
                        <ApexChart {...skillChartSpec(skills)} type="bar" height={240} />
                      ) : (
                        <ChartPlaceholder state={data.skills} waitingText="Điểm theo kỹ năng chưa được kết nối API (WAITING FOR BACKEND)." onRetry={data.reload.skills} testId="skills-notice" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card mb-3" data-testid="assignments-card">
            <div className="card-header bg-light fw-bold">Dữ liệu bài làm của buổi học</div>
            <div className="card-body">
              {(data.assignments.kind === "waiting" || data.assignments.kind === "error") && <FetchStateNotice state={data.assignments} waitingText="Bài tập của buổi chưa được kết nối API (WAITING FOR BACKEND)." onRetry={data.reload.assignments} testId="assignments-notice" />}
              {data.assignments.kind === "ok" && groups.length === 0 && <div className="text-center text-muted py-3">Buổi này chưa có bài tập (quiz).</div>}
              {groups.map((group) => (
                <div key={group.label} className="mb-3" data-testid="assignment-group">
                  <div className="small fw-semibold text-primary mb-2">{group.label}</div>
                  {group.items.map((a) => (
                    <div key={a.quizId} className="d-flex align-items-center gap-2 mb-2" data-testid="assignment-row" data-status={a.status}>
                      <i className={`isax ${a.status === "DONE" ? "isax-tick-circle text-success" : "isax-record-circle text-muted"}`} aria-hidden="true" />
                      <span className="text-dark">{a.label}</span>
                      {a.status === "DONE" ? (
                        <span className="text-primary small">
                          {formatScore(a.score ?? 0)}/{formatScore(a.maxScore ?? 0)}
                        </span>
                      ) : (
                        <span className="text-muted fst-italic small">Chưa làm</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {log.length > 0 && (
            <div className="card" data-testid="attendance-log">
              <div className="card-header bg-light fw-bold">Lịch sử điểm danh</div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Buổi</th>
                        <th>Ngày</th>
                        <th>Trạng thái</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.map((entry, idx) => (
                        <tr key={`${entry.sessionLabel}-${idx}`}>
                          <td>{entry.sessionLabel}</td>
                          <td>{entry.date || "-"}</td>
                          <td>
                            <span className={`badge rounded-pill ${ATTENDANCE_BADGE_CLASS[attendanceTone(entry.status)]}`}>{attendanceLabel(entry.status)}</span>
                          </td>
                          <td className="text-muted small">{entry.note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </ManagementPageFrame>
  );
}
