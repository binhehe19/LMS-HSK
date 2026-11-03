import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManagementLayout from "@/app/(management)/layout";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { getCurrentUser } from "@/lib/api/auth-client";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";

// Guard THẬT của nhóm route (management): theo từng route, đọc registry. Không dùng RequireAuth rời.
let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
const getCurrentUserMock = vi.mocked(getCurrentUser);

beforeEach(() => {
  getCurrentUserMock.mockReset();
  window.sessionStorage.clear();
  Object.defineProperty(window, "location", { configurable: true, writable: true, value: { href: "http://localhost:3100/x", hostname: "localhost", assign: vi.fn() } });
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
});

type Outcome = "page-admin" | "page-instructor" | "forbidden";

async function visit(url: string, roles: string[]): Promise<Outcome> {
  pathname = url;
  getCurrentUserMock.mockResolvedValue({ ...adminUser, roles });
  render(
    <Provider store={makeStore()}>
      <ManagementLayout>
        <ManagementPageFrame>
          <div data-testid="protected">nội dung</div>
        </ManagementPageFrame>
      </ManagementLayout>
    </Provider>,
  );
  await waitFor(() => expect(screen.queryByTestId("protected") ?? screen.queryByTestId("auth-forbidden")).not.toBeNull());
  if (screen.queryByTestId("protected") === null) return "forbidden";
  // Khung (sidebar) do trang dựng; khu vực do gate chọn theo role: phụ đề thương hiệu khác nhau giữa hai sidebar.
  return document.querySelector(".brand-subtitle")?.textContent === "LMS · Admin" ? "page-admin" : "page-instructor";
}

const ALL_ROLES: Record<string, string[]> = {
  ADMIN: ["ROLE_ADMIN"],
  TEACHER: ["ROLE_TEACHER"],
  MENTOR: ["ROLE_MENTOR"],
  TEACHER_MANAGER: ["ROLE_TEACHER_MANAGER"],
  MANAGER: ["ROLE_MANAGER"],
  COLLABORATOR: ["ROLE_COLLABORATOR"],
  USER: ["ROLE_USER"],
  GUEST: ["ROLE_GUEST"],
  "không có role": [],
};

// Kỳ vọng theo registry/HSK cũ. Quy ước: chỉ ADMIN, TEACHER, MENTOR được vào route nào đó; mọi role khác luôn bị chặn.
const MATRIX: [url: string, allowed: string[]][] = [
  ["/admin/class-management", ["ADMIN"]], // MIGRATED, /admin/* = ADMIN
  ["/admin/dashboard", ["ADMIN"]], // MIGRATED (M5); /admin/* = ADMIN
  ["/admin/profile", ["ADMIN"]], // NOT_MIGRATED (placeholder)
  ["/instructor/list-class", ["TEACHER", "MENTOR"]], // Admin KHÔNG vào
  ["/instructor/list-class/grading", ["TEACHER", "MENTOR"]],
  ["/instructor/instructor-tickets", ["TEACHER", "MENTOR"]], // cũ còn COLLABORATOR → chưa xác minh → chặn
  ["/hanzi/manage", ["ADMIN", "TEACHER", "MENTOR"]], // dùng chung, guard liệt kê đủ
  ["/instructor/manage-storage", ["ADMIN", "TEACHER", "MENTOR"]], // dưới /instructor nhưng cũ cho phép ADMIN
  ["/online-course/manage", ["ADMIN"]], // cũ ADMIN + TEACHER_MANAGER
  ["/learning-path/syllabus/manage", ["ADMIN", "TEACHER", "MENTOR"]],
  ["/hanzi/edit/42", ["ADMIN", "TEACHER", "MENTOR"]], // route có tham số
  ["/instructor/welcome", ["TEACHER", "MENTOR"]], // HSK cũ không có PrivateRoute; quyết định giao diện của chủ dự án (M3B.2), KHÔNG Admin
  ["/instructor/instructor-notifications", ["TEACHER", "MENTOR"]], // như trên
];

describe.each(MATRIX)("%s", (url, allowed) => {
  it.each(Object.entries(ALL_ROLES))("%s", async (name, roles) => {
    const outcome = await visit(url, roles);
    expect(outcome !== "forbidden").toBe(allowed.includes(name));
  });
});

describe("sidebar theo ROLE (không theo tiền tố URL) trên route dùng chung", () => {
  it("/hanzi/manage: ADMIN → menu Admin; TEACHER và MENTOR → menu Giảng viên", async () => {
    expect(await visit("/hanzi/manage", ["ROLE_ADMIN"])).toBe("page-admin");
    expect(screen.getByText("LMS · Admin")).toBeInTheDocument();
  });

  it("TEACHER", async () => {
    expect(await visit("/hanzi/manage", ["ROLE_TEACHER"])).toBe("page-instructor");
    expect(screen.getByText("LMS · Quản lý")).toBeInTheDocument();
  });

  it("MENTOR", async () => {
    expect(await visit("/instructor/manage-storage", ["ROLE_MENTOR"])).toBe("page-instructor");
  });

  it("người có cả ADMIN và TEACHER: menu Admin ưu tiên (như InstructorSidebar cũ); /instructor/list-class vẫn do guard route quyết định", async () => {
    expect(await visit("/hanzi/manage", ["ROLE_TEACHER", "ROLE_ADMIN"])).toBe("page-admin");
  });

  it("ADMIN vào được /instructor/manage-storage nhưng KHÔNG vào được /instructor/instructor-tickets (không cấp quyền theo tiền tố /instructor)", async () => {
    expect(await visit("/instructor/manage-storage", ["ROLE_ADMIN"])).toBe("page-admin");
    document.body.innerHTML = "";
    expect(await visit("/instructor/instructor-tickets", ["ROLE_ADMIN"])).toBe("forbidden");
  });
});

describe("route không được phục vụ: không yêu cầu đăng nhập, không hiện khung, không gọi Auth", () => {
  it.each([
    "/instructor/instructor-support-tickets", // UNKNOWN: không có PrivateRoute ở HSK cũ và chưa có quyết định
    "/instructor/instructor-dashboard",
    "/teacher-manager/dashboard", // UNKNOWN: role chưa xác minh
    "/admin/courses", // OUT_OF_SCOPE
    "/admin/does-not-exist", // không đăng ký
    "/random",
  ])("%s", (url) => {
    pathname = url;
    render(
      <Provider store={makeStore()}>
        <ManagementLayout>
          <div data-testid="not-found-page">404</div>
        </ManagementLayout>
      </Provider>,
    );
    expect(screen.getByTestId("not-found-page")).toBeInTheDocument();
    expect(document.querySelector(".management-sidebar-column")).toBeNull();
    expect(getCurrentUserMock).not.toHaveBeenCalled();
  });
});
