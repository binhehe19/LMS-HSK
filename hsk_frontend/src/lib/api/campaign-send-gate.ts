// Công tắc an toàn cho thao tác GỬI chiến dịch thông báo (thao tác ghi, không thể hoàn tác, gửi tới nhiều người).
//
// Hợp đồng `POST /notification/admin/campaigns/send-now` là ĐỀ XUẤT (repo-notification của backend chung không có REST tạo thông báo; xem
// docs/api-requirements/notifications.md mục 5), đi qua hsk-client (NEXT_PUBLIC_HSK_API_BASE_PATH). Việc gửi chỉ được mở khi (a) đang ở CHẾ ĐỘ XEM TRƯỚC
// CỤC BỘ với máy chủ giả lập cách ly (`demoActive`, lib/demo/demo-mode.ts), hoặc (b) người triển khai chủ động đặt NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND=enabled
// sau khi backend xác nhận. Mặc định (trống, không demo) hoặc thiếu địa chỉ dịch vụ = đóng: giao diện hiện "chưa tích hợp", không có đường nào dẫn tới
// request ghi. Không phải cờ mock: không nằm trong guard production.
export type CampaignSendAvailability = "enabled" | "waiting";

export function getCampaignSendAvailability(demoActive = false): CampaignSendAvailability {
  const base = process.env.NEXT_PUBLIC_HSK_API_BASE_PATH?.trim();
  const flag = process.env.NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND?.trim();
  return base && (demoActive || flag === "enabled") ? "enabled" : "waiting";
}
