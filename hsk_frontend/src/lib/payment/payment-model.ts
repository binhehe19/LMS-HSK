// Hàm thuần của hai màn thanh toán: sao kê (instructor-financial-statement.tsx) và gói thành viên (membership-management.tsx của HSK cũ).
import dayjs from "dayjs";
import type { MembershipPlan, MembershipPlanRequest, TransactionBuyer, TransactionItem, TransactionItemType, TransactionReportItem } from "@/types/payment";

/** core/utils/currency-formatter.ts của HSK cũ: Intl vi-VN, VND => "1.500.000 ₫". */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

export type PaymentStatus = "PENDING" | "PAYING" | "COMPLETED" | "CANCELLED";

/** PAID được coi là COMPLETED; giá trị lạ/thiếu => PENDING (như bản cũ). */
export function normalizeStatus(status: string | undefined): PaymentStatus {
  const s = (status ?? "").toUpperCase();
  if (s === "PAYING") return "PAYING";
  if (s === "COMPLETED" || s === "PAID") return "COMPLETED";
  if (s === "CANCELLED") return "CANCELLED";
  return "PENDING";
}

export const PAYMENT_STATUS_META: Readonly<Record<PaymentStatus, { label: string; className: string; dotClass: string }>> = {
  PENDING: { label: "Chờ xử lý", className: "bg-warning-transparent text-warning", dotClass: "text-warning" },
  PAYING: { label: "Đang thanh toán", className: "bg-info-transparent text-info", dotClass: "text-info" },
  COMPLETED: { label: "Hoàn thành", className: "bg-success-transparent text-success", dotClass: "text-success" },
  CANCELLED: { label: "Đã hủy", className: "bg-danger-transparent text-danger", dotClass: "text-danger" },
};

export function normalizeItemType(item: Pick<TransactionItem, "itemType"> | undefined): TransactionItemType {
  return (item?.itemType ?? "").toUpperCase() === "MEMBERSHIP" ? "MEMBERSHIP" : "COURSE";
}

/** Nhãn/màu antd Tag như bản cũ ("Trả phí" = gói thành viên). */
export const ITEM_TYPE_META: Readonly<Record<TransactionItemType, { label: string; color: "gold" | "blue" }>> = {
  MEMBERSHIP: { label: "Trả phí", color: "gold" },
  COURSE: { label: "Khóa học", color: "blue" },
};

/** Các loại mục (không trùng) trong một đơn, theo thứ tự xuất hiện. */
export function transactionTypes(items: readonly TransactionItem[] | undefined): TransactionItemType[] {
  return [...new Set((items ?? []).map((item) => normalizeItemType(item)))];
}

export type TransactionTypeFilter = "ALL" | TransactionItemType;

export const TRANSACTION_TYPE_OPTIONS: readonly { label: string; value: TransactionTypeFilter }[] = [
  { label: "Tất cả loại", value: "ALL" },
  { label: "Khóa học", value: "COURSE" },
  { label: "Trả phí", value: "MEMBERSHIP" },
];

export const TRANSACTION_SORT_OPTIONS: readonly { label: string; value: string }[] = [
  { label: "Mới nhất", value: "createdAt,desc" },
  { label: "Cũ nhất", value: "createdAt,asc" },
  { label: "Giá trị cao nhất", value: "totalPrice,desc" },
  { label: "Giá trị thấp nhất", value: "totalPrice,asc" },
];

export const DEFAULT_TRANSACTION_SORT = "createdAt,desc";
export const TRANSACTION_PAGE_SIZE = 10;

/**
 * Lọc phía client TRÊN TRANG HIỆN TẠI (như bản cũ: tìm kiếm/loại chỉ áp lên 10 dòng đã tải; phân trang/sắp xếp ở máy chủ).
 * Từ khoá so với mã đơn, tên/username/email người mua, trạng thái thô và tên các mục.
 */
export function filterTransactions(list: readonly TransactionReportItem[], keyword: string, type: TransactionTypeFilter): TransactionReportItem[] {
  const q = keyword.trim().toLowerCase();
  return list.filter((tx) => {
    if (type !== "ALL" && !transactionTypes(tx.courses).includes(type)) return false;
    if (!q) return true;
    const fields = [
      String(tx.orderCode ?? ""),
      tx.buyer?.fullName ?? tx.buyer?.username ?? "",
      tx.buyer?.email ?? "",
      tx.status ?? "",
      (tx.courses ?? []).map((c) => c.packageName).join(" "),
    ];
    return fields.some((v) => v.toLowerCase().includes(q));
  });
}

export function formatPaidAt(iso: string | undefined): string {
  return iso ? dayjs(iso).format("DD/MM/YYYY HH:mm") : "-";
}

export function buyerDisplayName(buyer: TransactionBuyer | undefined): string {
  return buyer?.fullName || buyer?.username || "—";
}

/** Chữ cái đầu của username (bản cũ); thiếu => "?". */
export function buyerInitial(buyer: TransactionBuyer | undefined): string {
  return buyer?.username?.charAt(0).toUpperCase() || "?";
}

// ---- gói thành viên ----

export type MembershipPlanForm = MembershipPlanRequest;

export const EMPTY_MEMBERSHIP_FORM: MembershipPlanForm = { name: "", description: "", price: 0, durationInDays: 30, active: true };

export function planToForm(plan: MembershipPlan): MembershipPlanForm {
  return { name: plan.name, description: plan.description ?? "", price: plan.price, durationInDays: plan.durationInDays, active: plan.active };
}

/** Kiểm tra của bản cũ (!name || price <= 0) + thời hạn phải ≥ 1 ngày (InputNumber min=1 của bản cũ chỉ chặn ở giao diện). null = hợp lệ. */
export function validateMembershipPlan(form: MembershipPlanForm): string | null {
  if (!form.name.trim() || !(form.price > 0)) return "Vui lòng điền đầy đủ tên và giá hợp lệ";
  if (!Number.isInteger(form.durationInDays) || form.durationInDays < 1) return "Thời hạn phải là số ngày nguyên, tối thiểu 1";
  return null;
}

/** Bản cũ: price.toLocaleString("vi-VN") + " ₫" => "199.000 ₫". */
export function formatPlanPrice(price: number): string {
  return `${price.toLocaleString("vi-VN")} ₫`;
}

export function truncateDescription(text: string | undefined, max = 40): string {
  const value = text ?? "";
  return value.length > max ? `${value.substring(0, max)}...` : value;
}

export function membershipStatusMeta(active: boolean): { label: string; className: string } {
  return active ? { label: "Đang bán", className: "bg-success-light text-success" } : { label: "Đã ẩn", className: "bg-danger-light text-danger" };
}
