"use client";

// Port của LMS_Frontend/src/features/instructor/class-management/lesson-detail-page.tsx (cùng DOM, class, style nội tuyến và chữ) — cả hai bố cục của bản cũ:
// "Chỉ xem" (bản cũ dùng khi không mock) và bố cục chỉnh sửa (bản cũ chỉ dùng với mock; lưu là "thành công giả").
// View thuần: không gọi API; dữ liệu/bản nháp/hành động nhận qua props từ instructor-lesson-detail-page-content.tsx.
//
// Khác bản cũ có chủ đích: (1) bố cục chỉnh sửa hiện khi công tắc ghi "lesson-detail" MỞ (demo hoặc NEXT_PUBLIC_WRITE_LESSON_DETAIL=enabled), ngược lại bố cục
// "Chỉ xem" + WriteLockedNotice; (2) xoá chủ đề/bài tập qua confirmAction (container); (3) khoá URL thiếu/không hợp lệ => thông báo, không gọi API; (4) dịch vụ chưa
// cấu hình / gọi lỗi => FetchStateNotice (có "Thử lại") thay vì toast + trang trống; (5) type="button" cho mọi nút.
import { useRef, type ChangeEvent } from "react";
import Link from "next/link";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { GRADING_PARAM_NOTICE_TEXT, lessonListHref, type GradingParamNotice } from "@/lib/grading/grading-params";
import { MATERIAL_TYPES, QUESTION_TYPES, TOPIC_TYPES } from "@/lib/grading/lesson-detail-model";
import type { LessonDetailResponse, LessonExercise, LessonModule, LessonQuestion } from "@/types/grading";

/** Các thao tác chỉnh sửa bản nháp (hàm thuần ở lib/grading/lesson-detail-model.ts, container bọc setState). */
export interface LessonDetailActions {
  updateModule: <K extends keyof LessonModule>(mi: number, field: K, value: LessonModule[K]) => void;
  toggleLock: (mi: number) => void;
  removeModule: (mi: number) => void;
  addModule: () => void;
  updateExercise: <K extends keyof LessonExercise>(mi: number, ei: number, field: K, value: LessonExercise[K]) => void;
  addExercise: (mi: number) => void;
  removeExercise: (mi: number, ei: number) => void;
  setExerciseAudio: (mi: number, ei: number, audioName: string | undefined) => void;
  updateQuestion: <K extends keyof LessonQuestion>(mi: number, ei: number, qi: number, field: K, value: LessonQuestion[K]) => void;
  addQuestion: (mi: number, ei: number) => void;
  removeQuestion: (mi: number, ei: number, qi: number) => void;
  updateOptionLabel: (mi: number, ei: number, qi: number, oi: number, label: string) => void;
  setCorrectOption: (mi: number, ei: number, qi: number, oi: number) => void;
  addOption: (mi: number, ei: number, qi: number) => void;
  removeOption: (mi: number, ei: number, qi: number, oi: number) => void;
}

interface InstructorLessonDetailViewProps {
  /** Trạng thái tải; bị bỏ qua khi `paramNotice` có giá trị (không có lời gọi API). */
  state: FetchState<LessonDetailResponse>;
  paramNotice: GradingParamNotice | null;
  classId: string;
  courseId: string;
  title: string;
  /** Bản đang hiển thị (dữ liệu đã tải + chỉnh sửa cục bộ); null khi chưa có dữ liệu. */
  detail: LessonDetailResponse | null;
  /** Công tắc ghi "lesson-detail" đang mở => bố cục chỉnh sửa. */
  editable: boolean;
  saving: boolean;
  openId: string | null;
  onToggleOpen: (id: string) => void;
  onSave: () => void;
  onRetry: () => void;
  actions: LessonDetailActions;
}

function Breadcrumb({ classId, courseId }: { classId: string; courseId: string }) {
  return (
    <nav className="mb-3 small">
      <Link href="/instructor/list-class" prefetch={false} className="text-primary">
        Danh sách lớp học
      </Link>
      <span className="mx-2 text-muted">›</span>
      <Link href={lessonListHref(classId, courseId)} prefetch={false} className="text-primary">
        Danh sách bài học
      </Link>
      <span className="mx-2 text-muted">›</span>
      <span className="text-muted">Chi tiết bài học</span>
    </nav>
  );
}

