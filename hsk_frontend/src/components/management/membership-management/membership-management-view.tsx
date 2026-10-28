"use client";

// Port của LMS_Frontend/src/features/admin/membership-management/membership-management.tsx (màn "Quản lý Gói thành viên VIP"). View thuần: không gọi API
// (container: membership-management-page-content.tsx). Giữ DOM/class/chữ: header `.membership-header` + nút `.btn-gold`, card `.premium-card` với DataTable
// (Search=true), các cột và icon @ant-design/icons như bản cũ; CSS ở membership-management.scss (sao chép nguyên văn, nạp qua styles/page-styles.ts).
//
// Khác bản cũ có chủ đích: (1) `.membership-management` là class của `.content` (ManagementPageFrame contentClassName) thay cho div bọc ngoài — các selector
// con của SCSS vẫn khớp; (2) API lỗi/chưa cấu hình => dòng thông báo (bản cũ rơi về 2 gói MOCK "VIP Monthly/Yearly" — KHÔNG làm vậy); (3) công tắc ghi
// đóng => WriteLockedNotice + khoá Tạo/Sửa/Xoá; (4) Modal.confirm xoá => confirmAction (cùng chữ); (5) bảng rỗng ghi tiếng Việt; (6) aria-label cho nút icon.
import { DeleteOutlined, EditOutlined, PlusOutlined, CrownOutlined } from "@ant-design/icons";
import { Button, Space, Tooltip, type TableColumnsType } from "antd";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { DataTable } from "@/components/shared/data-table";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { formatPlanPrice, membershipStatusMeta, truncateDescription } from "@/lib/payment/payment-model";
import type { MembershipPlan } from "@/types/payment";

interface MembershipManagementViewProps {
  state: FetchState<MembershipPlan[]>;
  /** Dòng hiển thị (dữ liệu hiện tại, hoặc kết quả gần nhất khi đang tải lại sau thao tác ghi). */
  plans: MembershipPlan[];
  writeEnabled: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (plan: MembershipPlan) => void;
  onDelete: (plan: MembershipPlan) => void;
}

export function MembershipManagementView({ state, plans, writeEnabled, onRetry, onCreate, onEdit, onDelete }: MembershipManagementViewProps) {
  const loading = state.kind === "loading";
  const blocked = state.kind === "waiting" || state.kind === "error";

  const columns: TableColumnsType<MembershipPlan> = [
    {
      title: "Tên gói",
      dataIndex: "name",
      key: "name",
      render: (text: string, record) => (
        <div className="d-flex align-items-center">
          <div className="plan-icon-wrapper me-2">
            <i className="isax isax-crown" />
          </div>
          <div>
            <div className="fw-bold">{text}</div>
            <div className="text-muted small">{truncateDescription(record.description)}</div>
          </div>
        </div>
      ),
    },
    { title: "Giá (VNĐ)", dataIndex: "price", key: "price", render: (price: number) => <span className="fw-bold text-success">{formatPlanPrice(price)}</span>, sorter: (a, b) => a.price - b.price },
    { title: "Thời hạn", dataIndex: "durationInDays", key: "durationInDays", render: (days: number) => <span>{days} ngày</span> },
    {
      title: "Trạng thái",
      dataIndex: "active",
      key: "active",
      render: (active: boolean) => {
        const meta = membershipStatusMeta(active);
        return (
          <div className="d-flex align-items-center gap-2">
            <span className={`badge ${meta.className}`}>{meta.label}</span>
          </div>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_: unknown, record) => (
        <Space>
          <Tooltip title="Chỉnh sửa">
            <Button type="text" icon={<EditOutlined className="text-info" />} aria-label={`Chỉnh sửa ${record.name}`} disabled={!writeEnabled} onClick={() => onEdit(record)} />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button type="text" icon={<DeleteOutlined className="text-danger" />} aria-label={`Xóa ${record.name}`} disabled={!writeEnabled} onClick={() => onDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <ManagementPageFrame contentClassName="membership-management">
      <div className="membership-header mb-4">
        <div className="header-info">
          <h5 className="fw-bold mb-1">
            <CrownOutlined className="me-2 text-warning" />
            Quản lý Gói thành viên VIP
          </h5>
          <p className="text-muted small">Thiết lập các quyền lợi và giá cho thành viên cấp cao.</p>
        </div>
        <button type="button" className="btn btn-gold" disabled={!writeEnabled || blocked} onClick={onCreate}>
          <PlusOutlined className="me-2" />
          Tạo gói mới
        </button>
      </div>

      {!writeEnabled && <WriteLockedNotice what="Tạo/sửa/xoá gói thành viên" className="mb-3" />}

      <div className="card border-0 shadow-sm premium-card">
        <div className="card-body p-0">
          {blocked ? (
            <FetchStateNotice state={state} waitingText="Danh sách gói thành viên chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="membership-notice" className="m-3" />
          ) : (
            <DataTable<MembershipPlan> columns={columns} dataSource={plans} rowKey="id" search loading={loading} locale={{ emptyText: loading ? " " : "Chưa có gói thành viên nào" }} />
          )}
        </div>
      </div>
    </ManagementPageFrame>
  );
}
