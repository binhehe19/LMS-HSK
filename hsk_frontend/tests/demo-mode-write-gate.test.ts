import { describe, expect, it, vi } from "vitest";
import { getCampaignSendAvailability } from "@/lib/api/campaign-send-gate";
import { assertWriteEnabled, getWriteAvailability, WriteDisabledError } from "@/lib/api/write-gate";
import { isDemoActive, isDemoBlockedOnHost, isDemoBuild, isDemoHostAllowed } from "@/lib/demo/demo-mode";

describe("chế độ xem trước cục bộ (demo-mode): chỉ bật khi có cờ build VÀ host được phép", () => {
  it.each(["localhost", "127.0.0.1", "[::1]", "192.168.1.20", "10.0.0.5", "172.16.3.4", "172.31.255.1", "my-pc.local", "lms.hsk.test", "dev.internal"])("host được phép: %s", (host) => {
    expect(isDemoHostAllowed(host)).toBe(true);
  });

  it.each(["lms-ai.hoc-ba.edu.vn", "8.8.8.8", "172.32.0.1", "172.15.0.1", "example.com", "hoc-ba.edu.vn"])("host KHÔNG được phép: %s", (host) => {
    expect(isDemoHostAllowed(host)).toBe(false);
  });

  it("không có cờ => không bao giờ active, không bao giờ bị chặn (bản thật)", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    expect(isDemoBuild()).toBe(false);
    expect(isDemoActive("localhost")).toBe(false);
    expect(isDemoBlockedOnHost("lms-ai.hoc-ba.edu.vn")).toBe(false);
  });

  it("có cờ: active trên loopback, BỊ CHẶN trên host thật (không bao giờ chạy demo trên production)", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    expect(isDemoActive("localhost")).toBe(true);
    expect(isDemoActive("lms-ai.hoc-ba.edu.vn")).toBe(false);
    expect(isDemoBlockedOnHost("lms-ai.hoc-ba.edu.vn")).toBe(true);
    expect(isDemoBlockedOnHost("localhost")).toBe(false);
  });

  it("chỉ đúng giá trị '1' mới là bản demo", () => {
    for (const v of ["true", "yes", "0", "demo"]) {
      vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", v);
      expect(isDemoBuild()).toBe(false);
    }
  });
});

describe("write gate: mặc định ĐÓNG, mở bằng demo hoặc cờ NEXT_PUBLIC_WRITE_* đúng chữ 'enabled'", () => {
  it("không demo, không cờ => waiting và hàm client bị chặn (không request)", () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_QUIZ_GRADING", "");
    expect(getWriteAvailability("quiz-grading", false)).toBe("waiting");
    expect(() => assertWriteEnabled("quiz-grading", false)).toThrow(WriteDisabledError);
  });

  it("demo => enabled bất kể cờ", () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_QUIZ_GRADING", "");
    expect(getWriteAvailability("quiz-grading", true)).toBe("enabled");
    expect(() => assertWriteEnabled("quiz-grading", true)).not.toThrow();
  });

  it.each([
    ["enabled", "enabled"],
    ["true", "waiting"],
    ["ENABLED", "waiting"],
    [" enabled ", "enabled"],
  ])("cờ=%j => %s", (flag, expected) => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_TEACHER_MANAGEMENT", flag);
    expect(getWriteAvailability("teacher-management", false)).toBe(expected);
  });

  it("mỗi miền một cờ riêng: mở miền này không mở miền khác", () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    vi.stubEnv("NEXT_PUBLIC_WRITE_STORAGE", "");
    expect(getWriteAvailability("content", false)).toBe("enabled");
    expect(getWriteAvailability("storage", false)).toBe("waiting");
  });

  it("công tắc gửi chiến dịch: demo mở được khi có dịch vụ HSK (hợp đồng đề xuất), vẫn đóng khi KHÔNG có dịch vụ", () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubEnv("NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND", "");
    expect(getCampaignSendAvailability(true)).toBe("enabled");
    expect(getCampaignSendAvailability(false)).toBe("waiting");
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    expect(getCampaignSendAvailability(true)).toBe("waiting");
  });
});
