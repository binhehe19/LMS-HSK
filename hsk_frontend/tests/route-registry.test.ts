import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAdminNav } from "@/components/management/admin-nav";
import { buildInstructorNav } from "@/components/management/instructor-nav";
import { MANAGEMENT_SUPPORTED_ROLES, ROLES } from "@/lib/auth/roles";
import { OLD_OUT_OF_SCOPE_PATHS, OLD_ROUTE_COUNTS, type OldRouteFact } from "@/lib/management/old-routes.generated";
import {
  MANAGEMENT_ROUTES,
  MIGRATED_ROUTES,
  RENAMED_ROUTES,
  UI_ROLE_DECISIONS,
  UI_ROLE_GRANTS,
  UNKNOWN_GROUP_LABEL,
  classifyRoute,
  findRoute,
  firstMigratedRouteFor,
  getNavTargetStatus,
  getServedRoute,
  groupUnknownRoutes,
  unknownGroupOf,
} from "@/lib/management/route-registry";
import { renderRouteStatusDoc } from "./support/route-status-doc";

const fact = (over: Partial<OldRouteFact>): OldRouteFact => ({ path: "/x/manage", component: "X", line: 1, guard: "roles", roles: [ROLES.ADMIN], underConstruction: false, ...over });

describe("classifyRoute (quy tắc trạng thái)", () => {
  it("PrivateRoute theo role có role được hỗ trợ => NOT_MIGRATED, chỉ enforce phần giao với role được hỗ trợ", () => {
    const r = classifyRoute(fact({ roles: [ROLES.TEACHER, ROLES.MENTOR, ROLES.ADMIN, ROLES.TEACHER_MANAGER, ROLES.COLLABORATOR] }), []);
    expect(r.status).toBe("NOT_MIGRATED");
    expect(r.allowedRoles).toEqual([ROLES.TEACHER, ROLES.MENTOR, ROLES.ADMIN]);
  });

  it("có trong danh sách đã chuyển => MIGRATED", () => {
    expect(classifyRoute(fact({}), ["/x/manage"]).status).toBe("MIGRATED");
  });

  it("KHÔNG có PrivateRoute => UNKNOWN (không suy ra 'cho mọi role'), không có role nào được enforce", () => {
    const r = classifyRoute(fact({ guard: "none", roles: [] }), ["/x/manage"]);
    expect(r.status).toBe("UNKNOWN");
    expect(r.allowedRoles).toEqual([]);
  });

  it("PrivateRoute chỉ yêu cầu đăng nhập => UNKNOWN", () => {
    expect(classifyRoute(fact({ guard: "authenticated", roles: [] }), []).status).toBe("UNKNOWN");
  });

  it.each([[[ROLES.TEACHER_MANAGER]], [[ROLES.COLLABORATOR]], [[ROLES.TEACHER_MANAGER, ROLES.COLLABORATOR]]])("%j chỉ dành cho role chưa xác minh => UNKNOWN, kể cả khi đã nằm trong danh sách chuyển", (roles) => {
    const r = classifyRoute(fact({ roles }), ["/x/manage"]);
    expect(r.status).toBe("UNKNOWN");
    expect(r.allowedRoles).toEqual([]);
  });

  it("HSK cũ tự hiện UnderConstruction => OUT_OF_SCOPE", () => {
    expect(classifyRoute(fact({ underConstruction: true }), []).status).toBe("OUT_OF_SCOPE");
  });
});

