"use client";

// Port của LMS_Frontend/src/features/instructor/class-management/grading-workspace-page.tsx (cùng DOM, class, style nội tuyến và chữ).
// View thuần: không gọi API; mọi dữ liệu/suy diễn (nhóm câu, tổng quan, kế hoạch gửi, bản nháp) nhận qua props từ instructor-grading-page-content.tsx.
//
// Khác bản cũ có chủ đích: (1) modal "Cảnh báo" react-bootstrap => antd Modal (cùng chữ, cùng nút OK đỏ); (2) công tắc ghi "quiz-grading" đóng => ô điểm/nhận xét
// bị khoá, nút Lưu/Gửi disabled + WriteLockedNotice (bản cũ không có khái niệm này); (3) khoá URL thiếu/không hợp lệ => thông báo, không gọi API; (4) dịch vụ
// chưa cấu hình / gọi lỗi => FetchStateNotice (có "Thử lại") thay vì "Học viên chưa nộp bài nào"; (5) media chỉ hiện khi repo-storage đã cấu hình (grading-media.ts).
import { Modal } from "antd";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { QuestionGradingCard } from "@/components/management/instructor-grading/question-grading-card";
import type { StudentGradingData } from "@/components/management/instructor-grading/use-student-grading";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { AssetImage } from "@/components/shared/asset-image";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { formatScore, isQuestionReturnedToStudent, scoreToneClass } from "@/lib/grading/grading-helpers";
import { mediaUrl } from "@/lib/grading/grading-media";
import { GRADING_PARAM_NOTICE_TEXT, type GradingParamNotice } from "@/lib/grading/grading-params";
import { draftKeyOf, formatSectionName, type GradeDraft, type IncompleteAttempt, type QuestionGroup, type SendPlan } from "@/lib/grading/grading-workspace-model";
import type { GradingAttemptDetailResponse, GradingAttemptQuestion } from "@/types/grading";

export interface GradingSummary {
  total: number;
  graded: number;
  correct: number;
  score: number;
}

interface InstructorGradingViewProps {
  /** Trạng thái tải; bị bỏ qua khi `paramNotice` có giá trị (không có lời gọi API). */
  state: FetchState<StudentGradingData>;
  paramNotice: GradingParamNotice | null;
  studentName: string;
  sessionTitle: string;
  /** Công tắc ghi "quiz-grading" đang mở (demo hoặc NEXT_PUBLIC_WRITE_QUIZ_GRADING=enabled). */
  writeEnabled: boolean;
  questionGroups: QuestionGroup[];
  questionCount: number;
  summary: GradingSummary;
  totalScore: number;
  totalMaxScore: number;
  sendPlan: SendPlan;
  /** Khoá = draftKeyOf(question, attemptId). */
  saving: Record<string, boolean>;
  sending: boolean;
  incompleteWarning: IncompleteAttempt[];
  getDraft: (question: GradingAttemptQuestion, attemptId: string) => GradeDraft;
  onDraftChange: (key: string, value: GradeDraft) => void;
  onSaveQuestion: (question: GradingAttemptQuestion, scoreValue: string, comment: string, attemptId: string) => Promise<boolean>;
  onSendAll: () => void;
  onCloseWarning: () => void;
  onBack: () => void;
  onRetry: () => void;
}

/** Ngữ liệu dùng chung của một bài (audio/ảnh/đoạn văn) hiện trước câu đầu tiên của bài. */
function PassageMedia({ detail }: { detail: GradingAttemptDetailResponse }) {
  if (!detail.audioFileId && !detail.passageImageFileId && !detail.passageText) return null;
  const audio = mediaUrl(detail.audioFileId);
  const image = mediaUrl(detail.passageImageFileId);
  return (
    <div className="border rounded p-3 mb-3 bg-light" data-testid="passage-media">
      <div className="text-muted small fw-semibold mb-2">
        <i className="isax isax-musicnote me-1" /> Ngữ liệu bài (dùng chung)
      </div>
      {detail.audioFileId && (audio ? <audio controls src={audio} className="w-100 mb-2" /> : <div className="text-muted small mb-2">Không có tệp</div>)}
      {detail.passageImageFileId && (image ? <AssetImage src={image} alt="" className="d-block mb-2 rounded" style={{ maxHeight: 220 }} /> : <div className="text-muted small mb-2">Không có tệp</div>)}
      {detail.passageText && <div style={{ whiteSpace: "pre-wrap" }}>{detail.passageText}</div>}
    </div>
  );
}

