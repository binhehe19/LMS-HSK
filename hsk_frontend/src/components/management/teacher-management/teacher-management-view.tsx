"use client";

// Giao diện thuần của màn /admin/teacher-management (chế độ Admin của LMS_Frontend/src/features/admin/teacher-management/teacher-management-page.tsx):
// hero + 3 thẻ thống kê + thanh công cụ + bảng, cùng DOM/class `tm-*` để teacher-management-page.scss (nạp qua styles/page-styles.ts) áp dụng.
// Không gọi API: dữ liệu và thao tác qua props (teacher-management-page-content.tsx + use-teacher-management.ts).
//
// Khác bản cũ có chủ đích: (1) lỗi tải / dịch vụ chưa cấu hình hiện FetchStateNotice (bản cũ: toast rồi bảng rỗng); (2) nút ghi bị khoá +
// WriteLockedNotice khi công tắc ghi đóng; (3) bảng dùng DataTable dùng chung (antd Table, cùng class CSS cũ) với dòng "Chưa có giảng viên nào"
// khi rỗng (bản cũ để "No data" mặc định của antd); (4) nhánh pathname /teacher-manager của bản cũ không chuyển (route đó UNKNOWN).
import { Tag, Tooltip } from "antd";
import type { TableProps } from "antd";
import { useMemo, useRef, useState } from "react";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { DataTable } from "@/components/shared/data-table";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { clampTablePage, countTeachersByStatus, isBlocked, teacherInitial } from "@/lib/teacher-management/teacher-list";
import type { TeacherUser } from "@/types/teacher-management";

const TEACHER_LIST_WAITING_TEXT = "Danh sách giảng viên chưa được kết nối API (WAITING FOR BACKEND).";

export interface TeacherManagementViewProps {
  state: FetchState<TeacherUser[]>;
  /** Dữ liệu đang hiển thị (kết quả mới nhất hoặc kết quả trước đó khi đang tải lại). */
  teachers: TeacherUser[];
  refreshing: boolean;
  writeEnabled: boolean;
  busy: boolean;
  importing: boolean;
  importInProgress: boolean;
  syncing: boolean;
  onRetry: () => void;
  onOpenSync: () => void;
  onDownloadTemplate: () => void;
  onImportFile: (file: File) => void;
  onOpenCreate: () => void;
  onOpenNewAccounts: () => void;
  onResendEmail: (teacher: TeacherUser) => void;
  onEdit: (teacher: TeacherUser) => void;
  onBlock: (teacher: TeacherUser) => void;
  onUnblock: (teacher: TeacherUser) => void;
}

const DEFAULT_PAGE_SIZE = 10;