describe("findRoute / getServedRoute (khớp URL)", () => {
  it.each([
    ["/admin/class-management", "/admin/class-management"],
    ["/admin/class-management/", "/admin/class-management"],
    ["/admin/class-management?classId=1", "/admin/class-management"],
    ["/admin/class-management#x", "/admin/class-management"],
    ["/hanzi/edit/123", "/hanzi/edit/:id"],
    ["/sets/abc/edit", "/sets/:id/edit"],
  ])("%s => %s", (url, expected) => {
    expect(findRoute(url)?.path).toBe(expected);
  });

  it.each([
    "/", "/admin", "/admin/", "/admin/unknown", "/admin/class-management/extra/segment", "/Admin/class-management", "/hanzi/edit", "/hanzi/edit/",
    "/hanzi/edit/1/2", "/instructor", "/random-url", "//admin/class-management", "/admin/class-management%2F", "/../admin/dashboard",
  ])("URL không hợp lệ %s => không khớp", (url) => {
    expect(findRoute(url)).toBeNull();
    expect(getServedRoute(url)).toBeNull();
  });

  it("chỉ MIGRATED và NOT_MIGRATED được phục vụ; UNKNOWN/OUT_OF_SCOPE (có đăng ký) không được phục vụ", () => {
    expect(getServedRoute("/admin/class-management")?.status).toBe("MIGRATED");
    expect(getServedRoute("/admin/profile")?.status).toBe("NOT_MIGRATED"); // route hợp lệ của HSK cũ chưa chuyển (không có trong menu)
    expect(findRoute("/instructor/instructor-support-tickets")?.status).toBe("UNKNOWN");
    expect(getServedRoute("/instructor/instructor-support-tickets")).toBeNull();
    expect(findRoute("/admin/courses")?.status).toBe("OUT_OF_SCOPE");
    expect(getServedRoute("/admin/courses")).toBeNull();
    expect(findRoute("/teacher-manager/dashboard")?.status).toBe("UNKNOWN");
    expect(getServedRoute("/teacher-manager/dashboard")).toBeNull();
  });
});

