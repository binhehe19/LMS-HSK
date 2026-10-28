// DTO màn "Quản lý giảng viên" (/admin/teacher-management), kế thừa core/types/teacher-management.type.ts của HSK cũ.
// Hợp đồng ĐỀ XUẤT, backend chung CHƯA có (docs/api-requirements/teacher-management.md): đường dẫn `/id/teachers/*` của dịch vụ định danh HSK cũ.
// Khác bản cũ có chủ đích: `status` chỉ còn hai giá trị màn hình dùng; `TeacherUpdateRequest` KHÔNG có `status` (khoá/mở khoá đi qua
// /block và /activate — một endpoint một việc, bỏ chuỗi fallback DELETE → PUT status của service cũ).

export type TeacherStatus = "ACTIVE" | "BLOCKED";

/** Kết quả gửi email tài khoản (mật khẩu tự sinh) cho giảng viên. */
export type EmailDeliveryStatus = "SUCCESS" | "FAILED";

export interface TeacherUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string | null;
  status: TeacherStatus;
  roles: string[];
  shortDescription?: string | null;
  fullDescription?: string | null;
  teachingStyle?: string | null;
  qualification?: string | null;
  videoIntroLink?: string | null;
  /** Chỉ có ở tài khoản mới tạo (danh sách "Tài khoản mới", kết quả tạo/import/gửi lại). */
  emailStatus?: EmailDeliveryStatus;
  emailStatusReason?: string | null;
  /** ISO-8601; backend dùng để lọc "tài khoản mới trong 24 giờ". */
  createdAt?: string;
}

export interface TeacherCreateRequest {
  email: string;
  fullName: string;
  avatarUrl?: string;
  shortDescription?: string;
  fullDescription?: string;
  teachingStyle?: string;
  qualification?: string;
  videoIntroLink?: string;
}

/** Mọi trường tuỳ chọn; trường gửi lên là trường muốn đổi. Đổi email dùng chung endpoint này (modal "Tài khoản mới"). */
export interface TeacherUpdateRequest {
  email?: string;
  fullName?: string;
  avatarUrl?: string;
  shortDescription?: string;
  fullDescription?: string;
  teachingStyle?: string;
  qualification?: string;
  videoIntroLink?: string;
}

/** Phản hồi của tạo mới và gửi lại email tài khoản. */
export interface TeacherCreateResult {
  teacher: TeacherUser;
  emailStatus: EmailDeliveryStatus;
  emailStatusReason?: string | null;
}

export interface TeacherImportResult {
  createdCount: number;
  skippedCount?: number;
  skippedReasons?: string[];
  items: TeacherCreateResult[];
}

export type TeacherJobState = "IDLE" | "PROCESSING" | "DONE" | "FAILED";

/**
 * Trạng thái tiến trình nền của miền giảng viên (import Excel, đồng bộ CMS). `inProgress` giữ nguyên tên trường của HSK cũ
 * (`TeacherImportStatus.inProgress`); các trường còn lại là đề xuất để màn hình theo dõi job đồng bộ CMS.
 */
export interface TeacherJobStatus {
  inProgress: boolean;
  status: TeacherJobState;
  jobId?: string | null;
  type?: "SYNC" | "IMPORT" | null;
  message?: string | null;
  updatedAt?: string | null;
}

/** Phản hồi của POST /sync: backend nhận job và trả mã để theo dõi qua /import/status. */
export interface TeacherSyncResponse {
  jobId: string;
  status: "PROCESSING" | "DONE";
  message?: string | null;
}
