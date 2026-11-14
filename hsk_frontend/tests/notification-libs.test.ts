import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignSendDisabledError, sendCampaign } from "@/lib/api/notification-client";
import { getCampaignSendAvailability } from "@/lib/api/campaign-send-gate";
import { CAMPAIGN_FORM_INCOMPLETE_MESSAGE, buildCampaignRequest, validateCampaignForm } from "@/lib/notifications/campaign-form";
import { clampedPageOrNull, pageCount } from "@/lib/notifications/pagination";
import {
  addRecipients,
  campaignStatusClass,
  recipientName,
  selectAllLabel,
  stripRolePrefix,
  toggleRecipient,
} from "@/lib/notifications/recipient-selection";
import type { AdminUser } from "@/types/admin-user";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("pageCount / clampedPageOrNull (trang không còn hợp lệ khi dữ liệu thay đổi)", () => {
  it.each([
    [0, 10, 0],
    [1, 10, 1],
    [10, 10, 1],
    [11, 10, 2],
    [25, 10, 3],
    [5, 0, 0],
  ])("%i bản ghi, size %i => %i trang", (total, size, pages) => {
    expect(pageCount(total, size)).toBe(pages);
  });

  it("trang còn hợp lệ => null (không nhảy trang)", () => {
    expect(clampedPageOrNull(0, 25, 10)).toBeNull();
    expect(clampedPageOrNull(2, 25, 10)).toBeNull();
  });

  it("trang vượt quá => trang cuối còn dữ liệu", () => {
    expect(clampedPageOrNull(3, 25, 10)).toBe(2);
    expect(clampedPageOrNull(7, 11, 10)).toBe(1);
  });

  it("không còn bản ghi nào => null (hiện trạng thái rỗng thay vì nhảy trang)", () => {
    expect(clampedPageOrNull(4, 0, 10)).toBeNull();
  });
});

describe("validateCampaignForm / buildCampaignRequest", () => {
  it.each([
    [{ title: "", message: "x" }, 1],
    [{ title: "x", message: "" }, 1],
    [{ title: "x", message: "y" }, 0],
    [{ title: "   ", message: "y" }, 1], // khác bản cũ: chỉ khoảng trắng là trống
    [{ title: "x", message: "\n \t" }, 1],
  ])("%j với %i người nhận => thông báo thiếu thông tin", (values, count) => {
    expect(validateCampaignForm(values, count)).toBe(CAMPAIGN_FORM_INCOMPLETE_MESSAGE);
  });

  it("hợp lệ => null", () => {
    expect(validateCampaignForm({ title: "Tiêu đề", message: "Nội dung" }, 2)).toBeNull();
  });

  it("nội dung gửi: cắt khoảng trắng hai đầu, giữ thứ tự id", () => {
    expect(buildCampaignRequest({ title: "  Tiêu đề ", message: " Nội dung\n" }, ["b", "a"])).toEqual({ title: "Tiêu đề", message: "Nội dung", userIds: ["b", "a"] });
  });
});

describe("recipient-selection", () => {
  const u = (id: string, fullName?: string, email = `${id}@x.test`): AdminUser => ({ id, email, fullName, roles: ["ROLE_USER"] });

  it("tên hiển thị: họ tên, rồi email, rồi id", () => {
    expect(recipientName(u("1", "An"))).toBe("An");
    expect(recipientName(u("1", undefined))).toBe("1@x.test");
    expect(recipientName({ id: "9", email: "", fullName: "" })).toBe("9");
  });

  it("toggle: thêm rồi bỏ, giữ thứ tự chọn; không đổi Map cũ", () => {
    const a = toggleRecipient(new Map(), "1", "An");
    const b = toggleRecipient(a, "2", "Bình");
    expect([...b.keys()]).toEqual(["1", "2"]);
    expect([...toggleRecipient(b, "1").keys()]).toEqual(["2"]);
    expect(a.size).toBe(1);
    expect(toggleRecipient(new Map(), "7").get("7")).toBe("7"); // không có tên => dùng id
  });

  it("addRecipients: gộp, không trùng, giữ người đã chọn", () => {
    const base = toggleRecipient(new Map(), "1", "An");
    const merged = addRecipients(base, [u("1", "An"), u("2", "Bình")]);
    expect([...merged.keys()]).toEqual(["1", "2"]);
  });

  it("nhãn vai trò, nút chọn tất cả và màu trạng thái chiến dịch", () => {
    expect(stripRolePrefix("ROLE_TEACHER")).toBe("TEACHER");
    expect(selectAllLabel("")).toBe("Chọn tất cả người dùng");
    expect(selectAllLabel("ROLE_COLLABORATOR")).toBe("Chọn tất cả COLLABORATOR");
    expect(campaignStatusClass("SUCCESS")).toContain("text-success");
    expect(campaignStatusClass("PROCESSING")).toContain("text-info");
    expect(campaignStatusClass("FAILED")).toContain("text-warning");
    expect(campaignStatusClass("")).toContain("text-warning");
  });
});

describe("công tắc gửi chiến dịch (thao tác ghi) — mặc định ĐÓNG", () => {
  // Chiến dịch là hợp đồng đề xuất qua hsk-client: dịch vụ ở đây là NEXT_PUBLIC_HSK_API_BASE_PATH (không phải dịch vụ thông báo của backend chung).
  it.each([
    [undefined, undefined, "waiting"],
    ["", "", "waiting"],
    ["/api/hsk", "", "waiting"], // có dịch vụ nhưng chưa bật gửi
    ["/api/hsk", "true", "waiting"], // chỉ đúng chữ "enabled"
    ["", "enabled", "waiting"], // bật gửi nhưng không có dịch vụ
    ["/api/hsk", "enabled", "enabled"],
  ])("dịch vụ=%j, cờ=%j => %s", (base, flag, expected) => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", base as string);
    vi.stubEnv("NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND", flag as string);
    expect(getCampaignSendAvailability()).toBe(expected);
  });

  it("sendCampaign bị chặn ở lớp client khi công tắc đóng: KHÔNG có request nào được tạo", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubEnv("NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND", "");
    await expect(sendCampaign({ title: "a", message: "b", userIds: ["1"] })).rejects.toBeInstanceOf(CampaignSendDisabledError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
