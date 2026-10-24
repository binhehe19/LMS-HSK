"use client";

import { useEffect, useState } from "react";
import { getTickets } from "@/lib/api/ticket-client";
import { canManageContent, canPublishContent, type ContentAccessTicket, type ContentModule } from "@/lib/tickets/ticket-access";
import { useAppSelector } from "@/redux/hooks";

export type ContentAccessStatus = "loading" | "ready" | "unavailable";

export interface ContentAccess {
  /** Thêm/Sửa/Xoá mục nội dung (theo ticket với giảng viên; luôn true với Admin). */
  canManage: boolean;
  /** Publish/Unpublish gói: chỉ Admin/Teacher-manager. */
  canPublish: boolean;
  /** `unavailable` = dịch vụ ticket chưa cấu hình hoặc lỗi: giảng viên bị coi là KHÔNG có quyền (fail-closed), Admin không bị ảnh hưởng. */
  status: ContentAccessStatus;
}

// Ticket của người dùng hiện tại được lấy MỘT lần cho mọi màn nội dung trong phiên tab (cùng người dùng), vì mỗi màn đều cần cùng danh sách.
let cache: { userId: string; promise: Promise<ContentAccessTicket[]> } | null = null;
function loadTickets(userId: string): Promise<ContentAccessTicket[]> {
  if (!cache || cache.userId !== userId) {
    const promise = getTickets(0, 100).catch((): ContentAccessTicket[] | null => null) as Promise<ContentAccessTicket[]>;
    cache = { userId, promise };
  }
  return cache.promise;
}
/** Chỉ cho test. */
export function resetContentAccessCache(): void {
  cache = null;
}

/**
 * Quyền của người dùng hiện tại trên một module nội dung (quy tắc ở lib/tickets/ticket-access.ts). Admin: trả lời ngay, không gọi ticket.
 * Giảng viên: chờ danh sách ticket; chưa có/lỗi => `unavailable` và chỉ xem (màn hiện Alert "Chế độ Xem duy nhất" như HSK cũ).
 */
export function useContentAccess(module: ContentModule): ContentAccess {
  const roles = useAppSelector((state) => state.auth.user?.roles);
  const userId = useAppSelector((state) => state.auth.user?.id);
  const publish = canPublishContent(roles);
  const [tickets, setTickets] = useState<ContentAccessTicket[] | null | undefined>(undefined);

  useEffect(() => {
    if (publish || !userId) return;
    let cancelled = false;
    loadTickets(userId).then((list) => {
      if (!cancelled) setTickets(list ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [publish, userId]);

  if (publish) return { canManage: true, canPublish: true, status: "ready" };
  if (tickets === undefined) return { canManage: false, canPublish: false, status: "loading" };
  if (tickets === null) return { canManage: false, canPublish: false, status: "unavailable" };
  return { canManage: canManageContent(roles, userId, tickets, module), canPublish: false, status: "ready" };
}