describe("quyền theo từng route đã xác minh từ HSK cũ (router.link.tsx)", () => {
  const roles = (url: string) => [...(findRoute(url)?.allowedRoles ?? [])].sort();
  const sorted = (...r: string[]) => [...r].sort();

  it("/admin/* chỉ ADMIN", () => {
    for (const r of MANAGEMENT_ROUTES.filter((x) => x.path.startsWith("/admin/") && x.status === "NOT_MIGRATED")) {
      expect(r.allowedRoles, r.path).toEqual([ROLES.ADMIN]);
    }
    expect(roles("/admin/class-management")).toEqual([ROLES.ADMIN]);
  });

  it("luồng chấm bài /instructor/list-class(+list-lesson, submissions, grading): TEACHER, MENTOR và ADMIN (quyết định chủ dự án vì backend chỉ cho Admin chấm)", () => {
    for (const url of ["/instructor/list-class", "/instructor/list-class/list-lesson", "/instructor/list-class/submissions", "/instructor/list-class/grading"]) {
      expect(roles(url), url).toEqual(sorted(ROLES.ADMIN, ROLES.TEACHER, ROLES.MENTOR));
      expect(findRoute(url)?.roleSource, url).toBe("owner-decision");
    }
  });

  it("các route còn lại của /instructor/list-class chỉ TEACHER và MENTOR (Admin KHÔNG được vào)", () => {
    for (const url of ["/instructor/list-class/lesson-detail", "/instructor/list-class/learning-analysis", "/instructor/list-class/learning-analysis/detail"]) {
      expect(roles(url), url).toEqual(sorted(ROLES.TEACHER, ROLES.MENTOR));
    }
  });

  it("classifyRoute: vai trò bổ sung chỉ thêm vào route có PrivateRoute, không trùng, không vượt role được hỗ trợ", () => {
    const base = fact({ path: "/x/grading", roles: [ROLES.TEACHER] });
    const grant = { "/x/grading": { roles: [ROLES.ADMIN, ROLES.TEACHER, ROLES.COLLABORATOR], note: "lý do" } };
    const r = classifyRoute(base, ["/x/grading"], {}, grant);
    expect([...r.allowedRoles].sort()).toEqual(sorted(ROLES.ADMIN, ROLES.TEACHER));
    expect(r.reason).toContain("lý do");
    expect(classifyRoute(base, ["/x/grading"], {}, {}).roleSource).toBe("private-route");
  });

  it("/instructor/instructor-tickets: HSK cũ TEACHER, MENTOR, COLLABORATOR → app mới chỉ TEACHER, MENTOR (Admin không có; Collaborator chưa xác minh)", () => {
    expect(roles("/instructor/instructor-tickets")).toEqual(sorted(ROLES.TEACHER, ROLES.MENTOR));
    expect(findRoute("/instructor/instructor-tickets")?.oldRoles).toContain(ROLES.COLLABORATOR);
  });

  it("route dùng chung có guard rõ ràng: kho lưu trữ và các trang */manage cho ADMIN + TEACHER + MENTOR", () => {
    for (const url of ["/instructor/manage-storage", "/hanzi/manage", "/quiz/manage", "/flashcard/package", "/vocab-set/manage", "/grammar/manage", "/learning-path/syllabus/manage"]) {
      expect(roles(url), url).toEqual(sorted(ROLES.ADMIN, ROLES.TEACHER, ROLES.MENTOR));
    }
  });

  it("khóa học trực tuyến / tài liệu học tập: HSK cũ ADMIN + TEACHER_MANAGER → app mới chỉ ADMIN", () => {
    for (const url of ["/learning-path/online-course/manage", "/learning-path/online-course/leads", "/learning-path/lesson-materials/manage"]) {
      expect(roles(url), url).toEqual([ROLES.ADMIN]);
    }
  });

  it("3 route menu KHÔNG có PrivateRoute ở HSK cũ: welcome và thông báo của tôi có quyết định giao diện (TEACHER, MENTOR); yêu cầu hỗ trợ vẫn UNKNOWN", () => {
    for (const url of ["/instructor/welcome", "/instructor/instructor-notifications", "/instructor/instructor-support-tickets"]) {
      expect(findRoute(url)?.oldGuard, url).toBe("none");
    }
    for (const url of ["/instructor/welcome", "/instructor/instructor-notifications"]) {
      const r = findRoute(url);
      expect(r?.roleSource, url).toBe("owner-decision");
      expect([...(r?.allowedRoles ?? [])].sort(), url).toEqual(sorted(ROLES.TEACHER, ROLES.MENTOR)); // KHÔNG Admin, Collaborator, Teacher-manager
    }
    expect(findRoute("/instructor/welcome")?.status).toBe("MIGRATED");
    expect(findRoute("/instructor/instructor-notifications")?.status).toBe("MIGRATED"); // M3B.3
    const support = findRoute("/instructor/instructor-support-tickets");
    expect(support?.status).toBe("UNKNOWN");
    expect(support?.allowedRoles).toEqual([]);
    expect(UI_ROLE_DECISIONS["/instructor/instructor-support-tickets"]).toBeUndefined();
  });

  it("quyết định giao diện chỉ áp dụng cho route không có PrivateRoute, role thuộc nhóm hỗ trợ; route không có quyết định thì vẫn UNKNOWN", () => {
    for (const [path, decision] of Object.entries(UI_ROLE_DECISIONS)) {
      expect(findRoute(path)?.oldGuard, path).toBe("none");
      for (const role of decision.roles) expect(MANAGEMENT_SUPPORTED_ROLES, path).toContain(role);
      expect(decision.roles, path).not.toContain(ROLES.ADMIN);
    }
    for (const r of MANAGEMENT_ROUTES.filter((x) => x.oldGuard === "none" && !x.oldComponent.includes("UnderConstruction"))) {
      if (!UI_ROLE_DECISIONS[r.path]) expect(r.status, r.path).toBe("UNKNOWN");
    }
    expect(findRoute("/instructor/instructor-dashboard")?.status).toBe("UNKNOWN");
  });

  it("classifyRoute: quyết định bị bỏ qua nếu route có PrivateRoute (PrivateRoute là nguồn duy nhất) hoặc role không được hỗ trợ", () => {
    const decisions = { "/x/manage": { roles: [ROLES.TEACHER], note: "n" }, "/y": { roles: [ROLES.COLLABORATOR], note: "n" } };
    expect(classifyRoute(fact({ guard: "none", roles: [] }), [], decisions).status).toBe("NOT_MIGRATED");
    expect(classifyRoute(fact({ guard: "none", roles: [] }), [], decisions).allowedRoles).toEqual([ROLES.TEACHER]);
    expect(classifyRoute(fact({ roles: [ROLES.ADMIN] }), [], decisions).allowedRoles).toEqual([ROLES.ADMIN]); // PrivateRoute thắng
    expect(classifyRoute(fact({ path: "/y", guard: "none", roles: [] }), [], decisions).status).toBe("UNKNOWN"); // Collaborator chưa được hỗ trợ
  });
});

