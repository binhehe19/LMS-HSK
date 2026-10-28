// Hàm thuần cho form Tạo/Sửa giảng viên (teacher-management-page.tsx của HSK cũ): kiểm tra dữ liệu và dựng payload. Không import React.
import type { TeacherCreateRequest, TeacherUpdateRequest, TeacherUser } from "@/types/teacher-management";

/** Như EMAIL_REGEX của bản cũ (TLD ≥ 2 ký tự). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (value: string): boolean => EMAIL_REGEX.test(value.trim());

/** Giới hạn ký tự của các trường tuỳ chọn (maxLength ở form cũ). */
export const TEACHER_FIELD_LIMITS = {
  shortDescription: 500,
  fullDescription: 5000,
  teachingStyle: 300,
  qualification: 500,
} as const;

export interface TeacherFormValues {
  email: string;
  fullName: string;
  avatarUrl: string;
  shortDescription: string;
  fullDescription: string;
  teachingStyle: string;
  qualification: string;
  videoIntroLink: string;
}

export const EMPTY_TEACHER_FORM: TeacherFormValues = {
  email: "",
  fullName: "",
  avatarUrl: "",
  shortDescription: "",
  fullDescription: "",
  teachingStyle: "",
  qualification: "",
  videoIntroLink: "",
};

export type TeacherFormMode = "create" | "edit";

/** Giá trị form Sửa từ bản ghi hiện có (openEditModal cũ). */
export function formFromTeacher(teacher: TeacherUser): TeacherFormValues {
  return {
    email: teacher.email,
    fullName: teacher.fullName ?? "",
    avatarUrl: teacher.avatarUrl ?? "",
    shortDescription: teacher.shortDescription ?? "",
    fullDescription: teacher.fullDescription ?? "",
    teachingStyle: teacher.teachingStyle ?? "",
    qualification: teacher.qualification ?? "",
    videoIntroLink: teacher.videoIntroLink ?? "",
  };
}

/**
 * Lỗi đầu tiên của form hoặc null. Thứ tự và câu chữ như submitCreateTeacher/submitUpdateTeacher cũ (họ tên trước, email sau);
 * giới hạn ký tự được kiểm tra thêm ở đây vì bản cũ chỉ dựa vào maxLength của ô nhập (dán văn bản dài vẫn lọt).
 */
export function validateTeacherForm(values: TeacherFormValues, mode: TeacherFormMode): string | null {
  if (!values.fullName.trim()) return "Họ và tên là bắt buộc";
  // Form Sửa khoá ô email (giá trị từ bản ghi) nhưng vẫn kiểm tra như updateEmailValid cũ (bản ghi email hỏng thì không cho lưu).
  if (!isValidEmail(values.email)) return mode === "create" ? "Email chưa đúng định dạng" : "Email của giảng viên không hợp lệ";
  for (const [field, limit] of Object.entries(TEACHER_FIELD_LIMITS) as [keyof typeof TEACHER_FIELD_LIMITS, number][]) {
    if (values[field].trim().length > limit) return `${FIELD_LABELS[field]} tối đa ${limit} ký tự`;
  }
  return null;
}

const FIELD_LABELS: Record<keyof typeof TEACHER_FIELD_LIMITS, string> = {
  shortDescription: "Mô tả ngắn",
  fullDescription: "Mô tả chi tiết",
  teachingStyle: "Phong cách giảng dạy",
  qualification: "Bằng cấp / Chứng chỉ",
};

const optional = (value: string): string | undefined => value.trim() || undefined;

/** Payload tạo mới: cắt khoảng trắng, trường tuỳ chọn rỗng => bỏ (undefined) như bản cũ. */
export function buildCreatePayload(values: TeacherFormValues): TeacherCreateRequest {
  return {
    email: values.email.trim(),
    fullName: values.fullName.trim(),
    avatarUrl: optional(values.avatarUrl),
    shortDescription: optional(values.shortDescription),
    fullDescription: optional(values.fullDescription),
    teachingStyle: optional(values.teachingStyle),
    qualification: optional(values.qualification),
    videoIntroLink: optional(values.videoIntroLink),
  };
}

/** Payload cập nhật: không gửi email (ô email bị khoá ở form Sửa như bản cũ) và không gửi status. */
export function buildUpdatePayload(values: TeacherFormValues): TeacherUpdateRequest {
  return {
    fullName: values.fullName.trim(),
    avatarUrl: optional(values.avatarUrl),
    shortDescription: optional(values.shortDescription),
    fullDescription: optional(values.fullDescription),
    teachingStyle: optional(values.teachingStyle),
    qualification: optional(values.qualification),
    videoIntroLink: optional(values.videoIntroLink),
  };
}

/** Thông điệp khi gửi email tài khoản thất bại (getEmailFailureMessage cũ). */
export const emailFailureMessage = (reason?: string | null): string => (reason ? `Gửi email thất bại: ${reason}` : "Gửi email thất bại");
