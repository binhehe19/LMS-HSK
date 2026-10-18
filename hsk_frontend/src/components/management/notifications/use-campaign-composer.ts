"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { getCampaignSendAvailability } from "@/lib/api/campaign-send-gate";
import { CampaignSendDisabledError, sendCampaign } from "@/lib/api/notification-client";
import { buildCampaignRequest, validateCampaignForm, type CampaignFormValues } from "@/lib/notifications/campaign-form";
import { addRecipients, toggleRecipient } from "@/lib/notifications/recipient-selection";
import type { AdminUser } from "@/types/admin-user";

/**
 * Logic form "Gửi Thông Báo Hệ Thống" (ManualNotificationComposer của HSK cũ): nhập tiêu đề/nội dung, chọn người nhận, xem trước, gửi.
 *
 * An toàn cho thao tác ghi:
 * - `sendAvailability === "waiting"` (công tắc gửi chưa mở, xem lib/api/campaign-send-gate.ts): KHÔNG có đường nào dẫn tới request gửi — nút
 *   "Xem trước & Gửi" bị khoá, `openPreview`/`confirmSend` không làm gì, và `sendCampaign` còn tự chặn lần nữa.
 * - Chống gửi trùng: khoá đồng bộ bằng ref (bấm đúp trước khi React kịp vẽ lại vẫn chỉ gửi một lần) + nút xác nhận bị khoá khi đang gửi.
 * - Chỉ báo "đã gửi thành công" khi máy chủ xác nhận; lỗi giữ nguyên nội dung đã nhập (như bản cũ) để người dùng thử lại.
 */
export function useCampaignComposer(onSent: () => void) {
  const [form, setForm] = useState<CampaignFormValues>({ title: "", message: "" });
  const [recipients, setRecipients] = useState<ReadonlyMap<string, string>>(new Map());
  const [showPreview, setShowPreview] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const demo = useDemoMode(); // chế độ demo (mock cách ly) mở công tắc gửi mà không cần cờ NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND
  const sendAvailability = getCampaignSendAvailability(demo);

  const toggle = useCallback((id: string, name?: string) => setRecipients((prev) => toggleRecipient(prev, id, name)), []);
  const addMany = useCallback((users: AdminUser[]) => setRecipients((prev) => addRecipients(prev, users)), []);
  const clearRecipients = useCallback(() => setRecipients(new Map()), []);

  const openPreview = () => {
    if (sendAvailability !== "enabled") return;
    const error = validateCampaignForm(form, recipients.size);
    if (error) {
      toast.error(error);
      return;
    }
    setShowPreview(true);
  };

  const confirmSend = async () => {
    if (sendAvailability !== "enabled" || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      await sendCampaign(buildCampaignRequest(form, [...recipients.keys()]), demo);
      toast.success("Thông báo đã được gửi thành công!");
      setForm({ title: "", message: "" });
      setRecipients(new Map());
      onSent();
    } catch (error) {
      toast.error(
        error instanceof CampaignSendDisabledError || error instanceof ApiNotConfiguredError
          ? "Gửi thông báo chưa được tích hợp (chờ backend)."
          : "Gửi thất bại, vui lòng thử lại.",
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
      setShowPreview(false);
    }
  };

  return {
    form,
    setTitle: (title: string) => setForm((prev) => ({ ...prev, title })),
    setMessage: (message: string) => setForm((prev) => ({ ...prev, message })),
    recipients,
    toggle,
    addMany,
    clearRecipients,
    showPreview,
    closePreview: () => setShowPreview(false),
    showUserModal,
    setShowUserModal,
    isSubmitting,
    sendAvailability,
    openPreview,
    confirmSend,
  };
}
