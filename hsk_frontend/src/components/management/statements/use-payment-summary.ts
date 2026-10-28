"use client";

import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError } from "@/lib/api/api-client";
import { getPaymentSummary } from "@/lib/api/payment-client";
import type { PaymentSummary } from "@/types/payment";

/**
 * Thẻ tổng của sao kê. Bản cũ khi endpoint lỗi/thiếu trường tự duyệt tối đa 50 trang giao dịch để tính bù (che lỗi, tốn 50 request): KHÔNG port;
 * lỗi/chưa cấu hình hiện trạng thái, trường thiếu hiện "—".
 */
export function usePaymentSummary() {
  return useKeyedFetch<PaymentSummary>("payment-summary", async () => {
    const data = await getPaymentSummary();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError("Dữ liệu tổng quan sao kê không đúng định dạng.", 200);
    return data;
  });
}
