import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { RequireAuth } from "@/components/auth/require-auth";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { notifySessionExpired } from "@/lib/api/auth-session";
import { getCurrentUser, type AuthUser } from "@/lib/api/auth-client";
import { ROLES } from "@/lib/auth/roles";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";

// Phiên GIẢ LẬP cách ly: thay toàn bộ module gọi Authentication, không có mạng thật.
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
const getCurrentUserMock = vi.mocked(getCurrentUser);
const assign = vi.fn();

beforeEach(() => {
  getCurrentUserMock.mockReset();
  assign.mockClear();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { href: "http://localhost:3100/admin/class-management", hostname: "localhost", assign },
  });
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
});

function setup(allowedRoles: string[] = [ROLES.ADMIN]) {
  render(
    <Provider store={makeStore()}>
      <AuthInitializer>
        <RequireAuth allowedRoles={allowedRoles}>
          <div data-testid="protected">nội dung quản trị</div>
        </RequireAuth>
      </AuthInitializer>
    </Provider>,
  );
}

const withRoles = (...roles: string[]): AuthUser => ({ ...adminUser, roles });

describe("RequireAuth + AuthInitializer (phiên giả lập cách ly)", () => {
  it("không render nội dung bảo vệ trong lúc đang xác minh phiên", () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("ADMIN => hiển thị nội dung", async () => {
    getCurrentUserMock.mockResolvedValue(adminUser);
    setup();
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("401 => chuyển sang Authentication_Frontend kèm redirect, không render nội dung", async () => {
    getCurrentUserMock.mockRejectedValue(new ApiError("hết hạn", 401));
    setup();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const target = new URL(assign.mock.calls[0][0] as string);
    expect(target.origin + target.pathname).toBe("http://auth.test.invalid/login");
    expect(target.searchParams.get("redirect")).toBe("http://localhost:3100/admin/class-management");
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("KHÔNG có đường tắt bỏ qua kiểm tra khi NODE_ENV=development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getCurrentUserMock.mockRejectedValue(new ApiError("hết hạn", 401));
    setup();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("thiếu NEXT_PUBLIC_AUTH_FRONTEND_URL => báo chưa cấu hình, không chuyển trang, không render nội dung", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "");
    getCurrentUserMock.mockRejectedValue(new ApiError("hết hạn", 401));
    setup();
    expect(await screen.findByTestId("auth-redirect-unavailable")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("sai role => 'Không có quyền truy cập'", async () => {
    getCurrentUserMock.mockResolvedValue(withRoles(ROLES.TEACHER));
    setup();
    expect(await screen.findByTestId("auth-forbidden")).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it.each([ROLES.MENTOR, ROLES.TEACHER_MANAGER, ROLES.COLLABORATOR, ROLES.USER, "ROLE_MANAGER"])(
    "%s không được coi là ADMIN",
    async (role) => {
      getCurrentUserMock.mockResolvedValue(withRoles(role));
      setup();
      expect(await screen.findByTestId("auth-forbidden")).toBeInTheDocument();
    },
  );

  it("nhóm route cho phép nhiều role (TEACHER hoặc MENTOR) hoạt động theo danh sách khai báo", async () => {
    getCurrentUserMock.mockResolvedValue(withRoles(ROLES.MENTOR));
    setup([ROLES.TEACHER, ROLES.MENTOR]);
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
  });

  it("lỗi mạng hoặc 5xx => panel lỗi (không bypass, không chuyển trang), thử lại được", async () => {
    getCurrentUserMock.mockRejectedValueOnce(new ApiError("mất mạng", 0)).mockResolvedValueOnce(adminUser);
    setup();
    expect(await screen.findByTestId("auth-error")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByTestId("protected")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
  });

  it("chưa cấu hình Auth API => panel lỗi, không bypass", async () => {
    getCurrentUserMock.mockRejectedValue(new ApiNotConfiguredError());
    setup();
    const panel = await screen.findByTestId("auth-error");
    expect(panel).toHaveTextContent("NEXT_PUBLIC_AUTH_API_BASE_URL");
    expect(screen.queryByTestId("protected")).toBeNull();
  });
});

describe("chống vòng lặp redirect + callback + phiên hết hạn giữa chừng", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("lần đầu chưa đăng nhập: chuyển sang Auth đúng một lần và ghi marker", async () => {
    getCurrentUserMock.mockRejectedValue(new ApiError("hết hạn", 401));
    setup();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem("hsk.auth.redirected-at")).not.toBeNull();
  });

  it("quay về vẫn chưa có phiên (marker còn mới): KHÔNG chuyển lần nữa, hiện hướng dẫn; nút 'Đăng nhập lại' do người dùng bấm", async () => {
    window.sessionStorage.setItem("hsk.auth.redirected-at", String(Date.now()));
    getCurrentUserMock.mockRejectedValue(new ApiError("hết hạn", 401));
    setup();
    expect(await screen.findByTestId("auth-redirect-loop")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập lại" }));
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("marker đã quá cũ => được chuyển lại bình thường", async () => {
    window.sessionStorage.setItem("hsk.auth.redirected-at", String(Date.now() - 10 * 60 * 1000));
    getCurrentUserMock.mockRejectedValue(new ApiError("hết hạn", 401));
    setup();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
  });

  it("đăng nhập thành công xóa marker", async () => {
    window.sessionStorage.setItem("hsk.auth.redirected-at", String(Date.now()));
    getCurrentUserMock.mockResolvedValue(adminUser);
    setup();
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("hsk.auth.redirected-at")).toBeNull();
  });

  it("nhận token callback ở URL hash trước khi kiểm tra phiên, rồi xóa hash", async () => {
    const jwt = "eyJhbGciOiJub25lIn0.cccpayload.mocksig";
    // location đã bị thay bằng đối tượng giả trong beforeEach; dùng history thật của jsdom.
    Object.defineProperty(window, "location", { configurable: true, writable: true, value: { ...window.location, href: "http://localhost:3100/p", hostname: "localhost", assign, pathname: "/p", search: "", hash: `#access_token=${jwt}` } });
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    getCurrentUserMock.mockResolvedValue(adminUser);
    setup();
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    expect(replaceState).toHaveBeenCalled();
    expect(String(replaceState.mock.calls[0][2])).not.toContain("access_token");
  });

  it("cấu hình MOCK trên host không phải loopback bị chặn, KHÔNG gọi Auth", async () => {
    Object.defineProperty(window, "location", { configurable: true, writable: true, value: { href: "https://lms.hoc-ba.edu.vn/admin", hostname: "lms.hoc-ba.edu.vn", assign } });
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://localhost:3190/api/auth");
    setup();
    const panel = await screen.findByTestId("auth-error");
    expect(panel).toHaveTextContent("MOCK");
    expect(getCurrentUserMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("phiên hết hạn giữa chừng (refresh bị từ chối) => quay về unauthenticated và chuyển sang Auth", async () => {
    getCurrentUserMock.mockResolvedValue(adminUser);
    setup();
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    act(() => notifySessionExpired());
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("protected")).toBeNull();
  });
});
