import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { closeTicket, createTicket, deleteTicket, doneTicket, getTicketAssignees, getTickets, updateTicket } from "@/lib/api/ticket-client";
import { WriteDisabledError } from "@/lib/api/write-gate";

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
const ticket = { id: "t1", status: "OPEN", assignedId: "u1", module: "QUIZ", description: "x" };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TICKET_API_BASE_PATH", "/api/tickets");
  vi.stubEnv("NEXT_PUBLIC_WRITE_WORK_TICKETS", "");
});
afterEach(() => vi.unstubAllGlobals());

describe("ticket-client — đọc", () => {
  it("chưa cấu hình NEXT_PUBLIC_TICKET_API_BASE_PATH => ApiNotConfiguredError, KHÔNG gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_TICKET_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getTickets()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(getTicketAssignees()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getTickets: GET gốc?page&size, bóc envelope Spring (content); getTicketAssignees: /assignees, kèm ?q= đã mã hoá khi có từ khoá", async () => {
    const fetchMock = respond(200, { success: true, data: { content: [ticket], totalElements: 1 } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getTickets(0, 100)).resolves.toEqual([ticket]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tickets?page=0&size=100");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");

    vi.stubGlobal("fetch", respond(200, { success: true, data: [] }));
    await getTicketAssignees();
    await getTicketAssignees("  an b ");
    const calls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBe("/api/tickets/assignees");
    expect(calls[1][0]).toBe("/api/tickets/assignees?q=an%20b");
  });
});

describe("ticket-client — ghi (write gate 'work-tickets')", () => {
  it("công tắc ĐÓNG (không demo, không cờ): mọi hàm ghi là promise bị reject WriteDisabledError và KHÔNG tạo request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createTicket({ assignedId: "u1", module: "QUIZ", description: "x" }, false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(updateTicket("t1", { description: "y" }, false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(deleteTicket("t1", false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(closeTicket("t1", false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(doneTicket("t1", false)).rejects.toBeInstanceOf(WriteDisabledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("createTicket (demo mở): POST đúng GỐC dịch vụ — không có '/' cuối — với body JSON; trả ticket đã bóc envelope", async () => {
    vi.stubEnv("NEXT_PUBLIC_TICKET_API_BASE_PATH", "http://lms.test.invalid/id/tickets/");
    const fetchMock = respond(201, { success: true, data: ticket });
    vi.stubGlobal("fetch", fetchMock);
    await expect(createTicket({ assignedId: "u1", module: "QUIZ", description: "x" }, true)).resolves.toEqual(ticket);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://lms.test.invalid/id/tickets");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ assignedId: "u1", module: "QUIZ", description: "x" });
  });

  it("update PUT /{id}, delete DELETE /{id}, close POST /{id}/close, done POST /{id}/done (id được mã hoá); mở bằng cờ NEXT_PUBLIC_WRITE_WORK_TICKETS=enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_WORK_TICKETS", "enabled");
    const fetchMock = respond(200, { success: true, data: ticket });
    vi.stubGlobal("fetch", fetchMock);
    await updateTicket("a/b", { module: "WRITING" }, false);
    await deleteTicket("t1", false);
    await closeTicket("t1", false);
    await doneTicket("t1", false);
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/tickets/a%2Fb", "PUT"],
      ["/api/tickets/t1", "DELETE"],
      ["/api/tickets/t1/close", "POST"],
      ["/api/tickets/t1/done", "POST"],
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ module: "WRITING" });
  });
});
