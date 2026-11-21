// Kiểu và quy tắc "đang active" dùng chung cho mọi sidebar quản lý (dữ liệu menu của từng vai trò nằm ở file riêng:
// admin-nav.ts, instructor-nav.ts).
import { hasAnyRole, ROLES } from "@/lib/auth/roles";
import { getServedRoute } from "@/lib/management/route-registry";

export interface NavItem {
  /** Tiêu đề nhóm hiện phía trên mục này. */
  header?: string;
  title: string;
  /** Class icon. */
  icon: string;
  /** Đường dẫn nội bộ, hoặc URL tuyệt đối (liên kết ngoài, mở tab mới). */
  href: string;
  /** Mục cũng sáng khi pathname bắt đầu bằng prefix này (ngoài trường hợp trùng href). */
  activePrefix?: string;
  /** Hiện huy hiệu số thông báo chưa đọc cạnh mục này (bản cũ gắn theo nhãn "Quản lý thông báo"/"Thông báo của tôi"). */
  unreadBadge?: boolean;
  children?: NavItem[];
}

/**
 * Hợp của hai quy tắc cũ: InstructorSidebar (prefix HOẶC trùng href) và AdminSidebar (có prefix thì chỉ xét prefix).
 * Với menu Admin hiện có hai quy tắc cho kết quả giống nhau (test golden kiểm tra từng đường dẫn).
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.activePrefix && pathname.startsWith(item.activePrefix)) return true;
  return pathname === item.href.split("?")[0];
}

function canAccessNavHref(href: string, userRoles: readonly string[] | undefined | null): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  if (hasAnyRole(userRoles, [ROLES.ADMIN])) return true;
  if (!href || href.startsWith("http://") || href.startsWith("https://")) return false;
  const route = getServedRoute(href);
  return route ? hasAnyRole(userRoles, route.allowedRoles) : false;
}

/**
 * Lọc động các mục menu theo quyền thực tế của người dùng (ví dụ ROLE_RND chỉ thấy Giáo trình + Học liệu).
 * Giữ nguyên tiêu đề nhóm (`header`) cho mục đầu tiên còn hiển thị trong nhóm.
 */
export function filterNavItemsForRoles(items: readonly NavItem[], userRoles: readonly string[] | undefined | null): NavItem[] {
  if (!userRoles || userRoles.length === 0 || hasAnyRole(userRoles, [ROLES.ADMIN])) {
    return [...items];
  }
  const result: NavItem[] = [];
  let pendingHeader: string | undefined;

  for (const item of items) {
    if (item.header) pendingHeader = item.header;

    if (item.children && item.children.length > 0) {
      const visibleChildren = item.children.filter((child) => canAccessNavHref(child.href, userRoles));
      if (visibleChildren.length === 0) continue;
      const href = canAccessNavHref(item.href, userRoles) ? item.href : visibleChildren[0].href;
      result.push({
        ...item,
        header: pendingHeader,
        href,
        children: visibleChildren,
      });
      pendingHeader = undefined;
      continue;
    }

    if (!canAccessNavHref(item.href, userRoles)) continue;
    result.push({ ...item, header: pendingHeader });
    pendingHeader = undefined;
  }

  return result;
}
