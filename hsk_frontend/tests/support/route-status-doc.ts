import { MANAGEMENT_ROUTES, UNKNOWN_GROUP_LABEL, groupUnknownRoutes, type ManagementRoute, type UnknownGroup } from "@/lib/management/route-registry";
import { OLD_ROUTE_COUNTS, OLD_ROUTES_SOURCE } from "@/lib/management/old-routes.generated";

const roles = (list: readonly string[]) => (list.length ? list.map((r) => r.replace("ROLE_", "")).join(", ") : "—");
const source = { "private-route": "PrivateRoute HSK cũ", "owner-decision": "Quyết định chủ dự án (giao diện)", none: "—" } as const;
const row = (r: ManagementRoute) =>
  `| \`${r.path}\` | ${r.oldComponent} | ${r.oldGuard} | ${roles(r.oldRoles)} | **${r.status}** | ${roles(r.allowedRoles)} | ${source[r.roleSource]} | ${r.reason} |`;

/**
 * Sinh docs/ROUTE-STATUS.md từ route-registry (tests/route-registry.test.ts so file đã commit với kết quả này; đặt UPDATE_ROUTE_DOCS=1 để ghi lại).
 * Không có danh sách thứ hai: tài liệu luôn là hình chiếu của registry.
 */
export function renderRouteStatusDoc(): string {
  const count = (s: ManagementRoute["status"]) => MANAGEMENT_ROUTES.filter((r) => r.status === s).length;
  const section = (title: string, status: ManagementRoute["status"], note: string) => {
    const rows = MANAGEMENT_ROUTES.filter((r) => r.status === status);
    return `## ${title} (${rows.length})\n\n${note ? `${note}\n\n` : ""}| Route | Component HSK cũ | Guard cũ | Role cũ (nguyên văn) | Trạng thái | Role app mới enforce | Nguồn quyền | Căn cứ |\n|---|---|---|---|---|---|---|---|\n${rows.map(row).join("\n")}\n`;
  };
  const c = OLD_ROUTE_COUNTS;
  const groups = groupUnknownRoutes();
  const groupKeys = Object.keys(UNKNOWN_GROUP_LABEL) as UnknownGroup[];
  const groupTotal = groupKeys.reduce((sum, k) => sum + groups[k].length, 0);
  const groupRows = groupKeys.map((k) => `| ${UNKNOWN_GROUP_LABEL[k]} | ${groups[k].length} |`).join("\n");
  return `# Trạng thái route khu quản lý

FILE SINH TỰ ĐỘNG từ \`src/lib/management/route-registry.ts\` (test \`tests/route-registry.test.ts\` kiểm tra khớp; \`UPDATE_ROUTE_DOCS=1 npm test\` để ghi lại). Không sửa tay.
Dữ kiện HSK cũ: ${OLD_ROUTES_SOURCE} (xem \`docs/OLD-ROUTE-SURVEY.md\`).

**Đối chiếu số lượng:** ${c.declared} khai báo trong router cũ = ${c.uniquePaths} đường dẫn duy nhất + ${c.duplicateDeclarations} khai báo trùng; ${c.uniquePaths} = ${c.management} route khu quản lý (bảng dưới) + ${c.outOfScope} route học viên/công khai (ngoài phạm vi, trả 404).

| Trạng thái | Số route | Ý nghĩa |
|---|---|---|
| MIGRATED | ${count("MIGRATED")} | Đã có trang thật |
| NOT_MIGRATED | ${count("NOT_MIGRATED")} | Role xác định được (PrivateRoute HSK cũ, hoặc quyết định giao diện của chủ dự án); hiện trang "Chức năng đang được chuyển đổi" ở đúng URL cũ |
| UNKNOWN | ${count("UNKNOWN")} | Không đủ bằng chứng để phục vụ (không có PrivateRoute và chưa có quyết định, hoặc chỉ dành cho role chưa xác minh); trả 404 |
| OUT_OF_SCOPE | ${count("OUT_OF_SCOPE")} | HSK cũ chỉ hiện "đang xây dựng" hoặc chức năng đã gỡ; trả 404 |

**Các route UNKNOWN chia thành nhóm không chồng lấn** (mỗi route đúng một nhóm, tổng = ${count("UNKNOWN")}; không đổi UNKNOWN để cho số liệu khớp):

| Nhóm | Số route |
|---|---|
${groupRows}
| **Tổng** | **${groupTotal}** |

Role app mới hỗ trợ: ADMIN, TEACHER, MENTOR. "Role app mới enforce" = role HSK cũ cho phép ∩ role hỗ trợ; Teacher-manager và Collaborator chưa xác minh nên
không được cấp dù HSK cũ có liệt kê. "Quyết định chủ dự án (giao diện)" chỉ là phạm vi hiển thị của frontend mới, **không phải xác nhận quyền từ backend**.

${section("MIGRATED", "MIGRATED", "")}
${section("NOT_MIGRATED", "NOT_MIGRATED", "Phục vụ trang placeholder dùng chung. Khi chuyển xong: tạo \`page.tsx\` ở đúng URL + thêm vào \`MIGRATED_ROUTES\`.")}
${section("UNKNOWN", "UNKNOWN", "KHÔNG được phục vụ. Cần bằng chứng/quyết định của chủ dự án (\`UI_ROLE_DECISIONS\`) để chuyển sang NOT_MIGRATED.")}
${section("OUT_OF_SCOPE", "OUT_OF_SCOPE", "KHÔNG được phục vụ.")}`;
}
