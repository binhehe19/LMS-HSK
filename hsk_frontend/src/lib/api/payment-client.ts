// Hàm gọi API dịch vụ thanh toán cho màn sao kê của Admin (/admin/statements).
// WAITING FOR BACKEND: đường dẫn kế thừa payment.service.ts của HSK cũ (tiền tố `/payment`) qua hskClient
// (NEXT_PUBLIC_HSK_API_BASE_PATH) theo HỢP ĐỒNG ĐỀ XUẤT ở docs/api-requirements/payment.md; backend chung LMS_IELTS chưa có dịch vụ thanh toán.
// Biến trống => ApiNotConfiguredError => màn hình hiện WAITING FOR BACKEND (không có dữ liệu giả — bản cũ rơi về dữ liệu MOCK khi lỗi, bản mới không).
"use client";

import { hskClient } from "@/lib/api/hsk-client";
import type { PaymentSummary, TransactionReportPage, TransactionReportQuery } from "@/types/payment";

/** Thẻ tổng của sao kê. Bản cũ: paymentService.getPaymentSummary. */
export function getPaymentSummary(): Promise<PaymentSummary> {
  return hskClient.get<PaymentSummary>("/payment/reports/summary");
}

/** Giao dịch phân trang + sắp xếp phía máy chủ. Bản cũ: paymentService.getTransactionReport({ page, size, sort }). */
export function getTransactionReport({ page, size, sort }: TransactionReportQuery): Promise<TransactionReportPage> {
  return hskClient.get<TransactionReportPage>(`/payment/reports/transactions?page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`);
}
