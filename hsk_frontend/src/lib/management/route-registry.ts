// NGUỒN SỰ THẬT DUY NHẤT về route khu quản lý: route nào hợp lệ ở HSK cũ, đã chuyển chưa, role nào được vào.
// Mọi nơi khác (guard của layout, trang "đang chuyển đổi", sidebar, test, docs/ROUTE-STATUS.md) đọc từ đây — không có danh sách route thứ hai.
//
//   dữ kiện HSK cũ  : old-routes.generated.ts (sinh bởi scripts/survey-old-routes.mjs, không sửa tay)
//   quyết định mới  : MIGRATED_ROUTES (bên dưới) + MANAGEMENT_SUPPORTED_ROLES (lib/auth/roles.ts)
//
// Trạng thái:
//   MIGRATED      đã có trang thật trong src/app (tests/route-registry.test.ts đối chiếu với các file page.tsx)
//   NOT_MIGRATED  route hợp lệ của HSK cũ, guard ở HSK cũ xác định được role (PrivateRoute allowedRoles ∩ role app mới hỗ trợ ≠ ∅)
//                 → hiện trang "Chức năng đang được chuyển đổi" ở đúng URL cũ
//   UNKNOWN       KHÔNG đủ bằng chứng để phục vụ: HSK cũ không bọc PrivateRoute (không có guard ở tầng route) và chưa có quyết định của chủ dự án
//                 (UI_ROLE_DECISIONS), hoặc chỉ dành cho role chưa xác minh (Teacher-manager, Collaborator). Hiển thị 404
//   OUT_OF_SCOPE  HSK cũ chỉ hiển thị UnderConstructionContent (chưa từng có chức năng thật). Route học viên/công khai không nằm trong
//                 registry (ngoài phạm vi frontend quản lý, xem docs/OLD-ROUTE-SURVEY.md) và cũng trả 404
import { MANAGEMENT_SUPPORTED_ROLES, ROLES } from "@/lib/auth/roles";
import { OLD_MANAGEMENT_ROUTES, type OldRouteFact } from "@/lib/management/old-routes.generated";

export type RouteStatus = "MIGRATED" | "NOT_MIGRATED" | "UNKNOWN" | "OUT_OF_SCOPE";

/**
 * Các route đã có trang thật. Thêm một màn hình = tạo page.tsx ở ĐÚNG URL cũ + thêm dòng ở đây (route thật tự thay trang "đang chuyển đổi"
 * vì Next ưu tiên route tĩnh hơn route động). Test fail nếu hai bên lệch nhau.
 */
export const MIGRATED_ROUTES: readonly string[] = [
  // M1–M4B
  "/admin/class-management",
  "/admin/settings/notifications",
  "/instructor/welcome",
  "/instructor/instructor-notifications",
  "/instructor/list-class",
  "/instructor/list-class/list-lesson",
  // M5 — W1-E: tổng quan Admin, phân tích hành vi, học viên của lớp
  "/admin/dashboard",
  "/admin/analytics",
  "/admin/class-management/students",
  // M5 — W1-A: luồng chấm bài của giảng viên
  "/instructor/list-class/submissions",
  "/instructor/list-class/grading",
  "/instructor/list-class/lesson-detail",
  // M5 — W1-B: phân tích học tập
  "/instructor/list-class/learning-analysis",
  "/instructor/list-class/learning-analysis/detail",
  // M5 — W1-D: quản lý giảng viên
  "/admin/teacher-management",
  // M5 — W2-D: giáo trình (đọc thật từ backend chung) + module ôn luyện theo buổi
  "/learning-path/syllabus/manage",
  // M5 — W2-T: nền quản lý nội dung dạng cây; thẻ ghi nhớ / bộ từ vựng / bộ thẻ
  "/flashcard/create-package",
  "/flashcard/manage",
  "/flashcard/manage-learning-path",
  "/flashcard/manage-learning",
  "/vocab-set/manage",
  "/sets/create",
  "/sets/:id/edit",
  // M5 — W2-C: khoá học trực tuyến, đăng ký, tài liệu học tập, kho lưu trữ đa phương tiện
  "/learning-path/online-course/manage",
  "/learning-path/online-course/leads",
  "/learning-path/lesson-materials/manage",
  "/instructor/manage-storage",
  // M5 — W1-C: phân công công việc (Admin / giảng viên), sao kê, gói thành viên
  "/admin/tickets",
  "/instructor/instructor-tickets",
  "/admin/statements",
  "/admin/membership-management",
  // M5 — W2-E: luyện viết (Hán tự) + luyện phát âm trên nền content-tree
  "/hanzi/manage",
  "/hanzi/manage/select-type",
  "/hanzi/manage/create-package",
  "/hanzi/create",
  "/hanzi/edit/:id",
  "/pronunciation/manage",
  "/pronunciation/manage/select-type",
  // M5 — W2-B: bài tập (quiz + câu hỏi) và ngữ pháp trên nền content-tree; từ điển (màn riêng)
  "/quiz/manage",
  "/grammar/manage",
  "/vocabulary/manage",
];

