// DTO thông báo theo HỢP ĐỒNG THẬT của repo-notification (backend chung LMS_IELTS, Go/Echo; đọc source 2026-10-27):
//   item {id, action, title, message, resourceId, payload, read, seen, createdAt, readAt, seenAt, dedupeKey}; trang {items, totalElements, totalPages, page, size, unreadCount}
// HSK cũ (core/services/notificationService.ts) có thêm topic/resourceType — giữ tuỳ chọn để không phá giao diện đã chuyển.
// Chiến dịch (Admin gửi) KHÔNG có trong backend chung: hợp đồng đề xuất, đi qua hsk-client (docs/api-requirements/notifications.md mục 5).
export interface NotificationResponse {
  id: string;
  /** Backend chung: loại sự kiện (ASSESSMENT_GRADED, ASSESSMENT_REGRADED…). */
  action?: string;
  /** HSK cũ. */
  topic?: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  payload: NotificationPayload | null;
  read: boolean;
  seen: boolean;
  createdAt: string;
  readAt: string | null;
  seenAt: string | null;
  dedupeKey?: string;
}

/** Bản cũ đọc targetUrl/deepLink để điều hướng khi bấm vào thông báo. Backend chung gửi {attemptId, sessionId, sessionNo, contentPackageVersionId} cho sự kiện chấm bài. */
export interface NotificationPayload {
  targetUrl?: string;
  deepLink?: string;
  [key: string]: unknown;
}

export interface NotificationPageResponse {
  items: NotificationResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  unreadCount: number;
}

/** GET /notifications/unread-count của backend chung trả object; HSK cũ trả số trần — client chấp nhận cả hai. */
export interface UnreadCountResponse {
  unreadCount: number;
}

/** Bộ lọc/phân trang của danh sách thông báo (màn "Thông báo của tôi"); khớp NotificationFilters của HSK cũ. Backend chung không lọc => client lọc (lib/notifications/notification-filter.ts). */
export interface NotificationFilters {
  readStatus: "ALL" | "READ" | "UNREAD";
  /** ISO-8601, đầu ngày (theo múi giờ trình duyệt) */
  fromDate?: string;
  /** ISO-8601, cuối ngày */
  toDate?: string;
  /** Trang bắt đầu từ 0 */
  page: number;
  size: number;
}

/** Chiến dịch thông báo do Admin gửi (notificationService.ts của HSK cũ). Hợp đồng ĐỀ XUẤT, backend chung chưa có. */
export interface CampaignResponse {
  id: string;
  title: string;
  message: string;
  audienceType: string;
  /** Bản cũ chỉ tô màu cho SUCCESS / PROCESSING; giá trị khác hiện màu cảnh báo. */
  status: string;
  createdAt: string;
}

export interface CampaignPageResponse {
  items: CampaignResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface SendCampaignRequest {
  title: string;
  message: string;
  userIds: string[];
}
