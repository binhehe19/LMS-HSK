// Client cho backend chung LMS_IELTS/backend/repo-lms (`/api/lms/*` sau Traefik). Cùng khuôn với quiz-client.ts: một biến base path,
// trống = chưa cấu hình (WAITING FOR BACKEND), không có giá trị mặc định trỏ hệ thống thật.
// Lưu ý hợp đồng (đọc source 2026-10-27): response bọc {success, errorCode, errorMessage, data} (api-client tự bóc); PageResponse snake_case (types/lms.ts);
// mọi endpoint yêu cầu email đã xác minh (403 mã 233) và phần lớn endpoint quản lý yêu cầu ROLE_ADMIN.
"use client";

import { createApiClient } from "@/lib/api/api-client";

function getLmsApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_LMS_API_BASE_PATH?.trim().replace(/\/+$/, "");
  return base || null;
}

/** Gốc API của repo-lms (rỗng khi chưa cấu hình); dùng cho request `keepalive` ngoài `lmsClient` (nhả khoá khi đóng tab). */
export function getLmsApiBaseUrl(): string {
  return getLmsApiBase() ?? "";
}

export function isLmsApiConfigured(): boolean {
  return getLmsApiBase() !== null;
}

export const lmsClient = createApiClient(getLmsApiBase);
