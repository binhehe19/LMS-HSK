// WAITING FOR BACKEND — Hàm gọi API màn Quản lý giảng viên (/admin/teacher-management) theo HỢP ĐỒNG ĐỀ XUẤT, kế thừa đường dẫn
// `/id/teachers/*` của teacher-management.service.ts HSK cũ (dịch vụ định danh), qua base NEXT_PUBLIC_HSK_API_BASE_PATH (lib/api/hsk-client.ts).
// Backend chung LMS_IELTS CHƯA có endpoint giảng viên nên ở production biến này trống => mọi hàm ném ApiNotConfiguredError => màn hình hiện
// WAITING FOR BACKEND. Máy chủ giả lập: scripts/mock/handlers/teachers.mjs. Hợp đồng chi tiết: docs/api-requirements/teacher-management.md.
//
// Khác service cũ có chủ đích: KHÔNG sao chép chuỗi fallback (block lỗi → DELETE → PUT {status}); mỗi thao tác đúng một endpoint, lỗi là lỗi.
// Thao tác GHI đi qua công tắc an toàn (lib/api/write-gate.ts, miền "teacher-management"): chỉ chạy trong chế độ xem trước cục bộ hoặc khi
// NEXT_PUBLIC_WRITE_TEACHER_MANAGEMENT=enabled; ngược lại ném WriteDisabledError, KHÔNG tạo request.
"use client";

import { ApiNotConfiguredError, apiFetch } from "@/lib/api/api-client";
import { hskClient } from "@/lib/api/hsk-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type {
  TeacherCreateRequest,
  TeacherCreateResult,
  TeacherImportResult,
  TeacherJobStatus,
  TeacherSyncResponse,
  TeacherUpdateRequest,
  TeacherUser,
} from "@/types/teacher-management";

const enc = encodeURIComponent;
const FEATURE = "teacher-management";

/** Toàn bộ giảng viên (ROLE_ADMIN). Bản cũ bóc mảng từ nhiều hình dạng (items/content/data.items); ở đây hợp đồng là MẢNG, hook kiểm tra. */
export function fetchTeachers() {
  return hskClient.get<TeacherUser[]>("/id/teachers");
}

/** Tiến trình nền (import Excel / đồng bộ CMS); màn hình hỏi lại mỗi 5 giây như bản cũ (loadImportStatus). */
export function fetchTeacherJobStatus() {
  return hskClient.get<TeacherJobStatus>("/id/teachers/import/status");
}

/** Tài khoản tạo trong 24 giờ qua (modal "Tài khoản mới"), kèm emailStatus. */
export function fetchRecentlyCreatedTeachers() {
  return hskClient.get<TeacherUser[]>("/id/teachers/recently-created");
}

// ---- thao tác GHI (write gate "teacher-management"). Hàm `async` để công tắc đóng cũng là promise bị reject, không ném đồng bộ ra người gọi. ----

/** Bắt đầu đồng bộ giảng viên từ CMS; theo dõi tiến trình qua fetchTeacherJobStatus. */
export async function syncTeachersFromCms(demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<TeacherSyncResponse>("/id/teachers/sync");
}

/** Tạo tài khoản giảng viên; backend tự sinh mật khẩu và gửi email (kết quả gửi trong emailStatus). */
export async function createTeacher(body: TeacherCreateRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<TeacherCreateResult>("/id/teachers", body);
}

/** Cập nhật hồ sơ (hoặc email, từ modal "Tài khoản mới"). Không đổi trạng thái qua đây. */
export async function updateTeacher(teacherId: string, body: TeacherUpdateRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.put<TeacherUser>(`/id/teachers/${enc(teacherId)}`, body);
}

/** Gửi lại email tài khoản (nút "Cấp lại mật khẩu" / "Gửi lại email"). */
export async function resendTeacherAccountEmail(teacherId: string, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<TeacherCreateResult>(`/id/teachers/${enc(teacherId)}/resend-account-email`);
}

/** Khoá quyền truy cập (ACTIVE → BLOCKED). */
export async function blockTeacher(teacherId: string, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<TeacherUser>(`/id/teachers/${enc(teacherId)}/block`);
}

/** Mở khoá (BLOCKED → ACTIVE). Bản cũ thử thêm /unblock khi /activate 404 — không giữ. */
export async function activateTeacher(teacherId: string, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<TeacherUser>(`/id/teachers/${enc(teacherId)}/activate`);
}

/**
 * Import danh sách từ file (multipart, trường `file`). `createApiClient.post` luôn JSON hoá body nên đi thẳng `apiFetch` với cùng base của
 * hskClient (cùng cookie/Bearer/refresh một lần); api-client tự bỏ Content-Type để trình duyệt đặt boundary.
 */
export async function importTeachers(file: File, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  const base = process.env.NEXT_PUBLIC_HSK_API_BASE_PATH?.trim().replace(/\/+$/, "");
  if (!base) throw new ApiNotConfiguredError();
  const form = new FormData();
  form.append("file", file);
  return apiFetch<TeacherImportResult>(base, "/id/teachers/import", { method: "POST", body: form });
}