/**
 * Route MIGRATED được đổi sang URL thực sự phục vụ, NGẮN hơn URL cũ của HSK (file page.tsx đặt ở URL mới trong src/app).
 * Role/guard/status vẫn tính theo URL CŨ (key ở đây) qua OLD_MANAGEMENT_ROUTES — không sửa dữ kiện cũ, chỉ thêm 1 alias
 * tra cứu để URL MỚI dùng chung role/guard đó (xem đoạn dựng `exact` map bên dưới). URL cũ không còn page.tsx thật nên
 * tự rơi về catch-all -> notFound() (route-registry coi là MIGRATED nên không hiện placeholder "đang chuyển đổi").
 */
export const RENAMED_ROUTES: Readonly<Record<string, string>> = {
  "/learning-path/online-course/manage": "/online-course/manage",
  "/flashcard/create-package": "/flashcard/package",
};

export interface UiRoleDecision {
  roles: readonly string[];
  /** Căn cứ + phạm vi của quyết định (hiển thị trong docs/ROUTE-STATUS.md). */
  note: string;
}

/**
 * Quyết định PHẠM VI GIAO DIỆN của chủ dự án cho route mà HSK cũ KHÔNG bọc PrivateRoute (nên không suy ra được quyền từ source cũ).
 * Đây KHÔNG phải xác nhận quyền từ backend và không thay đổi quyền API; chỉ cho biết frontend mới hiển thị route cho role nào.
 * Chỉ áp dụng cho route có guard "none" (test kiểm tra), role phải thuộc role được hỗ trợ. Muốn thêm route = cần quyết định mới ghi ở đây.
 * /instructor/instructor-support-tickets CỐ Ý không có ở đây: vẫn UNKNOWN (xem docs/M3B2-WELCOME.md mục khảo sát).
 */
export const UI_ROLE_DECISIONS: Readonly<Record<string, UiRoleDecision>> = {
  "/instructor/welcome": {
    roles: [ROLES.TEACHER, ROLES.MENTOR],
    note: "Quyết định chủ dự án (M3B.2, 2026-10-24): giao diện chỉ TEACHER, MENTOR; HSK cũ không có PrivateRoute; chưa phải xác nhận quyền từ backend",
  },
  "/instructor/instructor-notifications": {
    roles: [ROLES.TEACHER, ROLES.MENTOR],
    note: "Quyết định chủ dự án (M3B.2, 2026-10-24): giao diện chỉ TEACHER, MENTOR (Admin dùng /admin/settings/notifications); HSK cũ không có PrivateRoute; chưa phải xác nhận quyền từ backend",
  },
};

/**
 * Vai trò được THÊM vào route đã có PrivateRoute ở HSK cũ (HSK cũ giữ nguyên, không sửa dữ kiện trong old-routes.generated.ts).
 * Chấm bài ở backend chung chỉ cho ROLE_ADMIN (AssessmentGradingManagementController) nên Admin được vào luồng lớp → buổi → nộp bài → chấm bài
 * (quyết định chủ dự án, 2026-11-14). Muốn cho vai trò khác chấm bài: thêm vai trò vào đây VÀ mở quyền ở backend. Chỉ là rào chắn giao diện.
 */
