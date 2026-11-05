import type { SendCampaignRequest } from "@/types/notification";

export const CAMPAIGN_FORM_INCOMPLETE_MESSAGE = "Vui lòng nhập đầy đủ tiêu đề, nội dung và chọn ít nhất 1 người nhận.";

export interface CampaignFormValues {
  title: string;
  message: string;
}

/**
 * Kiểm tra form gửi thông báo. Trả về thông báo lỗi (đúng chữ HSK cũ) hoặc null nếu hợp lệ.
 * Khác bản cũ có chủ đích: tiêu đề/nội dung chỉ gồm khoảng trắng bị coi là trống (bản cũ chỉ kiểm tra chuỗi rỗng nên "   " lọt qua).
 */
export function validateCampaignForm(values: CampaignFormValues, recipientCount: number): string | null {
  if (!values.title.trim() || !values.message.trim() || recipientCount === 0) return CAMPAIGN_FORM_INCOMPLETE_MESSAGE;
  return null;
}

/** Nội dung gửi đi: tiêu đề/nội dung đã cắt khoảng trắng hai đầu, `userIds` theo thứ tự đã chọn. */
export function buildCampaignRequest(values: CampaignFormValues, userIds: readonly string[]): SendCampaignRequest {
  return { title: values.title.trim(), message: values.message.trim(), userIds: [...userIds] };
}
