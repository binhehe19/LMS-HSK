"use client";

import { useRouter } from "next/navigation";
import { InstructorWelcomeView } from "@/components/management/instructor-welcome/instructor-welcome-view";
import { useInstructorWelcome } from "@/components/management/instructor-welcome/use-instructor-welcome";
import { welcomeRoleLabel } from "@/lib/instructor-welcome/welcome-summary";
import { useAppSelector } from "@/redux/hooks";

// Đích của hai nút giống HSK cũ (all_routes.instructorTickets / instructorsettings). Hiện trạng: "/instructor/instructor-tickets" là trang
// "đang chuyển đổi"; "/instructor/instructor-settings" chưa có quyết định quyền (UNKNOWN) nên trả 404 — ghi ở docs/M3B2-WELCOME.md.
const TICKETS_URL = "/instructor/instructor-tickets";
const SETTINGS_URL = "/instructor/instructor-settings";

export function InstructorWelcomePageContent() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const { tickets, unread, reload } = useInstructorWelcome(user?.id);

  return (
    <InstructorWelcomeView
      // Bản cũ: name || username || "Giảng viên". Auth chung không trả username; dùng email như sidebar.
      displayName={user?.fullName || user?.email || "Giảng viên"}
      displayEmail={user?.email || ""}
      roleLabel={welcomeRoleLabel(user?.roles)}
      tickets={tickets}
      unread={unread}
      onOpenTickets={() => router.push(TICKETS_URL)}
      onOpenSettings={() => router.push(SETTINGS_URL)}
      onRetry={reload}
    />
  );
}
