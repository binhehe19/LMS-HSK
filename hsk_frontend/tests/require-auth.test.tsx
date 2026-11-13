import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { RequireAuth } from "@/components/auth/require-auth";
import { ApiError } from "@/lib/api/api-client";
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
    value: { href: "http://localhost:3100/admin/class-management", origin: "http://localhost:3100", hostname: "localhost", pathname: "/admin/class-management", search: "", assign },
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

  it("401 => chuyển sang /oauth2/start của gateway, quay về đúng trang hiện tại, không render nội dung", async () => {
    getCurrentUserMock.mockRejectedValue(new ApiError("hết hạn", 401));
    setup();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(assign).toHaveBeenCalledWith("/oauth2/start?rd=%2Fadmin%2Fclass-management");
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("KHÔNG có đường tắt bỏ qua kiểm tra khi NODE_ENV=development: đăng nhập ở trang tài khoản rồi về callback của app", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getCurrentUserMock.mockRejectedValue(new ApiError("hết hạn", 401));
    setup();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const target = new URL(assign.mock.calls[0][0] as string);
    expect(target.origin + target.pathname).toBe("http://auth.test.invalid/login");
    expect(target.searchParams.get("continue")).toBe("http://localhost:3100/dev-auth/callback?rd=%2Fadmin%2Fclass-management");
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("`next dev` thiếu NEXT_PUBLIC_AUTH_FRONTEND_URL => báo chưa cấu hình, không chuyển trang, không render nội dung", async () => {
    vi.stubEnv("NODE_ENV", "development");
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

  it("production không cần NEXT_PUBLIC_AUTH_FRONTEND_URL để đăng nhập (gateway cùng origin)", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "");
    getCurrentUserMock.mockRejectedValue(new ApiError("hết hạn", 401));
    setup();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/oauth2/start?rd=%2Fadmin%2Fclass-management"));
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

  it("cấu hình MOCK trên host không phải loopback bị chặn, KHÔNG gọi Auth", async () => {
    Object.defineProperty(window, "location", { configurable: true, writable: true, value: { href: "https://lms.hoc-ba.edu.vn/admin", hostname: "lms.hoc-ba.edu.vn", assign } });
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://localhost:3190/api/auth");
    setup();
    const panel = await screen.findByTestId("auth-error");
    expect(panel).toHaveTextContent("MOCK");
    expect(getCurrentUserMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("phiên hết hạn giữa chừng (một API trả 401) => quay về unauthenticated và chuyển sang đăng nhập", async () => {
    getCurrentUserMock.mockResolvedValue(adminUser);
    setup();
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    act(() => notifySessionExpired());
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("protected")).toBeNull();
  });
});
