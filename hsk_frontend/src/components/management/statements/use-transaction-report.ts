"use client";

import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError } from "@/lib/api/api-client";
import { getTransactionReport } from "@/lib/api/payment-client";
import { TRANSACTION_PAGE_SIZE } from "@/lib/payment/payment-model";
import type { TransactionReportPage } from "@/types/payment";

/** Một trang giao dịch theo (trang, sắp xếp) — đổi khoá => tải lại, phản hồi của khoá cũ bị bỏ; `lastData` giữ thanh phân trang khi đang tải trang khác. */
export function useTransactionReport(page: number, sort: string) {
  return useKeyedFetch<TransactionReportPage>(`transactions:${page}:${sort}`, async () => {
    const data = await getTransactionReport({ page, size: TRANSACTION_PAGE_SIZE, sort });
    if (!data || !Array.isArray(data.content)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách giao dịch.", 200);
    return data;
  });
}
