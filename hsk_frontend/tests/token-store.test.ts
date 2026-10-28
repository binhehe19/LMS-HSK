import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTokens, consumeTokensFromUrlHash, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/token-store";

// Token giả có hình dạng JWT (không phải token thật).
const jwt = (tag: string) => `eyJhbGciOiJub25lIn0.${tag}payload.mocksig`;

function setLocation(pathname: string, search: string, hash: string) {
  window.history.replaceState(null, "", `${pathname}${search}${hash}`);
}

beforeEach(() => {
  clearTokens();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("token-store (chỉ trong bộ nhớ)", () => {
  it("nhận access/refresh token hợp lệ từ hash và xóa chúng khỏi URL, giữ query", () => {
    setLocation("/admin/class-management", "?page=2", `#access_token=${jwt("a")}&refresh_token=${jwt("r")}`);
    expect(consumeTokensFromUrlHash()).toBe(true);
    expect(getAccessToken()).toBe(jwt("a"));
    expect(getRefreshToken()).toBe(jwt("r"));
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/admin/class-management?page=2");
  });

  it("giữ lại tham số hash khác không phải token", () => {
    setLocation("/x", "", `#section=2&access_token=${jwt("a")}`);
    expect(consumeTokensFromUrlHash()).toBe(true);
    expect(window.location.hash).toBe("#section=2");
  });

  it.each([
    ["rác không phải JWT", "#access_token=garbage"],
    ["rỗng", "#access_token="],
    ["chỉ refresh token", `#refresh_token=${jwt("r")}`],
    ["một đoạn", "#access_token=abcdefghijklmnop"],
    ["quá dài", `#access_token=${"a".repeat(9000)}.bbbbbbbb.cccc`],
  ])("callback không hợp lệ (%s) bị bỏ qua nhưng hash vẫn được dọn", (_name, hash) => {
    setLocation("/p", "", hash);
    expect(consumeTokensFromUrlHash()).toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(window.location.hash).toBe("");
  });

  it("không có token trong hash => không làm gì, không đụng tới URL", () => {
    setLocation("/p", "?a=1", "#anchor");
    expect(consumeTokensFromUrlHash()).toBe(false);
    expect(window.location.hash).toBe("#anchor");
  });

  it("refresh token không hợp lệ không được lưu nhưng access token hợp lệ vẫn nhận", () => {
    setLocation("/p", "", `#access_token=${jwt("a")}&refresh_token=nope`);
    expect(consumeTokensFromUrlHash()).toBe(true);
    expect(getRefreshToken()).toBeNull();
  });

  it("KHÔNG ghi token vào localStorage/sessionStorage và KHÔNG ghi log", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    setLocation("/p", "", `#access_token=${jwt("secret")}&refresh_token=${jwt("secret2")}`);
    consumeTokensFromUrlHash();
    setTokens({ accessToken: jwt("x"), refreshToken: jwt("y") });
    clearTokens();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it("clearTokens quên cả hai token", () => {
    setTokens({ accessToken: jwt("a"), refreshToken: jwt("r") });
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
