import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { createMembershipPlan, deleteMembershipPlan, getPaymentSummary, getTransactionReport, listAdminMembershipPlans, updateMembershipPlan } from "@/lib/api/payment-client";
import { WriteDisabledError } from "@/lib/api/write-gate";

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
const plan = { id: "mp-1", name: "VIP", description: "", price: 199000, durationInDays: 30, active: true };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
  vi.stubEnv("NEXT_PUBLIC_WRITE_MEMBERSHIP", "");
});
afterEach(() => vi.unstubAllGlobals());

describe("payment-client — đọc (hskClient, tiền tố /payment)", () => {
  it("chưa cấu hình NEXT_PUBLIC_HSK_API_BASE_PATH => ApiNotConfiguredError, KHÔNG gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPaymentSummary()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(getTransactionReport({ page: 0, size: 10, sort: "createdAt,desc" })).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(listAdminMembershipPlans()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("đường dẫn: /payment/reports/summary, /payment/reports/transactions?page&size&sort (sort được mã hoá), /payment/membership-plans/admin/all; bóc envelope", async () => {
    const fetchMock = respond(200, { success: true, data: { totalRevenue: 1 } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPaymentSummary()).resolves.toEqual({ totalRevenue: 1 });
    await getTransactionReport({ page: 2, size: 10, sort: "totalPrice,desc" });
    await listAdminMembershipPlans();
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/hsk/payment/reports/summary", "GET"],
      ["/api/hsk/payment/reports/transactions?page=2&size=10&sort=totalPrice%2Cdesc", "GET"],
      ["/api/hsk/payment/membership-plans/admin/all", "GET"],
    ]);
  });

  it.each([403, 500])("HTTP %i => ApiError đúng status", async (status) => {
    vi.stubGlobal("fetch", respond(status, ""));
    await expect(listAdminMembershipPlans()).rejects.toMatchObject({ name: "ApiError", status });
  });
});

describe("payment-client — ghi gói thành viên (write gate 'membership')", () => {
  it("công tắc ĐÓNG: create/update/delete là promise bị reject WriteDisabledError, KHÔNG tạo request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createMembershipPlan(plan, false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(updateMembershipPlan("mp-1", plan, false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(deleteMembershipPlan("mp-1", false)).rejects.toBeInstanceOf(WriteDisabledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("công tắc mở (demo): POST /payment/membership-plans/admin, PUT|DELETE /payment/membership-plans/admin/{id}; body JSON; lỗi 409 mang thông điệp máy chủ", async () => {
    const fetchMock = respond(200, { success: true, data: plan });
    vi.stubGlobal("fetch", fetchMock);
    await expect(createMembershipPlan(plan, true)).resolves.toEqual(plan);
    await updateMembershipPlan("mp 1", { ...plan, active: false }, true);
    await deleteMembershipPlan("mp-1", true);
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/hsk/payment/membership-plans/admin", "POST"],
      ["/api/hsk/payment/membership-plans/admin/mp%201", "PUT"],
      ["/api/hsk/payment/membership-plans/admin/mp-1", "DELETE"],
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ...plan, active: false });

    vi.stubGlobal("fetch", respond(409, { success: false, errorCode: "CONFLICT", errorMessage: "Gói đã có giao dịch hoàn thành" }));
    const error = await deleteMembershipPlan("mp-1", true).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).message).toBe("Gói đã có giao dịch hoàn thành");
  });
});