export const UI_ROLE_GRANTS: Readonly<Record<string, UiRoleDecision>> = Object.fromEntries(
  ["/instructor/list-class", "/instructor/list-class/list-lesson", "/instructor/list-class/submissions", "/instructor/list-class/grading"].map((path) => [
    path,
    { roles: [ROLES.ADMIN], note: "Quyết định chủ dự án (2026-11-14): thêm ADMIN vào luồng chấm bài vì backend chung chỉ cho ROLE_ADMIN chấm bài" } satisfies UiRoleDecision,
  ]),
);

export interface ManagementRoute {
  path: string;
  status: RouteStatus;
  /** Role app mới ENFORCE ở tầng route = role HSK cũ cho phép ∩ role được hỗ trợ. Rỗng nếu không phục vụ. */
  allowedRoles: readonly string[];
  oldComponent: string;
  oldGuard: OldRouteFact["guard"];
  oldRoles: readonly string[];
  /** Lý do ra trạng thái này (hiển thị trong docs/ROUTE-STATUS.md). */
  reason: string;
  /** Nguồn của allowedRoles: PrivateRoute của HSK cũ, hay quyết định giao diện của chủ dự án (UI_ROLE_DECISIONS). */
  roleSource: "private-route" | "owner-decision" | "none";
}

const shortRole = (r: string) => r.replace("ROLE_", "");

export function classifyRoute(
  fact: OldRouteFact,
  migrated: readonly string[] = MIGRATED_ROUTES,
  decisions: Readonly<Record<string, UiRoleDecision>> = UI_ROLE_DECISIONS,
  grants: Readonly<Record<string, UiRoleDecision>> = UI_ROLE_GRANTS,
): ManagementRoute {
  const base = { path: fact.path, oldComponent: fact.component, oldGuard: fact.guard, oldRoles: fact.roles };
  if (fact.underConstruction) {
    return { ...base, status: "OUT_OF_SCOPE", allowedRoles: [], roleSource: "none", reason: "HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật)" };
  }
  if (fact.guard === "none") {
    // Không có PrivateRoute => không suy ra quyền từ source cũ. Chỉ khi chủ dự án đã quyết định phạm vi giao diện mới được phục vụ.
    const decision = decisions[fact.path];
    const roles = decision ? decision.roles.filter((r) => MANAGEMENT_SUPPORTED_ROLES.includes(r)) : [];
    if (decision && roles.length > 0) {
      const status: RouteStatus = migrated.includes(fact.path) ? "MIGRATED" : "NOT_MIGRATED";
      return { ...base, status, allowedRoles: roles, roleSource: "owner-decision", reason: decision.note };
    }
    return { ...base, status: "UNKNOWN", allowedRoles: [], roleSource: "none", reason: "HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập" };
  }
  if (fact.guard !== "roles") {
    return { ...base, status: "UNKNOWN", allowedRoles: [], roleSource: "none", reason: "HSK cũ chỉ yêu cầu đăng nhập, không xác lập role" };
  }
  const allowedRoles = fact.roles.filter((r) => MANAGEMENT_SUPPORTED_ROLES.includes(r));
  const grant = grants[fact.path];
  const granted = (grant?.roles ?? []).filter((r) => MANAGEMENT_SUPPORTED_ROLES.includes(r) && !allowedRoles.includes(r));
  if (allowedRoles.length === 0 && granted.length === 0) {
    return { ...base, status: "UNKNOWN", allowedRoles: [], roleSource: "none", reason: `Chỉ dành cho role chưa xác minh (${fact.roles.map(shortRole).join(", ")})` };
  }
  const status: RouteStatus = migrated.includes(fact.path) ? "MIGRATED" : "NOT_MIGRATED";
  const reason = `PrivateRoute: ${fact.roles.map(shortRole).join(", ")}`;
  if (granted.length > 0) return { ...base, status, allowedRoles: [...allowedRoles, ...granted], roleSource: "owner-decision", reason: `${reason}; thêm ${granted.map(shortRole).join(", ")}: ${grant.note}` };
  return { ...base, status, allowedRoles, roleSource: "private-route", reason };
}

export const MANAGEMENT_ROUTES: readonly ManagementRoute[] = OLD_MANAGEMENT_ROUTES.map((fact) => classifyRoute(fact));

// ---- tra cứu theo URL ------------------------------------------------------------------------------------------------------------

