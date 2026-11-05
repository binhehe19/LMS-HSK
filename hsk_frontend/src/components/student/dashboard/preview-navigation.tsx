import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, type ComponentProps } from "react";

export const dashboardPath = "/student/student-dashboard";
// Implemented student routes use Next.js links; other actions stay in the preview.
export const all_routes = {
  studentDashboard: dashboardPath,
  studentTimetable: "/student/student-courses",
  studentQuiz: "/student/student-quiz",
  studentCourses: "/student/student-courses",
  studentWishlist: "/student/student-wishlist",
  studentProfile: "/student/student-profile",
  studentTickets: "/student/student-tickets",
  studentSettings: "Chỉnh sửa hồ sơ",
  vocabulary: "/vocabulary",
};
/** Route đã có trang thật trong khu học viên (đi bằng next/link); đích khác vẫn mở hộp thông báo xem trước. */
export const isImplementedRoute = (to: string) => to.startsWith("/student/") || to === all_routes.vocabulary || to.startsWith(`${all_routes.vocabulary}/`) || to.startsWith(`${all_routes.vocabulary}?`);
export const PreviewActionContext = createContext<(title: string) => void>(() => {});

export function useNavigate() {
  const open = useContext(PreviewActionContext);
  const router = useRouter();
  return (target: string) => isImplementedRoute(target) ? router.push(target) : open(target);
}

type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & { to: string };
export function Link({ to, onClick, children, ...props }: LinkProps) {
  const open = useContext(PreviewActionContext);
  return (
    <NextLink {...props} href={isImplementedRoute(to) ? to : dashboardPath} onClick={(event) => {
      onClick?.(event);
      if (!event.defaultPrevented && !isImplementedRoute(to)) {
        event.preventDefault();
        open(to);
      }
    }}>{children}</NextLink>
  );
}
