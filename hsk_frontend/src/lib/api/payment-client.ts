// Hàm gọi API dịch vụ thanh toán cho hai màn Admin: sao kê (/admin/statements) và gói thành viên (/admin/membership-management).
// WAITING FOR BACKEND: đường dẫn kế thừa payment.service.ts / membership.service.ts của HSK cũ (tiền tố `/payment`) qua hskClient
// (NEXT_PUBLIC_HSK_API_BASE_PATH) theo HỢP ĐỒNG ĐỀ XUẤT ở docs/api-requirements/payment.md; backend chung LMS_IELTS chưa có dịch vụ thanh toán.
// Biến trống => ApiNotConfiguredError => màn hình hiện WAITING FOR BACKEND (không có dữ liệu giả — bản cũ rơi về dữ liệu MOCK khi lỗi, bản mới không).
//
// Thao tác GHI (CRUD gói) đi qua công tắc an toàn (lib/api/write-gate.ts, miền "membership"); ngoài chế độ demo cục bộ hoặc
// NEXT_PUBLIC_WRITE_MEMBERSHIP=enabled, hàm ném WriteDisabledError và KHÔNG tạo request.
"use client";

import { hskClient } from "@/lib/api/hsk-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { MembershipPlan, MembershipPlanRequest, PaymentSummary, TransactionReportPage, TransactionReportQuery } from "@/types/payment";

const enc = encodeURIComponent;

/** Thẻ tổng của sao kê. Bản cũ: paymentService.getPaymentSummary. */
export function getPaymentSummary(): Promise<PaymentSummary> {
  return hskClient.get<PaymentSummary>("/payment/reports/summary");
}

/** Giao dịch phân trang + sắp xếp phía máy chủ. Bản cũ: paymentService.getTransactionReport({ page, size, sort }). */
export function getTransactionReport({ page, size, sort }: TransactionReportQuery): Promise<TransactionReportPage> {
  return hskClient.get<TransactionReportPage>(`/payment/reports/transactions?page=${page}&size=${size}&sort=${enc(sort)}`);
}

/** Mọi gói (kể cả đã ẩn) cho Admin. Bản cũ: membershipService.getAdminPlans. */
export function listAdminMembershipPlans(): Promise<MembershipPlan[]> {
  return hskClient.get<MembershipPlan[]>("/payment/membership-plans/admin/all");
}

// ---- thao tác GHI (write gate "membership"); `async` để lỗi công tắc cũng là promise bị reject ----

export async function createMembershipPlan(body: MembershipPlanRequest, demoActive: boolean): Promise<MembershipPlan> {
  assertWriteEnabled("membership", demoActive);
  return hskClient.post<MembershipPlan>("/payment/membership-plans/admin", body);
}

export async function updateMembershipPlan(id: string, body: MembershipPlanRequest, demoActive: boolean): Promise<MembershipPlan> {
  assertWriteEnabled("membership", demoActive);
  return hskClient.put<MembershipPlan>(`/payment/membership-plans/admin/${enc(id)}`, body);
}

export async function deleteMembershipPlan(id: string, demoActive: boolean): Promise<void> {
  assertWriteEnabled("membership", demoActive);
  await hskClient.delete<unknown>(`/payment/membership-plans/admin/${enc(id)}`);
}
