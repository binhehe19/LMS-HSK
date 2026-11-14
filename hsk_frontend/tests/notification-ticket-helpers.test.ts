import { describe, expect, it } from "vitest";
import { pickNotificationTarget, resolveNotificationTarget } from "@/lib/notifications/notification-target";
import { formatUnreadBadge } from "@/lib/notifications/unread-badge";
import { computeTicketStats, ticketToastMessage, toTicketList } from "@/lib/tickets/ticket-stats";
import type { TicketResponse } from "@/types/ticket";

describe("formatUnreadBadge", () => {
  it.each([
    [null, null],
    [0, null],
    [-3, null],
    [Number.NaN, null],
    [1, "1"],
    [99, "99"],
    [100, "99+"],
  ])("%s => %s", (input, expected) => {
    expect(formatUnreadBadge(input as number | null)).toBe(expected);
  });
});

describe("resolveNotificationTarget", () => {
  const list = "/admin/settings/notifications";
  it("ưu tiên targetUrl rồi deepLink, chỉ nhận đường dẫn nội bộ", () => {
    expect(resolveNotificationTarget({ targetUrl: "/a", deepLink: "/b" }, list)).toBe("/a");
    expect(resolveNotificationTarget({ deepLink: "/b" }, list)).toBe("/b");
    expect(resolveNotificationTarget({ targetUrl: "https://x.example/a", deepLink: "/b" }, list)).toBe("/b");
  });
  it.each([null, undefined, {}, { targetUrl: "//evil.example" }, { targetUrl: "javascript:alert(1)" }, { targetUrl: 5 }])(
    "%j => danh sách",
    (payload) => {
      expect(resolveNotificationTarget(payload as never, list)).toBe(list);
    },
  );
});

describe("pickNotificationTarget (màn danh sách: không có đích => null, không điều hướng)", () => {
  it("trả về đích nội bộ theo thứ tự targetUrl → deepLink, ngược lại null", () => {
    expect(pickNotificationTarget({ targetUrl: "/a", deepLink: "/b" })).toBe("/a");
    expect(pickNotificationTarget({ deepLink: "/b" })).toBe("/b");
    expect(pickNotificationTarget({ targetUrl: "#" })).toBeNull();
    expect(pickNotificationTarget({ targetUrl: "//evil.example", deepLink: "http://evil.example" })).toBeNull();
    expect(pickNotificationTarget(null)).toBeNull();
    expect(pickNotificationTarget(undefined)).toBeNull();
  });
});

describe("toTicketList (các dạng phản hồi bản cũ chấp nhận)", () => {
  const t: TicketResponse = { id: "1", status: "OPEN", assignedId: "u" };
  it.each([[[t]], [{ items: [t] }], [{ content: [t] }], [{ data: [t] }], [{ data: { content: [t] } }]])("%j", (raw) => {
    expect(toTicketList(raw)).toEqual([t]);
  });
  it.each([null, undefined, "x", 3, {}, { data: "x" }])("%j => []", (raw) => {
    expect(toTicketList(raw)).toEqual([]);
  });
});

describe("computeTicketStats / ticketToastMessage", () => {
  const tickets: TicketResponse[] = [
    { id: "1", status: "OPEN", assignedId: "7" },
    { id: "2", status: "OPEN", assignedId: "8" },
    { id: "3", status: "DONE", assignedId: 7 as unknown as string },
    { id: "4", status: "CLOSE", assignedId: "7" },
  ];
  it("manager đếm mọi ticket; instructor chỉ ticket giao cho mình (so sánh chuỗi)", () => {
    expect(computeTicketStats(tickets, "manager", "7")).toEqual({ open: 2, done: 1 });
    expect(computeTicketStats(tickets, "instructor", "7")).toEqual({ open: 1, done: 1 });
    expect(computeTicketStats(tickets, "instructor", 7)).toEqual({ open: 1, done: 1 });
    expect(computeTicketStats([], "manager", "7")).toEqual({ open: 0, done: 0 });
  });
  it.each(["manager", "instructor"] as const)("%s: ba tình huống cho ba thông điệp khác nhau, rỗng khi không có gì", (variant) => {
    const messages = [
      ticketToastMessage(variant, { open: 1, done: 1 }),
      ticketToastMessage(variant, { open: 1, done: 0 }),
      ticketToastMessage(variant, { open: 0, done: 1 }),
    ];
    expect(new Set(messages).size).toBe(3);
    expect(messages.every((m) => m.length > 20)).toBe(true);
    expect(ticketToastMessage(variant, { open: 0, done: 0 })).toBe("");
  });
});