const exact = new Map<string, ManagementRoute>();
const patterns: { segments: string[]; paramCount: number; route: ManagementRoute }[] = [];
for (const route of MANAGEMENT_ROUTES) {
  if (route.path.includes(":")) {
    const segments = route.path.split("/").filter(Boolean);
    patterns.push({ segments, paramCount: segments.filter((s) => s.startsWith(":")).length, route });
  } else {
    exact.set(route.path, route);
  }
}
for (const [oldPath, newPath] of Object.entries(RENAMED_ROUTES)) {
  const route = exact.get(oldPath);
  if (route) exact.set(newPath, route);
}
// Mẫu ít tham số hơn (cụ thể hơn) được thử trước.
patterns.sort((a, b) => a.paramCount - b.paramCount);

function normalize(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** Route đã đăng ký khớp URL (khớp chính xác hoặc mẫu có ":tham-số" khác rỗng). Không phân biệt trạng thái. Không có = null. */
export function findRoute(pathname: string): ManagementRoute | null {
  const path = normalize(pathname);
  const hit = exact.get(path);
  if (hit) return hit;
  const parts = path.split("/").filter(Boolean);
  for (const { segments, route } of patterns) {
    if (segments.length === parts.length && segments.every((s, i) => (s.startsWith(":") ? parts[i].length > 0 : s === parts[i]))) return route;
  }
  return null;
}

/** Route app mới PHỤC VỤ (trang thật hoặc trang "đang chuyển đổi"); UNKNOWN/OUT_OF_SCOPE/chưa đăng ký => null => 404. */
export function getServedRoute(pathname: string): ManagementRoute | null {
  const route = findRoute(pathname);
  return route && (route.status === "MIGRATED" || route.status === "NOT_MIGRATED") ? route : null;
}

export type NavTargetStatus = RouteStatus | "EXTERNAL" | "UNREGISTERED";

/** Trạng thái đích của một mục menu (đường dẫn nội bộ hoặc URL ngoài). */
export function getNavTargetStatus(href: string): NavTargetStatus {
  if (/^https?:\/\//i.test(href)) return "EXTERNAL";
  return findRoute(href)?.status ?? "UNREGISTERED";
}

/** Route đã chuyển đầu tiên mà một trong các role này vào được (đích "quay về màn hình quản lý" của trang đang chuyển đổi). */
export function firstMigratedRouteFor(roles: readonly string[] | undefined | null): ManagementRoute | null {
  if (!roles) return null;
  return MANAGEMENT_ROUTES.find((r) => r.status === "MIGRATED" && r.allowedRoles.some((role) => roles.includes(role))) ?? null;
}

// ---- 49 route UNKNOWN: nhóm KHÔNG chồng lấn (mỗi route đúng một nhóm; tổng các nhóm = số route UNKNOWN) --------------------------------

export type UnknownGroup = "NO_PRIVATE_ROUTE" | "ONLY_UNVERIFIED_ROLES" | "LOGIN_ONLY";

export const UNKNOWN_GROUP_LABEL: Readonly<Record<UnknownGroup, string>> = {
  NO_PRIVATE_ROUTE: "HSK cũ không bọc PrivateRoute và chưa có quyết định của chủ dự án",
  ONLY_UNVERIFIED_ROLES: "PrivateRoute chỉ cho role chưa xác minh (Teacher-manager, Collaborator)",
  LOGIN_ONLY: "PrivateRoute chỉ yêu cầu đăng nhập, không xác lập role",
};

/** Nhóm của một route UNKNOWN; route trạng thái khác => null. */
export function unknownGroupOf(route: ManagementRoute): UnknownGroup | null {
  if (route.status !== "UNKNOWN") return null;
  if (route.oldGuard === "none") return "NO_PRIVATE_ROUTE";
  if (route.oldGuard === "roles") return "ONLY_UNVERIFIED_ROLES";
  return "LOGIN_ONLY";
}

export function groupUnknownRoutes(routes: readonly ManagementRoute[] = MANAGEMENT_ROUTES): Record<UnknownGroup, ManagementRoute[]> {
  const groups: Record<UnknownGroup, ManagementRoute[]> = { NO_PRIVATE_ROUTE: [], ONLY_UNVERIFIED_ROLES: [], LOGIN_ONLY: [] };
  for (const route of routes) {
    const group = unknownGroupOf(route);
    if (group) groups[group].push(route);
  }
  return groups;
}
