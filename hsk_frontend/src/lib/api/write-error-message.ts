// Thông điệp lỗi thống nhất cho một THAO TÁC GHI ở các màn M5 (khoá học trực tuyến, tài liệu, kho lưu trữ, ticket, sao kê, gói thành viên):
// công tắc ghi đóng hoặc dịch vụ chưa cấu hình => "chưa tích hợp" (không bao giờ là "thành công giả"); lỗi API => thông điệp (đã thân thiện) của nó;
// lỗi khác (mạng hỏng giữa chừng, lỗi lập trình) => câu dự phòng của màn cũ — không in `error.message` thô.
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { WriteDisabledError } from "@/lib/api/write-gate";

export const WRITE_NOT_INTEGRATED_MESSAGE = "Thao tác chưa được tích hợp với backend (WAITING FOR BACKEND).";

export const STORAGE_NOT_CONFIGURED_MESSAGE = "Kho lưu trữ chưa được cấu hình.";

export function writeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof WriteDisabledError || error instanceof ApiNotConfiguredError) return WRITE_NOT_INTEGRATED_MESSAGE;
  if (error instanceof ApiError && error.message) return error.message;
  return fallback;
}