describe("bất biến của registry", () => {
  it("path duy nhất", () => {
    const paths = MANAGEMENT_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("allowedRoles ⊂ role được hỗ trợ ∩ role HSK cũ cho phép; chỉ route được phục vụ mới có role", () => {
    for (const r of MANAGEMENT_ROUTES) {
      const served = r.status === "MIGRATED" || r.status === "NOT_MIGRATED";
      expect(r.allowedRoles.length > 0, r.path).toBe(served);
      for (const role of r.allowedRoles) {
        expect(MANAGEMENT_SUPPORTED_ROLES, r.path).toContain(role);
        // Quyền phải có nguồn: PrivateRoute của HSK cũ, hoặc quyết định giao diện của chủ dự án (chỉ cho route không có PrivateRoute).
        if (r.roleSource === "private-route") expect(r.oldRoles, r.path).toContain(role);
        else if (r.oldGuard === "roles") expect([...r.oldRoles, ...(UI_ROLE_GRANTS[r.path]?.roles ?? [])], r.path).toContain(role);
        else expect(UI_ROLE_DECISIONS[r.path]?.roles, r.path).toContain(role);
      }
    }
  });

  it("route không có guard ở HSK cũ chỉ được phục vụ khi có quyết định của chủ dự án; route chỉ dành cho role chưa xác minh KHÔNG BAO GIỜ được phục vụ", () => {
    for (const r of MANAGEMENT_ROUTES) {
      if (r.oldGuard !== "roles" && !UI_ROLE_DECISIONS[r.path]) expect(getServedRoute(r.path), r.path).toBeNull();
      if (r.oldRoles.length && r.oldRoles.every((x) => !MANAGEMENT_SUPPORTED_ROLES.includes(x))) expect(getServedRoute(r.path), r.path).toBeNull();
    }
  });

  it("Teacher-manager và Collaborator không nằm trong role được hỗ trợ", () => {
    expect(MANAGEMENT_SUPPORTED_ROLES).not.toContain(ROLES.TEACHER_MANAGER);
    expect(MANAGEMENT_SUPPORTED_ROLES).not.toContain(ROLES.COLLABORATOR);
  });

  it("firstMigratedRouteFor: Admin → Tổng quan (/admin/dashboard, route đầu tiên trong router cũ); Teacher/Mentor → Tổng quan; role lạ thì chưa có", () => {
    expect(firstMigratedRouteFor([ROLES.ADMIN])?.path).toBe("/admin/dashboard");
    expect(firstMigratedRouteFor([ROLES.TEACHER])?.path).toBe("/instructor/welcome");
    expect(firstMigratedRouteFor([ROLES.MENTOR])?.path).toBe("/instructor/welcome");
    expect(firstMigratedRouteFor([ROLES.TEACHER_MANAGER])).toBeNull();
    expect(firstMigratedRouteFor(undefined)).toBeNull();
  });
});

/** Mọi page.tsx dưới src/app, quy về URL (nhóm "(x)" không đóng góp segment; segment động "[id]" của Next ghi thành ":id" như registry/HSK cũ). */
function appPages(dir = path.resolve(__dirname, "../src/app"), prefix = ""): { url: string; file: string }[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    const segment = /^\[\.\.\./.test(entry.name) ? entry.name : entry.name.replace(/^\[(.+)\]$/, ":$1");
    if (entry.isDirectory()) return appPages(full, prefix + (/^\(.*\)$/.test(entry.name) ? "" : `/${segment}`));
    return entry.name === "page.tsx" ? [{ url: prefix || "/", file: path.relative(path.resolve(__dirname, ".."), full).replace(/\\/g, "/") }] : [];
  });
}

describe("registry khớp với App Router thực tế", () => {
  const pages = appPages();
  const placeholderPage = pages.filter((p) => p.url.includes("[...slug]"));
  // Trang ĐỘC LẬP ngoài khu quản lý (không phải route HSK cũ, không cần đăng nhập): /demo — chọn tài khoản giả lập của chế độ xem trước cục bộ;
  // /dev-auth/callback — nhận token đăng nhập khi `next dev` (production trả 404).
  // Student frontend previews are a separate App Router group, outside the management registry.
  const STUDENT_PAGES = ["student-dashboard", "student-courses", "student-wishlist", "student-quiz", "student-tickets", "student-profile"].map((name) => `/student/${name}`);
  // Màn Từ điển học viên giữ URL HSK cũ /vocabulary và /vocabulary/:id (nhóm (student), cùng guard đăng nhập như các màn học sinh khác).
  const STUDENT_DICTIONARY_PAGES: Record<string, string> = { "/vocabulary": "src/app/(student)/vocabulary/page.tsx", "/vocabulary/:id": "src/app/(student)/vocabulary/[id]/page.tsx" };
  const STANDALONE_PAGES = ["/demo", "/dev-auth/callback", ...STUDENT_PAGES, ...Object.keys(STUDENT_DICTIONARY_PAGES)];
  const realPages = pages.filter((p) => !p.url.includes("[...slug]") && !STANDALONE_PAGES.includes(p.url));

  it("có đúng MỘT trang động phục vụ placeholder, nằm trong nhóm (management)", () => {
    expect(placeholderPage.map((p) => p.file)).toEqual(["src/app/(management)/[...slug]/page.tsx"]);
  });

  it("trang độc lập gồm /demo, /dev-auth/callback, sáu màn học sinh và hai màn Từ điển học viên, ngoài nhóm quản lý", () => {
    expect(pages.filter((p) => STANDALONE_PAGES.includes(p.url)).map((p) => p.file).sort()).toEqual(["src/app/demo/page.tsx", "src/app/dev-auth/callback/page.tsx", ...STUDENT_PAGES.map((url) => `src/app/(student)${url}/page.tsx`), ...Object.values(STUDENT_DICTIONARY_PAGES)].sort());
  });

  it("tập trang thật (page.tsx) chính là MIGRATED_ROUTES, trừ các route đã RENAMED_ROUTES sang URL mới — không thiếu, không thừa", () => {
    const servedUrls = MIGRATED_ROUTES.map((p) => RENAMED_ROUTES[p] ?? p);
    expect(realPages.map((p) => p.url).sort()).toEqual([...servedUrls].sort());
  });

  it("mọi trang thật nằm trong nhóm (management) (được layout guard theo route bao phủ)", () => {
    for (const p of realPages) expect(p.file, p.url).toMatch(/^src\/app\/\(management\)\//);
  });

  it("mọi route MIGRATED được registry phân loại MIGRATED (không bị UNKNOWN/NOT_MIGRATED do sai guard)", () => {
    for (const url of MIGRATED_ROUTES) expect(findRoute(url)?.status, url).toBe("MIGRATED");
  });

  it("layout nhóm (management) tồn tại và dùng ManagementRouteGate; không còn layout guard theo tiền tố /admin, /instructor", () => {
    const root = path.resolve(__dirname, "../src/app");
    expect(fs.readFileSync(path.join(root, "(management)/layout.tsx"), "utf8")).toContain("ManagementRouteGate");
    expect(fs.existsSync(path.join(root, "admin"))).toBe(false);
    expect(fs.existsSync(path.join(root, "instructor"))).toBe(false);
  });
});

describe("navigation khớp với registry", () => {
  const admin = buildAdminNav("https://auth.example/admin/users");
  const teacher = buildInstructorNav();
  const count = (items: { href: string }[]) =>
    items.reduce<Record<string, number>>((acc, m) => {
      const s = getNavTargetStatus(m.href);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});

  it("mọi mục menu trỏ tới URL đã đăng ký hoặc liên kết ngoài (không còn đích chưa phân loại)", () => {
    for (const m of [...admin, ...teacher]) expect(getNavTargetStatus(m.href), `${m.title} → ${m.href}`).not.toBe("UNREGISTERED");
  });

  // Sau M5: KHÔNG còn mục menu nào là placeholder (NOT_MIGRATED); chỉ còn UNKNOWN "Yêu cầu hỗ trợ" (HSK cũ không PrivateRoute, chờ D-UI-1) và liên kết ngoài.
  it("Admin: 15 mục = 13 MIGRATED (có Chấm bài) + 1 UNKNOWN (Yêu cầu hỗ trợ) + 1 EXTERNAL (Quản lý người dùng) — không mục nào NOT_MIGRATED", () => {
    expect(count(admin)).toEqual({ MIGRATED: 13, UNKNOWN: 1, EXTERNAL: 1 });
    expect(admin.filter((m) => getNavTargetStatus(m.href) === "UNKNOWN").map((m) => m.title)).toEqual(["Yêu cầu hỗ trợ"]);
    expect(admin.filter((m) => getNavTargetStatus(m.href) === "EXTERNAL").map((m) => m.title)).toEqual(["Quản lý người dùng"]);
  });

  it("Giảng viên: 14 mục = 13 MIGRATED + 1 UNKNOWN (Yêu cầu hỗ trợ) — không mục nào NOT_MIGRATED", () => {
    expect(count(teacher)).toEqual({ MIGRATED: 13, UNKNOWN: 1 });
    expect(teacher.filter((m) => getNavTargetStatus(m.href) === "UNKNOWN").map((m) => m.title)).toEqual(["Yêu cầu hỗ trợ"]);
    expect(teacher.filter((m) => getNavTargetStatus(m.href) === "MIGRATED").map((m) => m.title)).toEqual([
      "Tổng quan",
      "Thông báo của tôi",
      "Quản lý Luyện viết (Hán tự)",
      "Quản lý Luyện Phát âm",
      "Quản lý Thẻ ghi nhớ",
      "Quản lý Ngữ pháp",
      "Quản lý Từ vựng",
      "Quản lý Bài tập",
      "Quản lý Từ điển",
      "Quản lý Giáo trình",
      "Quản lý lớp học",
      "Quản lý Kho lưu trữ Đa phương tiện",
      "Phân công công việc",
    ]);
  });

  it("mục menu được phục vụ phải vào được bằng role sở hữu menu đó (Admin→ADMIN, Giảng viên→TEACHER/MENTOR)", () => {
    for (const m of admin) {
      const r = getServedRoute(m.href);
      if (r) expect(r.allowedRoles, m.title).toContain(ROLES.ADMIN);
    }
    for (const m of teacher) {
      const r = getServedRoute(m.href);
      if (r) expect(r.allowedRoles.some((x) => x === ROLES.TEACHER || x === ROLES.MENTOR), m.title).toBe(true);
    }
  });
});

describe("đối chiếu số lượng route HSK cũ", () => {
  it("khai báo = đường dẫn duy nhất + khai báo trùng; đường dẫn duy nhất = khu quản lý + ngoài phạm vi", () => {
    const c = OLD_ROUTE_COUNTS;
    expect(c.declared).toBe(c.uniquePaths + c.duplicateDeclarations);
    expect(c.uniquePaths).toBe(c.management + c.outOfScope);
  });

  it("registry có đúng số route khu quản lý, mỗi đường dẫn đúng một lần; tập ngoài phạm vi tách rời registry và đủ số lượng", () => {
    expect(MANAGEMENT_ROUTES).toHaveLength(OLD_ROUTE_COUNTS.management);
    expect(OLD_OUT_OF_SCOPE_PATHS).toHaveLength(OLD_ROUTE_COUNTS.outOfScope);
    expect(new Set(OLD_OUT_OF_SCOPE_PATHS).size).toBe(OLD_OUT_OF_SCOPE_PATHS.length);
    const inRegistry = new Set(MANAGEMENT_ROUTES.map((r) => r.path));
    expect(OLD_OUT_OF_SCOPE_PATHS.filter((p) => inRegistry.has(p))).toEqual([]);
  });

  it("route ngoài phạm vi (học viên/công khai) và route đặc biệt của HSK cũ (\"/\", \"*\") KHÔNG được phục vụ (404)", () => {
    for (const p of OLD_OUT_OF_SCOPE_PATHS) expect(getServedRoute(p.replace(/:[A-Za-z]+/g, "1")), p).toBeNull();
    expect(OLD_OUT_OF_SCOPE_PATHS).toContain("*");
    expect(OLD_OUT_OF_SCOPE_PATHS).toContain("/");
  });

  it("các route UNKNOWN chia thành nhóm KHÔNG chồng lấn, tổng các nhóm = số route UNKNOWN (không chỉnh trạng thái để số liệu khớp)", () => {
    const unknown = MANAGEMENT_ROUTES.filter((r) => r.status === "UNKNOWN");
    const groups = groupUnknownRoutes();
    expect(Object.keys(groups).sort()).toEqual(Object.keys(UNKNOWN_GROUP_LABEL).sort());
    const all = Object.values(groups).flat();
    expect(all).toHaveLength(unknown.length);
    expect(new Set(all.map((r) => r.path)).size).toBe(all.length); // không route nào thuộc hai nhóm
    for (const r of unknown) expect(unknownGroupOf(r), r.path).not.toBeNull();
    for (const r of MANAGEMENT_ROUTES.filter((x) => x.status !== "UNKNOWN")) expect(unknownGroupOf(r), r.path).toBeNull();
    // route menu cần khảo sát riêng nằm đúng nhóm "không có PrivateRoute"
    expect(groups.NO_PRIVATE_ROUTE.map((r) => r.path)).toEqual(expect.arrayContaining(["/instructor/instructor-support-tickets", "/instructor/instructor-settings"]));
  });

  it("khai báo trùng duy nhất là /instructor/instructor-profile (UNKNOWN, một dòng trong registry)", () => {
    expect(OLD_ROUTE_COUNTS.duplicateDeclarations).toBe(1);
    expect(MANAGEMENT_ROUTES.filter((r) => r.path === "/instructor/instructor-profile")).toHaveLength(1);
    expect(findRoute("/instructor/instructor-profile")?.status).toBe("UNKNOWN");
  });
});

describe("docs/ROUTE-STATUS.md là hình chiếu của registry", () => {
  const file = path.resolve(__dirname, "../docs/ROUTE-STATUS.md");
  it("khớp file đã commit (UPDATE_ROUTE_DOCS=1 npm test để ghi lại)", () => {
    const expected = `${renderRouteStatusDoc().trimEnd()}\n`;
    if (process.env.UPDATE_ROUTE_DOCS === "1") fs.writeFileSync(file, expected, "utf8");
    expect(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n")).toBe(expected);
  });
});
