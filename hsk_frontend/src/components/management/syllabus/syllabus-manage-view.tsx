"use client";

// Port RÚT GỌN của LMS_Frontend/src/features/learning-path/learning-path/manage/syllabus-management-page.tsx + phần hiển thị (chế độ asPage) của
// components/syllabus-management-modal.tsx (cùng DOM/class: .manage-lp-container, .card.border-0.shadow-sm, .syllabus-management-container, .toolbar,
// .content-wrapper, .syllabus-tabs, .info-grid, .syllabus-section-table, .module-summary-*; SCSS ở syllabus-management.scss nạp qua styles/page-styles.ts).
// View thuần: không gọi API; dữ liệu/thao tác qua props từ syllabus-manage-page-content.tsx.
//
// Khác bản cũ có chủ đích: (1) chọn giáo trình bằng BẢNG danh sách (DataTable, tìm kiếm client) thay dropdown trong toolbar; giáo trình/tab đang xem nằm
// trong URL (?view=&tab=); (2) nhãn tab tiếng Việt (bản cũ "Syllabus Info / CLO / Schedule / Materials / Grading / Luyện đề"), thêm tab "Mẫu bài kiểm tra"
// và "Phiên bản" (DTO backend chung có), bỏ tab "Luyện đề" (đề luyện không chuyển — D-UI-3); (3) dịch vụ chưa cấu hình / lỗi => FetchStateNotice (bản cũ:
// toast rồi "Chưa có dữ liệu syllabus"); (4) không có quyền (ticket OTHER) => Alert "Chế độ Xem duy nhất" như bản cũ, và module vẫn XEM được (bản cũ ẩn
// "Không có quyền truy cập"); công tắc ghi đóng => WriteLockedNotice; (5) react-bootstrap Button/Form/Table/Nav => phần tử Bootstrap thuần.
import { Alert } from "antd";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { SyllabusDetailPanel } from "@/components/management/syllabus/syllabus-detail-panel";
import { SyllabusListTable } from "@/components/management/syllabus/syllabus-list-table";
import type { ScheduleResourcesMap } from "@/components/management/syllabus/use-schedule-resources";
import { PageHeader } from "@/components/shared/page-header";
import type { ScheduleResourceType } from "@/lib/syllabus/schedule-resource-types";
import type { SyllabusTabKey } from "@/lib/syllabus/syllabus-params";
import type { SyllabusDetailResponse, SyllabusScheduleItem, SyllabusSummaryResponse, SyllabusVersionResponse } from "@/types/lms";

export type SyllabusManageMode = "list" | "detail" | "invalid-id";

export interface SyllabusManageViewProps {
  mode: SyllabusManageMode;
  /** Module ôn luyện theo buổi dùng nguyên `/content-packages*` (ADMIN-only ở backend) — chỉ Admin thao tác được, không theo ticket. */
  isAdmin: boolean;
  /** Công tắc ghi "content" đang mở (mặc định mở; đóng khi NEXT_PUBLIC_WRITE_CONTENT=disabled). */
  writeEnabled: boolean;
  // danh sách
  listState: FetchState<SyllabusSummaryResponse[]>;
  keyword: string;
  filtered: SyllabusSummaryResponse[];
  onKeywordChange: (keyword: string) => void;
  onOpen: (syllabusId: string) => void;
  onRetryList: () => void;
  // chi tiết
  detailState: FetchState<SyllabusDetailResponse>;
  versionsState: FetchState<SyllabusVersionResponse[]>;
  tab: SyllabusTabKey;
  onTabChange: (tab: SyllabusTabKey) => void;
  onBack: () => void;
  onReloadDetail: () => void;
  // module ôn luyện theo buổi
  resourcesState: FetchState<ScheduleResourcesMap>;
  busyScheduleId: string | null;
  onRetryResources: () => void;
  onAddModule: (item: SyllabusScheduleItem, sessionNo: number) => void;
  onMoveResource: (scheduleId: string, type: ScheduleResourceType, resourceId: string, direction: -1 | 1) => void;
  onDeleteResource: (scheduleId: string, type: ScheduleResourceType, resourceId: string) => void;
}

export function SyllabusManageView(p: SyllabusManageViewProps) {
  const viewOnly = !p.isAdmin;

  return (
    <ManagementPageFrame>
      <div className="manage-lp-container syllabus-management-page">
        <div className="card border-0 shadow-sm mb-4">
          {viewOnly && (
            <div className="px-3 pt-3">
              <Alert
                message="Chế độ Xem duy nhất"
                description="Module ôn luyện theo buổi chỉ Admin thao tác được (Thêm, Sắp xếp, Xóa). Các phần khác của Syllabus bạn vẫn xem được bình thường."
                type="warning"
                showIcon
                className="rounded-3 shadow-sm border-warning mb-0"
                data-testid="view-only-alert"
              />
            </div>
          )}
          <PageHeader icon="isax-book-saved" title="Quản lý Syllabus" subtitle="Quản lý dữ liệu syllabus hiện có" />
        </div>

        <div className="card border-0 shadow-sm overflow-hidden">
          <div className="syllabus-management-container">
            {p.mode === "list" && <SyllabusListTable state={p.listState} keyword={p.keyword} filtered={p.filtered} onKeywordChange={p.onKeywordChange} onOpen={p.onOpen} onRetry={p.onRetryList} />}

            {p.mode === "invalid-id" && (
              <div className="p-3">
                <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0" role="status" data-testid="syllabus-notice" data-kind="invalid-id">
                  <span>Mã giáo trình (view) trong đường dẫn không hợp lệ.</span>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onBack}>
                    Về danh sách giáo trình
                  </button>
                </div>
              </div>
            )}

            {p.mode === "detail" && (
              <SyllabusDetailPanel
                detailState={p.detailState}
                versionsState={p.versionsState}
                tab={p.tab}
                onTabChange={p.onTabChange}
                onBack={p.onBack}
                onReload={p.onReloadDetail}
                canManage={p.isAdmin}
                writeEnabled={p.writeEnabled}
                resourcesState={p.resourcesState}
                busyScheduleId={p.busyScheduleId}
                onRetryResources={p.onRetryResources}
                onAddModule={p.onAddModule}
                onMoveResource={p.onMoveResource}
                onDeleteResource={p.onDeleteResource}
              />
            )}
          </div>
        </div>
      </div>
    </ManagementPageFrame>
  );
}
