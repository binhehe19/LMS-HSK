import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { ApiError } from "@/lib/api/api-client";
import { getCurrentUser } from "@/lib/api/auth-client";
import { ROLES } from "@/lib/auth/roles";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn() }));

const getUser = vi.mocked(getCurrentUser);

function renderHome() {
  render(<Provider store={makeStore()}><HomePage /></Provider>);
}

beforeEach(() => {
  getUser.mockReset();
  replace.mockClear();
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
  expect(await screen.findByRole("link", { name: "Về trang chủ" }))
    .toHaveAttribute("href", "https://hoc-ba.edu.vn/");
  expect(replace).not.toHaveBeenCalled();
});

it("offers the public homepage when the session is unauthenticated", async () => {
  getUser.mockRejectedValue(new ApiError("Hết hạn", 401));
  renderHome();
  expect(await screen.findByRole("link", { name: "Về trang chủ" })).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});
