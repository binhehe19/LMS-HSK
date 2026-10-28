"use client";

// Port của LMS_Frontend/src/features/instructor/instructor-financial-statement/instructor-financial-statement.tsx (màn "Sao kê", route Admin /admin/statements).
// View thuần: không gọi API (container: statements-page-content.tsx). Giữ DOM/class/chữ: thanh tiêu đề với ô tìm + 2 Select, 4 thẻ tổng, bảng giao dịch
// (DataTable dùng chung, Search=false). `t()` của i18next bản cũ không có bản dịch nên chữ hiển thị = khoá tiếng Việt: giữ nguyên chữ.
//
// Khác bản cũ có chủ đích: (1) phân trang THẬT phía máy chủ (bản cũ chỉ tải trang 1 và để chỗ "Pagination logic would go here"); (2) chưa cấu hình/lỗi =>
// dòng thông báo + thẻ "—" (bản cũ tự tính bù bằng cách duyệt tới 50 trang giao dịch); (3) trường tổng thiếu => "—" thay số 0 giả; (4) moment => dayjs
// cùng mẫu; (5) bảng rỗng ghi tiếng Việt. Tìm kiếm/lọc loại vẫn áp trên TRANG HIỆN TẠI như bản cũ (hợp đồng API không có tham số lọc).
import { Select, Space, Tag, Tooltip, type TableColumnsType } from "antd";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { DataTable } from "@/components/shared/data-table";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import {
  ITEM_TYPE_META,
  PAYMENT_STATUS_META,
  TRANSACTION_PAGE_SIZE,
  TRANSACTION_SORT_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  buyerDisplayName,
  buyerInitial,
  filterTransactions,
  formatCurrency,
  formatPaidAt,
  normalizeStatus,
  transactionTypes,
  type TransactionTypeFilter,
} from "@/lib/payment/payment-model";
import type { PaymentSummary, TransactionItem, TransactionReportItem, TransactionReportPage } from "@/types/payment";

interface StatementsViewProps {
  summary: FetchState<PaymentSummary>;
  report: FetchState<TransactionReportPage>;
  /** Trang tải thành công gần nhất: giữ dòng + thanh phân trang khi đang tải trang/sắp xếp khác. */
  lastReport: TransactionReportPage | null;
  /** Trang hiện tại, đếm từ 0. */
  page: number;
  sort: string;
  search: string;
  type: TransactionTypeFilter;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: TransactionTypeFilter) => void;
  onSortChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onRetrySummary: () => void;
  onRetryReport: () => void;
}

const SUMMARY_CARDS: { key: keyof PaymentSummary; label: string; textClass: string; money?: boolean }[] = [
  { key: "totalRevenue", label: "Tổng thu nhập", textClass: "text-primary", money: true },
  { key: "totalTransactions", label: "Số giao dịch", textClass: "text-success" },
  { key: "totalCoursesSold", label: "Lượt bán Khóa học", textClass: "text-warning" },
  { key: "totalMembershipsSold", label: "Lượt bán Trả phí", textClass: "text-info" },
];

