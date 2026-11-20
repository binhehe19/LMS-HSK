"use client";

// Port của LMS_Frontend/src/features/instructor/class-management/lesson-list-page.tsx (cùng DOM, class, style nội tuyến và chữ).
// View thuần: không gọi API, nhận dữ liệu qua props (container: instructor-lesson-list-page-content.tsx). Chỉ ĐỌC — bản cũ không có thao tác ghi;
// ba nút ở mỗi dòng chỉ ĐIỀU HƯỚNG sang các màn kế tiếp (chưa chuyển => trang "đang chuyển đổi").
//
// Khác bản cũ có chủ đích: (1) classId thiếu/không hợp lệ => dòng thông báo (không gọi API) thay vì "Chưa có bài học"; (2) dịch vụ chưa cấu hình / gọi lỗi =>
// dòng thông báo (kèm "Thử lại" khi lỗi, 403 khi lớp không thuộc giảng viên) thay vì "Chưa có bài học"; (3) trang trong URL được chuẩn hoá và kẹp theo tổng số trang;
// (4) `next/link` cho đường dẫn "Danh sách lớp học" (prefetch tắt); (5) type="button" + aria-label cho ba nút biểu tượng.
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { Pagination } from "antd";
import Link from "next/link";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { LESSON_LIST_PAGE_SIZE, lessonTitleColor, lessonTitleText } from "@/lib/lesson-list/lesson-list-model";
import type { GradingScheduleResponse } from "@/types/grading";

export type LessonListNotice = { kind: "missing-class" } | { kind: "invalid-class" };

interface InstructorLessonListViewProps {
  /** Trạng thái tải; bị bỏ qua khi `paramNotice` có giá trị (không có lời gọi API). */
  state: FetchState<GradingScheduleResponse[]>;
  paramNotice: LessonListNotice | null;
  keyword: string;
  /** Buổi học đã tìm + sắp xếp (toàn bộ, chưa cắt trang). */
  filtered: GradingScheduleResponse[];
  page: number;
  onKeywordChange: (keyword: string) => void;
  onPageChange: (page: number) => void;
  onOpenDetail: (l: GradingScheduleResponse) => void;
  onOpenSubmissions: (l: GradingScheduleResponse) => void;
  onOpenLearningAnalysis: (l: GradingScheduleResponse) => void;
  onRetry: () => void;
}

const PARAM_NOTICE_TEXT: Record<LessonListNotice["kind"], string> = {
  "missing-class": "Thiếu mã lớp (classId) trong đường dẫn. Hãy quay lại \"Danh sách lớp học\" và chọn một lớp.",
  "invalid-class": "Mã lớp (classId) trong đường dẫn không hợp lệ. Hãy quay lại \"Danh sách lớp học\" và chọn một lớp.",
};

export function InstructorLessonListView({
  state,
  paramNotice,
  keyword,
  filtered,
  page,
  onKeywordChange,
  onPageChange,
  onOpenDetail,
  onOpenSubmissions,
  onOpenLearningAnalysis,
  onRetry,
}: InstructorLessonListViewProps) {
  const loading = !paramNotice && state.kind === "loading";
  const paged = filtered.slice((page - 1) * LESSON_LIST_PAGE_SIZE, page * LESSON_LIST_PAGE_SIZE);
  const fetchNotice = !paramNotice && (state.kind === "waiting" || state.kind === "error") ? state : null;

  return (
    <ManagementPageFrame>
      <nav className="mb-3 small">
        <Link href="/instructor/list-class" prefetch={false} className="text-primary">
          Danh sách lớp học
        </Link>
        <span className="mx-2 text-muted">›</span>
        <span className="text-muted">Danh sách bài học</span>
      </nav>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row">
            <div className="col-md-5">
              <label className="form-label text-primary fw-medium" htmlFor="lesson-search">
                Tìm kiếm
              </label>
              <input id="lesson-search" className="form-control" placeholder="Tên bài học" value={keyword} onChange={(e) => onKeywordChange(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-light fw-bold">Danh sách bài học</div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="cm-table table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 80 }}>STT</th>
                  <th>Tên bài học</th>
                  <th className="text-center" style={{ width: 180 }}>
                    Chi tiết bài học
                  </th>
                  <th className="text-center" style={{ width: 180 }}>
                    Danh sách nộp bài
                  </th>
                  <th className="text-center" style={{ width: 180 }}>
                    Phân tích học tập
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((l, i) => {
                  const titleText = lessonTitleText(l);
                  return (
                    <tr key={l.sessionId} data-testid="lesson-row">
                      <td>{(page - 1) * LESSON_LIST_PAGE_SIZE + i + 1}</td>
                      <td>
                        <div style={{ color: lessonTitleColor(l), fontWeight: "bold" }}>
                          {l.topic ? (
                            <span>
                              {titleText}
                              {": "}
                              <wbr />
                              {l.topic}
                            </span>
                          ) : (
                            <span>{titleText}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <button type="button" className="cm-icon-btn btn btn-icon border position-relative" title="Chi tiết bài học" aria-label="Chi tiết bài học" onClick={() => onOpenDetail(l)}>
                          <i className="isax isax-document-text" />
                        </button>
                      </td>
                      <td className="text-center">
                        <button type="button" className="cm-icon-btn btn btn-icon border position-relative" title="Danh sách nộp bài" aria-label="Danh sách nộp bài" onClick={() => onOpenSubmissions(l)}>
                          <i className="isax isax-edit-2" />
                          {l.hasPendingGrading && <span className="cm-dot-badge position-absolute top-0 start-100 translate-middle">*</span>}
                        </button>
                      </td>
                      <td className="text-center">
                        <button type="button" className="cm-icon-btn btn btn-icon border" title="Phân tích học tập" aria-label="Phân tích học tập" onClick={() => onOpenLearningAnalysis(l)}>
                          <i className="isax isax-chart-2" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paramNotice && (
                  <tr>
                    <td colSpan={5} className="p-3">
                      <div className="alert alert-warning mb-0" role="status" data-testid="lesson-list-notice" data-kind={paramNotice.kind}>
                        {PARAM_NOTICE_TEXT[paramNotice.kind]}
                      </div>
                    </td>
                  </tr>
                )}
                {fetchNotice && (
                  <tr>
                    <td colSpan={5} className="p-3">
                      <FetchStateNotice state={fetchNotice} waitingText="Danh sách bài học chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="lesson-list-notice" />
                    </td>
                  </tr>
                )}
                {!paramNotice && state.kind === "ok" && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      Chưa có bài học
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="text-center py-4">
              <span className="spinner-border text-primary" />
            </div>
          )}
          <div className="cm-sticky-footer d-flex align-items-center justify-content-between">
            <span className="text-muted small">Tổng số {filtered.length}</span>
            <Pagination current={page} pageSize={LESSON_LIST_PAGE_SIZE} total={filtered.length} showSizeChanger={false} onChange={onPageChange} />
          </div>
        </div>
      </div>
    </ManagementPageFrame>
  );
}
