// Client cho quiz service (chấm bài, lớp học theo chấm bài...), dùng chung createApiClient như lms-client của IELTS.
// Mỗi backend service có một client + một biến base path riêng; thêm service mới = thêm một file giống file này.
//
// NEXT_PUBLIC_QUIZ_API_BASE_PATH nhận đường dẫn cùng origin (vd "/api/quiz", proxy bởi Traefik/gateway ở môi trường
// chạy và bởi `rewrites` ở dev, xem next.config.ts) hoặc URL tuyệt đối. Để trống = service chưa được cấu hình:
// màn hình hiện trạng thái "chưa tích hợp" (WAITING FOR BACKEND), không phải lỗi API. Không có giá trị mặc định.
"use client";

import { createApiClient } from "@/lib/api/api-client";

function getQuizApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_QUIZ_API_BASE_PATH?.trim().replace(/\/+$/, "");
  return base || null;
}

export const quizClient = createApiClient(getQuizApiBase);
