import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { getPaymentSummary, getTransactionReport } from "@/lib/api/payment-client";

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
});
afterEach(() => vi.unstubAllGlobals());

describe("payment-client — đọc sao kê (hskClient, tiền tố /payment)", () => {
  it("chưa cấu hình NEXT_PUBLIC_HSK_API_BASE_PATH => ApiNotConfiguredError, KHÔNG gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPaymentSummary()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(getTransactionReport({ page: 0, size: 10, sort: "createdAt,desc" })).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("đường dẫn: /payment/reports/summary, /payment/reports/transactions?page&size&sort (sort được mã hoá); bóc envelope", async () => {
    const fetchMock = respond(200, { success: true, data: { totalRevenue: 1 } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPaymentSummary()).resolves.toEqual({ totalRevenue: 1 });
    await getTransactionReport({ page: 2, size: 10, sort: "totalPrice,desc" });
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/hsk/payment/reports/summary", "GET"],
      ["/api/hsk/payment/reports/transactions?page=2&size=10&sort=totalPrice%2Cdesc", "GET"],
    ]);
  });

  it.each([403, 500])("HTTP %i => ApiError đúng status", async (status) => {
    vi.stubGlobal("fetch", respond(status, ""));
    await expect(getPaymentSummary()).rejects.toMatchObject({ name: "ApiError", status });
  });
});
