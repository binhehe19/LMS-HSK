// Client cho các dịch vụ nghiệp vụ HSK theo HỢP ĐỒNG ĐỀ XUẤT mà backend chung LMS_IELTS CHƯA có: giảng viên (/id/teachers), ticket phân công (/id/tickets),
// thanh toán/sao kê/gói thành viên (/payment), khoá học trực tuyến + đăng ký (/online-learning), kho nội dung HSK (/flashcard, /writing, /quiz, /grammar,
// /dictionary, /pronunciation), tài liệu học tập (/lesson-materials), kho lưu trữ (/storage), phân tích hành vi (/id/analytics), tổng quan quản trị.
// Đường dẫn kế thừa LMS_Frontend cũ (axios baseURL `${VITE_LMS_API_URL}/api` + tiền tố dịch vụ) để người phụ trách backend đối chiếu; đường dẫn cuối do
// backend quyết định (docs/api-requirements/*.md). Production: để trống NEXT_PUBLIC_HSK_API_BASE_PATH cho tới khi backend chung triển khai => màn hình
// hiện WAITING FOR BACKEND; chế độ xem trước cục bộ trỏ `/api/hsk` tới máy chủ giả lập.
"use client";

import { createApiClient } from "@/lib/api/api-client";

function getHskApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_HSK_API_BASE_PATH?.trim().replace(/\/+$/, "");
  return base || null;
}

export function isHskApiConfigured(): boolean {
  return getHskApiBase() !== null;
}

export const hskClient = createApiClient(getHskApiBase);
