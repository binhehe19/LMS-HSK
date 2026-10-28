"use client";

// Port của LMS_Frontend/src/features/instructor/class-management/learning-analysis-list-page.tsx (cùng DOM, class, style nội tuyến và chữ).
// View thuần: không gọi API, nhận dữ liệu qua props (container: instructor-learning-analysis-page-content.tsx). Chỉ ĐỌC — nút mỗi dòng chỉ điều hướng sang /detail.
//
// Khác bản cũ có chủ đích: (1) classId/scheduleId thiếu hoặc không hợp lệ => dòng thông báo, KHÔNG gọi API (bản cũ gọi với scheduleId rỗng bị bỏ qua im lặng);
// (2) dịch vụ chưa cấu hình / gọi lỗi => FetchStateNotice (kèm "Thử lại" khi lỗi) thay vì "Chưa có học viên"; (3) `next/link` cho breadcrumb (prefetch tắt);
// (4) type="button" + aria-label cho nút biểu tượng; (5) ảnh đại diện qua AssetImage (cùng <img>, không qua next/image).
import Link from "next/link";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { AssetImage } from "@/components/shared/asset-image";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { initials } from "@/lib/class-list/class-list-model";
import { studentDisplayName } from "@/lib/learning-analysis/learning-analysis-model";
import type { GradingStudentResponse } from "@/types/grading";

interface InstructorLearningAnalysisViewProps {
  /** Trạng thái tải; bị bỏ qua khi `paramNotice` có giá trị (không có lời gọi API). */
  state: FetchState<GradingStudentResponse[]>;
  paramNotice: string | null;
  /** Tiêu đề buổi từ URL (huy hiệu đỏ), hiện cả khi tham số khác lỗi như bản cũ. */
  title: string;
  /** Đích của breadcrumb "Danh sách bài học" (về /instructor/list-class khi thiếu mã lớp). */
  lessonListHref: string;
  keyword: string;
  filtered: GradingStudentResponse[];
  onKeywordChange: (keyword: string) => void;
  onOpenDetail: (s: GradingStudentResponse) => void;
  onRetry: () => void;
}

export function InstructorLearningAnalysisView({ state, paramNotice, title, lessonListHref, keyword, filtered, onKeywordChange, onOpenDetail, onRetry }: InstructorLearningAnalysisViewProps) {
  const loading = !paramNotice && state.kind === "loading";
  const rows = paramNotice || state.kind !== "ok" ? [] : filtered;

  return (
    <ManagementPageFrame>
      <nav className="mb-3 small">
        <Link href="/instructor/list-class" prefetch={false} className="text-primary">
          Danh sách lớp học
        </Link>
        <span className="mx-2 text-muted">›</span>
        <Link href={lessonListHref} prefetch={false} className="text-primary">
          Danh sách bài học
        </Link>
        <span className="mx-2 text-muted">›</span>
        <span className="text-muted">Phân tích học tập</span>
      </nav>

      <div className="card">
        <div className="card-header d-flex align-items-center gap-2 bg-light">
          <span className="fw-bold">Phân tích học tập</span>
          {title && <span className="badge bg-danger">{title}</span>}
        </div>
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-5">
              <label className="form-label text-primary fw-medium" htmlFor="la-student-search">
                Tìm kiếm
              </label>
              <input id="la-student-search" className="form-control" placeholder="Tìm theo tên, email, mã học viên" value={keyword} onChange={(e) => onKeywordChange(e.target.value)} />
            </div>
          </div>

          <div className="d-none d-lg-flex text-muted small fw-semibold border-bottom pb-2 mb-2">
            <div style={{ width: 50 }}>STT</div>
            <div style={{ width: 260 }}>Học viên</div>
            <div style={{ flex: 1 }}>Mã học viên</div>
            <div style={{ width: 130 }} className="text-center">
              Xem chi tiết
            </div>
          </div>

          {rows.map((s, i) => (
            <div key={s.userId} className="d-flex align-items-center py-3 border-bottom flex-wrap flex-lg-nowrap gap-2" data-testid="student-row">
              <div style={{ width: 50 }}>{i + 1}</div>
              <div style={{ width: 260 }} className="d-flex align-items-center gap-2">
                {s.avatarUrl ? (
                  <AssetImage src={s.avatarUrl} alt="" className="rounded-circle flex-shrink-0" style={{ width: 38, height: 38, objectFit: "cover" }} />
                ) : (
                  <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary fw-bold flex-shrink-0" style={{ width: 38, height: 38, fontSize: 12 }} aria-hidden="true">
                    {initials(s.fullName || s.name)}
                  </span>
                )}
                <div>
                  <div className="fw-medium">{studentDisplayName(s)}</div>
                  {s.email && <div className="text-muted small">{s.email}</div>}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>{s.studentCode || "-"}</div>
              <div style={{ width: 130 }} className="text-center">
                <button type="button" className="cm-icon-btn btn btn-icon border" title="Xem chi tiết" aria-label={`Xem chi tiết ${studentDisplayName(s)}`} onClick={() => onOpenDetail(s)}>
                  <i className="isax isax-arrow-right-3" />
                </button>
              </div>
            </div>
          ))}

          {paramNotice && (
            <div className="alert alert-warning mb-0" role="status" data-testid="la-param-notice">
              {paramNotice}
            </div>
          )}
          {!paramNotice && <FetchStateNotice state={state} waitingText="Danh sách học viên chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="la-students-notice" />}
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
