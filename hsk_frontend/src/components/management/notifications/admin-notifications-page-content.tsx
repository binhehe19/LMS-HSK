"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { CampaignHistoryModal } from "@/components/management/notifications/campaign-history-modal";
import { ManualNotificationComposer } from "@/components/management/notifications/manual-notification-composer";
import { NotificationListView } from "@/components/management/notifications/notification-list-view";
import { useNotificationPage } from "@/components/management/notifications/use-notification-page";

// Màn "Quản lý thông báo" của Admin (HSK cũ: InstructorNotification dùng chung, nhánh `canSendNotification`; AdminNotification chỉ là wrapper 9 dòng).
// Dùng LẠI danh sách thông báo của chính Admin (NotificationListView + useNotificationPage của màn Teacher); phần riêng của Admin là form gửi và lịch sử chiến dịch.
export function AdminNotificationsPageContent() {
  const router = useRouter();
  const page = useNotificationPage((url) => router.push(url));
  const [showComposer, setShowComposer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <ManagementPageFrame>
      {showComposer && (
        <ManualNotificationComposer
          onSuccess={() => {
            setShowComposer(false);
            page.reload(); // như bản cũ: đóng form, tải lại danh sách
          }}
          onCancel={() => setShowComposer(false)}
        />
      )}

      <NotificationListView
        title="Quản lý thông báo"
        state={page.state}
        items={page.items}
        unreadCount={page.unreadCount}
        totalElements={page.totalElements}
        filters={page.filters}
        headerActions={
          !showComposer && (
            <div className="d-flex align-items-center">
              <button type="button" className="btn btn-outline-primary btn-sm rounded-pill px-3 me-2" onClick={() => setShowHistory(true)}>
                <i className="isax isax-receipt-item me-1"></i> Thông báo đã gửi
              </button>
              <button type="button" className="btn btn-primary btn-sm rounded-pill px-3 me-2" onClick={() => setShowComposer(true)}>
                <i className="isax isax-add me-1"></i> Gửi Thông Báo Mới
              </button>
            </div>
          )
        }
        onMarkAllRead={page.markAllRead}
        onOpen={page.openNotification}
        onChangeFilters={page.changeFilters}
        onGoToPage={page.goToPage}
        onRetry={page.reload}
      />

      <CampaignHistoryModal show={showHistory} onClose={() => setShowHistory(false)} />
    </ManagementPageFrame>
  );
}
