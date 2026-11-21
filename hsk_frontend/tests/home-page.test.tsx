import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { ApiError } from "@/lib/api/api-client";
import { getCurrentUser } from "@/lib/api/auth-client";
import { redirectToAuthFrontend } from "@/lib/auth/auth-redirect";
import { ROLES } from "@/lib/auth/roles";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/auth-redirect", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/auth-redirect")>(),
  redirectToAuthFrontend: vi.fn(),
}));

const getUser = vi.mocked(getCurrentUser);

function renderHome() {
  render(<Provider store={makeStore()}><HomePage /></Provider>);
}

beforeEach(() => {
  getUser.mockReset();
  replace.mockClear();
  vi.mocked(redirectToAuthFrontend).mockClear();
  window.sessionStorage.clear();
});

it.each([
  [[ROLES.USER], "/student/student-dashboard"],
  [["ROLE_STUDENT", ROLES.ADMIN], "/student/student-dashboard"],
  [[ROLES.ADMIN], "/admin/dashboard"],
  [[ROLES.TEACHER], "/instructor/welcome"],
  [[ROLES.MENTOR], "/instructor/welcome"],
])("redirects roles %j to %s", async (roles, destination) => {
  getUser.mockResolvedValue({ ...adminUser, roles });
  renderHome();
  await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
});

it("offers the public homepage for an unsupported role", async () => {
  getUser.mockResolvedValue({ ...adminUser, roles: [ROLES.TEACHER_MANAGER] });
  renderHome();
  expect(await screen.findByRole("link", { name: "Trang chủ Học Bá" }))
    .toHaveAttribute("href", "https://hoc-ba.edu.vn/");
  expect(screen.queryByRole("button", { name: "Đăng nhập vào LMS" })).not.toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

it("starts sign-in on request and returns to the LMS root after login", async () => {
  getUser.mockRejectedValue(new ApiError("Hết hạn", 401));
  renderHome();
  const login = await screen.findByRole("button", { name: "Đăng nhập vào LMS" });
  expect(screen.queryByRole("link", { name: "Trang chủ Học Bá" })).not.toBeInTheDocument();
  expect(redirectToAuthFrontend).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();

  await userEvent.click(login);
  expect(redirectToAuthFrontend).toHaveBeenCalledExactlyOnceWith("/login", "/");
  expect(window.sessionStorage.getItem("hsk.auth.redirected-at")).not.toBeNull();
});