export function TeacherManagementView(props: TeacherManagementViewProps) {
  const { state, teachers, refreshing, writeEnabled, busy, importing, importInProgress, syncing } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const hasData = state.kind === "ok" || refreshing;
  const stats = useMemo(() => countTeachersByStatus(teachers), [teachers]);
  const statValue = (value: number) => (hasData || state.kind === "loading" ? value : "—");
  const importBusy = importing || importInProgress;
  const canWrite = writeEnabled && !busy;

  const columns: TableProps<TeacherUser>["columns"] = [
    {
      title: "Giảng viên",
      key: "teacher",
      render: (_: unknown, teacher: TeacherUser) => (
        <div className="tm-teacher-cell">
          <div className="tm-avatar">{teacherInitial(teacher)}</div>
          <div>
            <p className="tm-name">{teacher.fullName || "Chưa cập nhật"}</p>
            <p className="tm-email">{teacher.email}</p>
          </div>
        </div>
      ),
    },
    {
      title: "Vai trò",
      key: "roles",
      render: () => (
        <div className="tm-role-list">
          <Tag className="tm-role-tag">GIẢNG VIÊN</Tag>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (_: unknown, teacher: TeacherUser) => (isBlocked(teacher) ? <Tag color="red">Đã khóa</Tag> : <Tag color="green">Hoạt động</Tag>),
    },
    {
      title: "Cấp mật khẩu",
      key: "passwordReset",
      render: (_: unknown, teacher: TeacherUser) => (
        <button type="button" className="tm-password-reset-btn" onClick={() => props.onResendEmail(teacher)} disabled={!canWrite} aria-label={`Cấp lại mật khẩu cho ${teacher.fullName || teacher.email}`}>
          <i className="isax isax-key me-1" />
          Cấp lại mật khẩu
        </button>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_: unknown, teacher: TeacherUser) => (
        <div className="tm-action-group">
          <Tooltip title="Chỉnh sửa thông tin">
            <button type="button" className="tm-action-btn edit" onClick={() => props.onEdit(teacher)} disabled={!canWrite} aria-label={`Chỉnh sửa ${teacher.fullName || teacher.email}`}>
              <i className="isax isax-edit" />
            </button>
          </Tooltip>
          {!isBlocked(teacher) ? (
            <Tooltip title="Khóa quyền truy cập">
              <button type="button" className="tm-action-btn danger" onClick={() => props.onBlock(teacher)} disabled={!canWrite} aria-label={`Khóa ${teacher.fullName || teacher.email}`}>
                <i className="isax isax-lock" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip title="Mở khóa tài khoản">
              <button type="button" className="tm-action-btn success" onClick={() => props.onUnblock(teacher)} disabled={!canWrite} aria-label={`Mở khóa ${teacher.fullName || teacher.email}`}>
                <i className="isax isax-unlock" />
              </button>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  const currentPage = clampTablePage(page, teachers.length, pageSize);

  return (
    <div className="teacher-management-page">
      <ManagementPageFrame>
        <div className="tm-hero">
          <div className="tm-hero-content">
            <span className="tm-badge">Quản lý giảng viên</span>
            <h2>Quản lý giảng viên</h2>
            <p>Theo dõi danh sách giảng viên và cập nhật thông tin trực tiếp trên một màn hình tập trung, rõ ràng.</p>
          </div>
          <button type="button" className="btn tm-sync-btn" onClick={props.onOpenSync} disabled={syncing || !writeEnabled}>
            <i className="isax isax-refresh-circle me-2" />
            {syncing ? "Đang đồng bộ..." : "Đồng bộ CMS"}
          </button>
        </div>

        <div className="tm-stats-grid">
          <div className="tm-stat-card total">
            <p>Tổng giảng viên</p>
            <h3>{statValue(stats.total)}</h3>
          </div>
          <div className="tm-stat-card active">
            <p>Đang hoạt động</p>
            <h3>{statValue(stats.active)}</h3>
          </div>
          <div className="tm-stat-card blocked">
            <p>Đã khóa</p>
            <h3>{statValue(stats.blocked)}</h3>
          </div>
        </div>

        <div className="card tm-table-card">
          <div className="card-body">
            {!writeEnabled && <WriteLockedNotice what="Thao tác với giảng viên (tạo, sửa, khoá/mở khoá, đồng bộ CMS, import, gửi lại email)" className="mb-3" />}

            <div className="tm-table-toolbar">
              <div>
                <input
                  type="file"
                  accept=".xlsx, .xls, .xlsm, .csv"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  data-testid="teacher-import-input"
                  aria-label="Chọn file import giảng viên"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) props.onImportFile(file);
                    event.target.value = ""; // chọn lại cùng file vẫn bắn onChange, như bản cũ reset input sau khi import
                  }}
                />
                <button type="button" className="btn tm-btn-outline me-2" onClick={props.onDownloadTemplate}>
                  <i className="isax isax-document-download me-2" />
                  Tải file mẫu
                </button>
                <button type="button" className="btn tm-btn-outline me-2" onClick={() => fileInputRef.current?.click()} disabled={importBusy || !canWrite}>
                  <i className={`isax ${importBusy ? "isax-refresh-circle" : "isax-document-upload"} me-2`} />
                  {importBusy ? "Đang nhập..." : "Import Excel"}
                </button>
                <button type="button" className="btn tm-create-btn me-2" onClick={props.onOpenCreate} disabled={!canWrite}>
                  <i className="isax isax-add me-2" />
                  Tạo giảng viên
                </button>
                <button type="button" className="btn tm-btn-outline" onClick={props.onOpenNewAccounts}>
                  <i className="isax isax-profile-add me-2" />
                  Tài khoản mới
                </button>
              </div>
            </div>

            {state.kind === "loading" && !refreshing ? (
              <div className="text-center py-5" data-testid="teacher-list-loading">
                <div className="spinner-border text-primary" role="status" />
              </div>
            ) : state.kind === "waiting" || state.kind === "error" ? (
              <FetchStateNotice state={state} waitingText={TEACHER_LIST_WAITING_TEXT} onRetry={props.onRetry} testId="teacher-list-notice" />
            ) : (
              <DataTable<TeacherUser>
                columns={columns}
                dataSource={teachers}
                rowKey="id"
                search={false}
                loading={refreshing}
                locale={{ emptyText: "Chưa có giảng viên nào" }}
                pagination={{
                  current: currentPage,
                  pageSize,
                  onChange: (nextPage, nextSize) => {
                    setPage(nextPage);
                    setPageSize(nextSize);
                  },
                }}
              />
            )}
          </div>
        </div>
      </ManagementPageFrame>
    </div>
  );
}
