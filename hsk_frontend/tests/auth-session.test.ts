import { describe, expect, it, vi } from "vitest";
import { notifySessionExpired, subscribeSessionExpired } from "@/lib/api/auth-session";

describe("thông báo hết phiên", () => {
  it("mọi bên đăng ký đều nhận được thông báo", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeSessionExpired(a);
    const offB = subscribeSessionExpired(b);
    notifySessionExpired();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });

  it("hủy đăng ký thì không nhận nữa", () => {
    const listener = vi.fn();
    subscribeSessionExpired(listener)();
    notifySessionExpired();
    expect(listener).not.toHaveBeenCalled();
  });
});
