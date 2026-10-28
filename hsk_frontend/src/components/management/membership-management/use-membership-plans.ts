"use client";

import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError } from "@/lib/api/api-client";
import { listAdminMembershipPlans } from "@/lib/api/payment-client";
import type { MembershipPlan } from "@/types/payment";

/** Mọi gói thành viên (kể cả đã ẩn). Bản cũ rơi về 2 gói MOCK khi API lỗi — ở đây lỗi/chưa cấu hình là trạng thái hiển thị, không có dữ liệu giả. */
export function useMembershipPlans() {
  return useKeyedFetch<MembershipPlan[]>("membership-plans", async () => {
    const data = await listAdminMembershipPlans();
    if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách gói.", 200);
    return data;
  });
}
