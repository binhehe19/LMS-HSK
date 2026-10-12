"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { fetchCampaigns } from "@/lib/api/notification-client";
import { clampedPageOrNull } from "@/lib/notifications/pagination";
import type { CampaignPageResponse, CampaignResponse } from "@/types/notification";

const HISTORY_PAGE_SIZE = 10; // như CampaignHistoryModal cũ (fetchCampaigns(page, 10))

/** Logic của modal "Lịch sử thông báo đã gửi": tải theo trang khi modal mở, xem chi tiết một chiến dịch. Chỉ đọc. */
export function useCampaignHistory(show: boolean) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CampaignResponse | null>(null);

  const { state, reload, lastData } = useKeyedFetch<CampaignPageResponse>(show ? `history:${page}` : null, async () => {
    try {
      const result = await fetchCampaigns(page, HISTORY_PAGE_SIZE);
      // Trang hiện tại không còn hợp lệ => về trang cuối còn dữ liệu (đổi khoá nên kết quả của trang cũ bị bỏ).
      const lastValid = clampedPageOrNull(page, result?.totalElements ?? 0, HISTORY_PAGE_SIZE);
      if (lastValid !== null) setPage(lastValid);
      return result;
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error("Không tải được lịch sử thông báo"); // như bản cũ
      throw error;
    }
  });

  const data = state.kind === "ok" ? state.data : null;

  return {
    state,
    campaigns: data && Array.isArray(data.items) ? data.items : [],
    totalPages: lastData?.totalPages ?? 1, // giữ khi đang tải trang khác (bản cũ giữ totalPages trong state)
    page,
    selected,
    select: setSelected,
    goToPage: setPage,
    reload,
  };
}