/** Đang tải: 0 như bản cũ; chưa tích hợp/lỗi hoặc backend không trả trường: "—". */
function summaryValue(summary: FetchState<PaymentSummary>, key: keyof PaymentSummary, money: boolean | undefined): string {
  if (summary.kind === "loading") return money ? formatCurrency(0) : "0";
  if (summary.kind !== "ok") return "—";
  const value = summary.data[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return money ? formatCurrency(value) : String(value);
}

export function StatementsView({ summary, report, lastReport, page, sort, search, type, onSearchChange, onTypeChange, onSortChange, onPageChange, onRetrySummary, onRetryReport }: StatementsViewProps) {
  const reportLoading = report.kind === "loading";
  const reportBlocked = report.kind === "waiting" || report.kind === "error";
  const current = report.kind === "ok" ? report.data : reportLoading ? lastReport : null;
  const rows = filterTransactions(current?.content ?? [], search, type);
  const total = current?.totalElements ?? 0;

  const columns: TableColumnsType<TransactionReportItem> = [
    { title: "Mã đơn", dataIndex: "orderCode", key: "orderCode", render: (code: number) => <span className="fw-bold text-primary">#{code}</span> },
    {
      title: "Người mua",
      dataIndex: "buyer",
      key: "buyer",
      render: (buyer: TransactionReportItem["buyer"]) => (
        <div className="d-flex align-items-center">
          <div className="avatar avatar-sm rounded-circle me-2 bg-light text-dark d-flex align-items-center justify-content-center">{buyerInitial(buyer)}</div>
          <div className="fw-medium">{buyerDisplayName(buyer)}</div>
        </div>
      ),
    },
    {
      title: "Nội dung thanh toán",
      dataIndex: "courses",
      key: "courses",
      render: (items: TransactionItem[] | undefined) => {
        const list = items ?? [];
        return (
          <div className="d-flex flex-column gap-1">
            {list.slice(0, 1).map((c) => (
              <div key={c.packageId} className="d-flex align-items-center">
                <span className="text-truncate" style={{ maxWidth: "150px" }} title={c.packageName}>
                  {c.packageName}
                </span>
              </div>
            ))}
            {list.length > 1 && (
              <Tooltip title={list.map((c) => c.packageName).join(", ")}>
                <span className="badge bg-secondary-transparent text-secondary">+{list.length - 1} khóa khác</span>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: "Loại",
      dataIndex: "courses",
      key: "itemType",
      render: (items: TransactionItem[] | undefined) => (
        <Space wrap>
          {transactionTypes(items).map((t) => (
            <Tag key={t} color={ITEM_TYPE_META[t].color}>
              {ITEM_TYPE_META[t].label}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: "Ngày thanh toán", dataIndex: "paidAt", key: "paidAt", render: (date: string | undefined) => formatPaidAt(date) },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const meta = PAYMENT_STATUS_META[normalizeStatus(status)];
        return (
          <span className={`badge rounded-pill px-3 py-2 fw-semibold d-inline-flex align-items-center ${meta.className}`}>
            <i className={`fa-solid fa-circle dot-sm me-1 ${meta.dotClass}`} />
            {meta.label}
          </span>
        );
      },
    },
    { title: "Tổng tiền", dataIndex: "totalPrice", key: "totalPrice", render: (price: number) => <span className="fw-bold">{formatCurrency(price)}</span> },
  ];

  return (
    <ManagementPageFrame>
      <div className="page-title d-flex align-items-center justify-content-between">
        <h5 className="fw-bold mb-0">Sao kê</h5>
        <div className="d-flex align-items-center gap-2">
          <div className="input-icon position-relative">
            <span className="input-icon-addon">
              <i className="isax isax-search-normal-14" />
            </span>
            <input type="search" className="form-control form-control-md" style={{ minWidth: 220 }} placeholder="Tìm kiếm" aria-label="Tìm kiếm" value={search} onChange={(e) => onSearchChange(e.target.value)} />
          </div>
          <span className="text-muted fs-13">Bộ lọc:</span>
          <Select<TransactionTypeFilter> id="statement-type" aria-label="Loại giao dịch" value={type} style={{ width: 150 }} onChange={onTypeChange} options={[...TRANSACTION_TYPE_OPTIONS]} />
          <Select<string> id="statement-sort" aria-label="Sắp xếp" value={sort} style={{ width: 180 }} onChange={onSortChange} options={[...TRANSACTION_SORT_OPTIONS]} />
        </div>
      </div>

      <FetchStateNotice state={summary} waitingText="Tổng quan sao kê chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onRetrySummary} testId="statement-summary-notice" className="mb-3" />
      <div className="row g-3 mb-4">
        {SUMMARY_CARDS.map((card) => (
          <div key={card.key} className="col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body py-3">
                <div className="text-muted fs-13 mb-1">{card.label}</div>
                <div className={`h5 mb-0 fw-bold ${card.textClass}`} data-testid={`statement-${card.key}`}>
                  {summaryValue(summary, card.key, card.money)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {reportBlocked ? (
            <FetchStateNotice state={report} waitingText="Danh sách giao dịch chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetryReport} testId="statement-report-notice" className="m-3" />
          ) : (
            <DataTable<TransactionReportItem>
              columns={columns}
              dataSource={rows}
              rowKey="orderId"
              search={false}
              loading={reportLoading}
              locale={{ emptyText: reportLoading ? " " : search.trim() || type !== "ALL" ? "Không có giao dịch phù hợp trên trang này" : "Chưa có giao dịch nào" }}
              pagination={{ current: page + 1, pageSize: TRANSACTION_PAGE_SIZE, total, showSizeChanger: false, onChange: (p) => onPageChange(p - 1) }}
            />
          )}
        </div>
      </div>
    </ManagementPageFrame>
  );
}
