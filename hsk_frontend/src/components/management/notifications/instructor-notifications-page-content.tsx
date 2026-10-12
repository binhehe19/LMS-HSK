"use client";

import { useRouter } from "next/navigation";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { NotificationListView } from "@/components/management/notifications/notification-list-view";
import { useNotificationPage } from "@/components/management/notifications/use-notification-page";

// Màn "Thông báo của tôi" của Giảng viên/Cố vấn (HSK cũ: features/instructor/instructor-settings/instructor-notification/instructor-notification.tsx).
// Bản cũ dùng CHUNG component này cho Admin/Teacher-manager, kèm nút "Gửi Thông Báo Mới"/"Thông báo đã gửi"; các nút đó chỉ hiện khi
// isAdmin || isTeacherManager nên Giảng viên không bao giờ thấy — màn này chỉ port phần danh sách (xem docs/M3B3-NOTIFICATIONS.md).
export function InstructorNotificationsPageContent() {
  const router = useRouter();
  const page = useNotificationPage((url) => router.push(url));

  return (
    <ManagementPageFrame>
      <NotificationListView
        title="Thông báo của tôi"
        state={page.state}
        items={page.items}
        unreadCount={page.unreadCount}
        totalElements={page.totalElements}
        filters={page.filters}
        onMarkAllRead={page.markAllRead}
        onOpen={page.openNotification}
        onChangeFilters={page.changeFilters}
        onGoToPage={page.goToPage}
        onRetry={page.reload}
      />
    </ManagementPageFrame>
  );
}
