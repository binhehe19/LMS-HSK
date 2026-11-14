import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { getTickets } from "@/lib/api/ticket-client";

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
const ticket = { id: "t1", status: "OPEN", assignedId: "u1", module: "QUIZ", description: "x" };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TICKET_API_BASE_PATH", "/api/tickets");
});
afterEach(() => vi.unstubAllGlobals());

describe("ticket-client — đọc", () => {
  it("chưa cấu hình NEXT_PUBLIC_TICKET_API_BASE_PATH => ApiNotConfiguredError, KHÔNG gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_TICKET_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getTickets()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getTickets: GET gốc?page&size, bóc envelope Spring (content)", async () => {
    const fetchMock = respond(200, { success: true, data: { content: [ticket], totalElements: 1 } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getTickets(0, 100)).resolves.toEqual([ticket]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tickets?page=0&size=100");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
  });
});
