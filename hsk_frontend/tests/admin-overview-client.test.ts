import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAnalyticsOverview, getDashboardOverview } from "@/lib/api/admin-overview-client";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { analyticsFixture, dashboardFixture } from "./fixtures/admin-overview";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("admin-overview-client (hskClient, hợp đồng đề xuất — WAITING FOR BACKEND)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
  });

  it("getDashboardOverview: GET /management/dashboard/overview?days=30, gửi kèm cookie, bóc envelope {success,data}", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: dashboardFixture }));
    const res = await getDashboardOverview(30);
    expect(res).toEqual(dashboardFixture);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/hsk/management/dashboard/overview?days=30");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("getAnalyticsOverview: GET /id/analytics/admin/overview?days=14 (đường dẫn kế thừa analytics.service.ts cũ), chấp nhận thân trần", async () => {
    fetchMock.mockResolvedValue(jsonResponse(analyticsFixture));
    const res = await getAnalyticsOverview(14);
    expect(res).toEqual(analyticsFixture);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/api/hsk/id/analytics/admin/overview?days=14");
  });

  it("chưa cấu hình NEXT_PUBLIC_HSK_API_BASE_PATH => ApiNotConfiguredError (WAITING FOR BACKEND), không gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    await expect(getDashboardOverview(30)).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(getAnalyticsOverview(7)).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("403 => ApiError 'không có quyền'; 500 có errorMessage ngắn => ApiError mang thông điệp của backend", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, errorCode: "FORBIDDEN", errorMessage: "Không có quyền (MOCK)" }, 403));
    const forbidden = await getDashboardOverview(30).catch((e: unknown) => e);
    expect(forbidden).toBeInstanceOf(ApiError);
    expect((forbidden as ApiError).status).toBe(403);
    expect((forbidden as ApiError).message).toBe("Bạn không có quyền thực hiện thao tác này.");

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, errorCode: "500", errorMessage: "Lỗi máy chủ giả lập (MOCK)" }, 500));
    const failed = await getAnalyticsOverview(7).catch((e: unknown) => e);
    expect(failed).toBeInstanceOf(ApiError);
    expect((failed as ApiError).message).toBe("Lỗi máy chủ giả lập (MOCK)");
  });
});