export function InstructorGradingView({
  state,
  paramNotice,
  studentName,
  sessionTitle,
  writeEnabled,
  questionGroups,
  questionCount,
  summary,
  totalScore,
  totalMaxScore,
  sendPlan,
  saving,
  sending,
  incompleteWarning,
  getDraft,
  onDraftChange,
  onSaveQuestion,
  onSendAll,
  onCloseWarning,
  onBack,
  onRetry,
}: InstructorGradingViewProps) {
  const loading = !paramNotice && state.kind === "loading";
  const loaded = !paramNotice && state.kind === "ok";
  const nothingToSend = sendPlan.readyAttempts.length === 0 && sendPlan.incompleteAttempts.length === 0;

  return (
    <ManagementPageFrame contentClassName="cm-grading-workspace-page">
      <div className="cm-sticky-header d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="cm-icon-btn btn btn-sm border" onClick={onBack} aria-label="Quay lại">
            <i className="isax isax-arrow-left-2" />
          </button>
          <h6 className="mb-0 fw-bold">
            Bài làm của học viên: <span className="text-danger">{studentName}</span>
          </h6>
        </div>
        <h6 className="mb-0 fw-bold text-danger">{sessionTitle}</h6>
      </div>

      <div className="cm-grading-workspace-body p-3">
        {paramNotice && (
          <div className="alert alert-warning mb-0" role="status" data-testid="grading-notice" data-kind={paramNotice}>
            {GRADING_PARAM_NOTICE_TEXT[paramNotice]}
          </div>
        )}
        {!paramNotice && <FetchStateNotice state={state} waitingText="Màn chấm bài chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="grading-notice" />}

        {loading && (
          <div className="text-center py-4">
            <span className="spinner-border text-primary" />
          </div>
        )}

        {loaded && questionCount === 0 && (
          <div className="card">
            <div className="card-body text-muted text-center py-5">Học viên chưa nộp bài nào</div>
          </div>
        )}

        {loaded && questionCount > 0 && (
          <div className="card">
            <div className="cm-banner card-header fw-bold" style={{ fontSize: 16 }}>
              Chấm điểm ({questionCount} câu)
            </div>
            <div className="card-body">
              <p className="text-muted small mb-3">Danh sách toàn bộ câu hỏi của buổi học. Chấm điểm từng câu rồi gửi kết quả cho học viên.</p>
              {!writeEnabled && <WriteLockedNotice what="Chấm điểm / gửi kết quả" className="mb-3" />}

              <section className="row g-2 mb-4" aria-label="Tổng quan chấm bài">
                <div className="col-12 col-sm-4">
                  <div className="cm-grading-stat cm-grading-stat--graded">
                    <i className="isax isax-task-square" aria-hidden="true" />
                    <strong>
                      {summary.graded}/{summary.total}
                    </strong>
                    <span>Số câu đã có điểm</span>
                  </div>
                </div>
                <div className="col-12 col-sm-4">
                  <div className="cm-grading-stat cm-grading-stat--correct">
                    <i className="isax isax-tick-circle" aria-hidden="true" />
                    <strong>
                      {summary.correct}/{summary.total}
                    </strong>
                    <span>Số câu đạt điểm tối đa</span>
                  </div>
                </div>
                <div className="col-12 col-sm-4">
                  <div className={`cm-grading-stat cm-grading-stat--score ${scoreToneClass(summary.score, totalMaxScore)}`}>
                    <i className="isax isax-star-1" aria-hidden="true" />
                    <strong>
                      {formatScore(summary.score)}/{formatScore(totalMaxScore)}
                    </strong>
                    <span>Số điểm đã lưu</span>
                  </div>
                </div>
              </section>

              {questionGroups.map((group) => (
                <div key={group.key} className="mb-4" data-testid="question-group">
                  <div className="fw-bold text-primary mb-3 px-2 py-2 rounded" style={{ fontSize: 15, background: "var(--bs-primary-bg-subtle, #eef4ff)" }}>
                    {formatSectionName(group.name)}
                    <span className="text-muted fw-normal ms-2 small">({group.items.length} câu)</span>
                  </div>

                  {group.items.map((item) => {
                    const attemptId = item.module.attemptId as string;
                    const key = draftKeyOf(item.question, attemptId);
                    const sent = isQuestionReturnedToStudent(item.question, item.module, item.detail.questions);
                    return (
                      <div key={item.key} data-testid="question-item">
                        {item.isFirstInAttempt && (
                          <>
                            <div className={`small text-muted mb-2${item.globalIndex > 0 ? " mt-2 pt-2 border-top" : ""}`}>
                              <span className="fw-semibold">{item.module.label}</span>
                              {item.module.submitted && (
                                <span className={`ms-2 ${scoreToneClass(item.module.score, item.module.maxScore)}`}>
                                  ({formatScore(item.module.score)} / {formatScore(item.module.maxScore)})
                                </span>
                              )}
                            </div>
                            <PassageMedia detail={item.detail} />
                          </>
                        )}

                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="badge bg-primary-subtle text-primary">Câu {item.globalIndex + 1}</span>
                          {sent && <span className="badge bg-success-subtle text-success">Đã gửi</span>}
                        </div>

                        <QuestionGradingCard
                          question={item.question}
                          readOnly={sent}
                          disabled={!writeEnabled}
                          saving={!!saving[key]}
                          value={getDraft(item.question, attemptId)}
                          onChange={(value) => onDraftChange(key, value)}
                          onSave={(scoreValue, comment) => onSaveQuestion(item.question, scoreValue, comment, attemptId)}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="cm-sticky-footer d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <span className="text-muted small d-block">Tổng điểm buổi học</span>
                <span className={`fw-bold fs-5 ${scoreToneClass(totalScore, totalMaxScore)}`}>
                  {formatScore(totalScore)} / {formatScore(totalMaxScore)}
                </span>
              </div>
              <div className="text-end">
                <button type="button" className="btn btn-primary px-4" onClick={onSendAll} disabled={!writeEnabled || sending || nothingToSend}>
                  <i className="isax isax-send-2 me-1" />
                  {sending ? "Đang gửi..." : "Gửi kết quả cho học viên"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={incompleteWarning.length > 0}
        onCancel={onCloseWarning}
        destroyOnClose
        centered
        title={<h5 className="mb-0" id="cm-incomplete-warning-title">Cảnh báo</h5>}
        footer={
          <button type="button" className="btn cm-btn-red px-4" onClick={onCloseWarning}>
            OK
          </button>
        }
      >
        <div className="d-flex align-items-start gap-2">
          <i className="isax isax-warning-2 text-warning fs-4" aria-hidden="true" />
          <div>
            <p className="mb-2">Các bài sau còn câu chưa chấm nên chưa được gửi cho học viên:</p>
            <ul className="mb-0 ps-3">
              {incompleteWarning.map((attempt) => (
                <li key={attempt.attemptId}>
                  <strong>{attempt.label}</strong>: câu {attempt.missingQuestionNumbers.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
    </ManagementPageFrame>
  );
}
