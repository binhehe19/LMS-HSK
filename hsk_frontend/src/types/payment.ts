// DTO dịch vụ thanh toán (core/types/payment.type.ts + membership.type.ts của HSK cũ): sao kê (/payment/reports/*) và gói thành viên
// (/payment/membership-plans/*). CHƯA đối chiếu với backend mới — hợp đồng GIẢ ĐỊNH, xem docs/api-requirements/payment.md.

export type TransactionItemType = "COURSE" | "MEMBERSHIP";

export interface TransactionBuyer {
  userId: string;
  username: string;
  fullName?: string;
  email?: string;
}

/** Một mục trong đơn (khoá học hoặc gói thành viên); bản cũ đặt tên trường là `courses` dù có cả gói. */
export interface TransactionItem {
  packageId: string;
  packageName: string;
  price: number;
  thumbnail?: string;
  /** Thiếu hoặc khác "MEMBERSHIP" => coi là khoá học (như bản cũ). */
  itemType?: TransactionItemType | string;
  durationInDays?: number;
}

export interface TransactionReportItem {
  orderId: string;
  orderCode: number;
  /** PENDING | PAYING | COMPLETED (hoặc PAID) | CANCELLED — chuẩn hoá ở lib/payment/payment-model.ts. */
  status: string;
  /** ISO-8601 */
  createdAt: string;
  paidAt?: string;
  totalPrice: number;
  buyer: TransactionBuyer;
  courses: TransactionItem[];
}

/** Trang giao dịch kiểu Spring Page (bản cũ đọc `content`, `totalPages`; `totalElements` cần cho phân trang server). */
export interface TransactionReportPage {
  content: TransactionReportItem[];
  totalPages: number;
  totalElements: number;
}

export interface TransactionReportQuery {
  /** Trang bắt đầu từ 0. */
  page: number;
  size: number;
  /** `createdAt,desc` | `createdAt,asc` | `totalPrice,desc` | `totalPrice,asc` */
  sort: string;
}

/** Mọi trường tuỳ chọn: bản cũ đã phải tự tính bù khi backend thiếu trường; bản mới hiện "—" thay vì số giả. */
export interface PaymentSummary {
  totalRevenue?: number;
  totalTransactions?: number;
  totalStudents?: number;
  totalCoursesSold?: number;
  totalMembershipsSold?: number;
}