export function InstructorLessonDetailView({ state, paramNotice, classId, courseId, title, detail, editable, saving, openId, onToggleOpen, onSave, onRetry, actions }: InstructorLessonDetailViewProps) {
  const loading = !paramNotice && state.kind === "loading";
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioTarget = useRef<{ mi: number; ei: number } | null>(null);

  const openAudioPicker = (mi: number, ei: number) => {
    audioTarget.current = { mi, ei };
    audioInputRef.current?.click();
  };
  // Bản cũ chỉ ghi TÊN tệp đã chọn vào bản nháp (không tải lên); giữ nguyên — tải tệp lên kho lưu trữ là hợp đồng khác (storage).
  const onAudioPicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = audioTarget.current;
    if (file && target) actions.setExerciseAudio(target.mi, target.ei, file.name);
    e.target.value = "";
  };

  const notices = (
    <>
      {paramNotice && (
        <div className="alert alert-warning mb-3" role="status" data-testid="lesson-detail-notice" data-kind={paramNotice}>
          {GRADING_PARAM_NOTICE_TEXT[paramNotice]}
        </div>
      )}
      {!paramNotice && <FetchStateNotice state={state} waitingText="Chi tiết bài học chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="lesson-detail-notice" className="mb-3" />}
      {loading && (
        <div className="text-center py-4">
          <span className="spinner-border text-primary" />
        </div>
      )}
    </>
  );

  if (!editable) {
    return (
      <ManagementPageFrame>
        <Breadcrumb classId={classId} courseId={courseId} />

        <div className="card">
          <div className="card-header bg-light d-flex align-items-center justify-content-between">
            <span className="fw-bold">Chi tiết bài học</span>
            <span className="badge bg-primary-subtle text-primary">Chỉ xem</span>
          </div>
          <div className="card-body">
            <WriteLockedNotice what="Chỉnh sửa chi tiết bài học" className="mb-3" />
            <label className="form-label fw-medium">Tên bài học:</label>
            <div className="form-control bg-light mb-4">{detail?.lessonTitle || title || "-"}</div>

            {notices}

            {detail && detail.modules.length === 0 && <div className="text-center text-muted py-4">Buổi này chưa có bài tập</div>}

            {detail?.modules.map((m) => (
              <div key={m.id} className="border rounded mb-3 cm-left-accent" data-testid="lesson-module">
                <button type="button" className="cm-plain-btn btn p-0 w-100 d-flex align-items-center justify-content-between px-3 py-3 fw-medium text-start" onClick={() => onToggleOpen(m.id)}>
                  <span>
                    <i className="isax isax-element-3 text-muted me-2" />
                    {m.label || "Quiz"}
                  </span>
                  <span className="d-flex align-items-center gap-2">
                    {m.materialType && <span className="badge bg-light text-dark">{m.materialType}</span>}
                    {m.topicType && <span className="badge bg-primary-subtle text-primary">{m.topicType}</span>}
                    <i className={`isax ${openId === m.id ? "isax-arrow-up-2" : "isax-arrow-down-1"}`} />
                  </span>
                </button>

                {openId === m.id && (
                  <div className="px-3 pb-3 border-top pt-3">
                    {(m.exercises || []).length === 0 && <div className="text-center text-muted py-3">Buổi này chưa có bài tập</div>}
                    {(m.exercises || []).map((ex, ei) => (
                      <div key={`${m.id}-${ei}`} className="border rounded p-3 mb-3 bg-white">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <span className="fw-semibold">{ex.name || `Bài quiz ${ei + 1}`}</span>
                          <span className="text-muted small">{ex.questions?.length || 0} câu</span>
                        </div>
                        {(ex.questions || []).map((q) => (
                          <div key={`${m.id}-${ei}-${q.no}`} className="border rounded p-3 mb-2">
                            <div className="d-flex justify-content-between gap-3">
                              <div>
                                <span className="text-primary fw-semibold">{q.no}.</span> <span>{q.text || "-"}</span>
                              </div>
                              <span className="badge bg-light text-dark">{q.score ?? 0} điểm</span>
                            </div>
                            {q.type && (
                              <div className="mt-2">
                                <span className="badge bg-primary-subtle text-primary">{q.type}</span>
                              </div>
                            )}
                            {(q.options || []).length > 0 && (
                              <div className="mt-2">
                                {q.options?.map((option, oi) => (
                                  <div key={`${m.id}-${ei}-${q.no}-${oi}`} className={`rounded px-2 py-1 mb-1 ${option.correct ? "bg-success-subtle text-success" : "bg-light"}`}>
                                    {option.label || "-"}
                                    {option.correct && <i className="isax isax-tick-circle ms-2" />}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </ManagementPageFrame>
    );
  }

  return (
    <ManagementPageFrame>
      <Breadcrumb classId={classId} courseId={courseId} />

      <div className="card">
        <div className="card-header bg-light d-flex align-items-center justify-content-between">
          <span className="fw-bold">Chi tiết bài học</span>
          <button type="button" className="btn btn-success btn-sm" onClick={onSave} disabled={saving || !detail}>
            <i className="isax isax-save-2 me-1" />
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
        <div className="card-body">
          <label className="form-label fw-medium">Tên bài học:</label>
          <div className="form-control bg-light mb-4">{detail?.lessonTitle || title || "-"}</div>

          <h5 className="fw-bold mb-3">Các chủ đề</h5>
          {notices}

          {detail?.modules.map((m, mi) => {
            const open = openId === m.id;
            return (
              <div key={m.id} className="border rounded mb-3 cm-left-accent" data-testid="lesson-module">
                <div className="d-flex align-items-center justify-content-between px-3 py-3">
                  <button type="button" className="cm-plain-btn btn p-0 d-flex align-items-center gap-2 fw-medium text-start flex-grow-1" onClick={() => onToggleOpen(m.id)}>
                    <i className="isax isax-element-3 text-muted" />
                    {m.label || "Chủ đề"}
                  </button>
                  <span className="d-flex align-items-center gap-3 text-muted">
                    <button type="button" className="btn btn-sm p-0 border-0" title={m.locked ? "Mở khóa" : "Khóa"} aria-label={m.locked ? "Mở khóa" : "Khóa"} onClick={() => actions.toggleLock(mi)}>
                      <i className={m.locked ? "isax isax-lock-1" : "isax isax-unlock"} />
                    </button>
                    <button type="button" className="btn btn-sm p-0 border-0 text-danger" title="Xóa chủ đề" aria-label="Xóa chủ đề" onClick={() => actions.removeModule(mi)}>
                      <i className="isax isax-trash" />
                    </button>
                    <button type="button" className="btn btn-sm p-0 border-0" aria-label={open ? "Thu gọn" : "Mở rộng"} onClick={() => onToggleOpen(m.id)}>
                      <i className={`isax ${open ? "isax-arrow-up-2" : "isax-arrow-down-1"}`} />
                    </button>
                  </span>
                </div>

                {open && (
                  <div className="px-3 pb-3 border-top pt-3">
                    <div className="mb-3">
                      <label className="form-label fw-medium" htmlFor={`module-label-${m.id}`}>
                        Tên chủ đề <span className="text-danger">*</span>
                      </label>
                      <input id={`module-label-${m.id}`} className="form-control" value={m.label} onChange={(e) => actions.updateModule(mi, "label", e.target.value)} />
                    </div>
                    <div className="row">
                      <div className="col-md-4 mb-3">
                        <label className="form-label fw-medium" htmlFor={`module-topic-${m.id}`}>
                          Dạng chủ đề
                        </label>
                        <select id={`module-topic-${m.id}`} className="form-select" value={m.topicType || ""} onChange={(e) => actions.updateModule(mi, "topicType", e.target.value)}>
                          <option value="">Chọn dạng chủ đề</option>
                          {TOPIC_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label fw-medium" htmlFor={`module-material-${m.id}`}>
                          Loại học liệu
                        </label>
                        <select id={`module-material-${m.id}`} className="form-select" value={m.materialType || ""} onChange={(e) => actions.updateModule(mi, "materialType", e.target.value)}>
                          <option value="">Chọn loại học liệu</option>
                          {MATERIAL_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(m.exercises || []).map((ex, ei) => (
                      <div key={ei} className="border rounded p-3 mb-3" data-testid="lesson-exercise">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="fw-medium">Danh sách bài tập</span>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => actions.removeExercise(mi, ei)}>
                            <i className="isax isax-trash me-1" />
                            Xóa bài tập
                          </button>
                        </div>
                        <div className="mb-3">
                          <label className="form-label fw-medium" htmlFor={`exercise-name-${m.id}-${ei}`}>
                            Tên bài tập <span className="text-danger">*</span>
                          </label>
                          <input id={`exercise-name-${m.id}-${ei}`} className="form-control" placeholder="请选择出正确答案" value={ex.name || ""} onChange={(e) => actions.updateExercise(mi, ei, "name", e.target.value)} />
                        </div>

                        <div className="mb-3">
                          <label className="form-label fw-medium">File audio</label>
                          <div className="d-flex align-items-center gap-2">
                            <div className="form-control bg-light text-center text-muted">{ex.audioName || "Chưa có audio"}</div>
                            <button type="button" className="btn btn-light border" title="Đổi audio" aria-label="Đổi audio" onClick={() => openAudioPicker(mi, ei)}>
                              <i className="isax isax-edit-2" />
                            </button>
                            {ex.audioName && (
                              <button type="button" className="btn btn-light border" title="Xóa audio" aria-label="Xóa audio" onClick={() => actions.setExerciseAudio(mi, ei, undefined)}>
                                <i className="isax isax-trash text-danger" />
                              </button>
                            )}
                          </div>
                          <small className="text-warning">Nhấn nút bút chì để thay đổi audio</small>
                        </div>

                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="fw-medium">Danh sách câu hỏi</span>
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => actions.addQuestion(mi, ei)}>
                            <i className="isax isax-add me-1" />
                            Thêm câu hỏi
                          </button>
                        </div>

                        {(ex.questions || []).map((q, qi) => (
                          <div key={qi} className="border rounded p-3 mb-3 bg-white" data-testid="lesson-question">
                            <div className="d-flex justify-content-between align-items-start gap-2">
                              <div className="flex-grow-1">
                                <span className="text-primary fw-semibold">{q.no}.</span>
                                <textarea className="form-control mt-1" rows={2} placeholder="Nội dung câu hỏi" aria-label={`Nội dung câu ${q.no}`} value={q.text || ""} onChange={(e) => actions.updateQuestion(mi, ei, qi, "text", e.target.value)} />
                              </div>
                              <div className="d-flex flex-column gap-2" style={{ width: 160 }}>
                                <select className="form-select form-select-sm" aria-label={`Loại câu ${q.no}`} value={q.type} onChange={(e) => actions.updateQuestion(mi, ei, qi, "type", e.target.value)}>
                                  {QUESTION_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => actions.removeQuestion(mi, ei, qi)}>
                                  <i className="isax isax-trash me-1" />
                                  Xóa câu
                                </button>
                              </div>
                            </div>

                            <div className="mt-3">
                              {(q.options || []).map((opt, oi) => (
                                <div key={oi} className="d-flex align-items-center gap-2 mb-2">
                                  <input type="radio" className="form-check-input mt-0" name={`correct-${m.id}-${ei}-${qi}`} checked={!!opt.correct} onChange={() => actions.setCorrectOption(mi, ei, qi, oi)} title="Đánh dấu đáp án đúng" aria-label={`Đáp án đúng ${oi + 1}`} />
                                  <input
                                    className={`form-control ${opt.correct ? "border-success" : ""}`}
                                    style={opt.correct ? { background: "#e9f9ee" } : undefined}
                                    value={opt.label}
                                    placeholder={`Đáp án ${oi + 1}`}
                                    aria-label={`Đáp án ${oi + 1}`}
                                    onChange={(e) => actions.updateOptionLabel(mi, ei, qi, oi, e.target.value)}
                                  />
                                  <button type="button" className="btn btn-light border" title="Xóa đáp án" aria-label="Xóa đáp án" onClick={() => actions.removeOption(mi, ei, qi, oi)}>
                                    <i className="isax isax-close-circle text-danger" />
                                  </button>
                                </div>
                              ))}
                              <button type="button" className="btn btn-link text-danger w-100 text-decoration-none" onClick={() => actions.addOption(mi, ei, qi)}>
                                + Thêm đáp án
                              </button>
                              <div className="d-flex align-items-center gap-2 mt-2">
                                <span className="text-primary">
                                  <i className="isax isax-tick-square me-1" />
                                  Đáp án
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.25"
                                  className="form-control form-control-sm"
                                  style={{ width: 90 }}
                                  aria-label={`Điểm câu ${q.no}`}
                                  value={q.score ?? ""}
                                  onChange={(e) => actions.updateQuestion(mi, ei, qi, "score", e.target.value === "" ? undefined : Number(e.target.value))}
                                />
                                <span className="text-muted small">điểm</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}

                    <button type="button" className="cm-btn-red btn mt-2" onClick={() => actions.addExercise(mi)}>
                      <i className="isax isax-add me-1" /> Thêm bài tập bổ sung
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {!loading && detail && (
            <button type="button" className="btn btn-outline-primary w-100" onClick={actions.addModule}>
              <i className="isax isax-add-square me-1" /> Thêm chủ đề
            </button>
          )}
        </div>
      </div>

      <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={onAudioPicked} data-testid="audio-picker" />
    </ManagementPageFrame>
  );
}
