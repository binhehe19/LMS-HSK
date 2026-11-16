import { describe, expect, it } from "vitest";
import { summarizeAssignedTickets, welcomeRoleLabel } from "@/lib/instructor-welcome/welcome-summary";
import type { TicketResponse } from "@/types/ticket";

const t = (id: string, status: TicketResponse["status"], assignedId: string | number): TicketResponse => ({ id, status, assignedId: assignedId as string });

describe("summarizeAssignedTickets (logic của selectActiveTickets + thẻ thống kê HSK cũ)", () => {
  it("chỉ tính ticket giao cho chính người dùng và còn hiệu lực (OPEN/DONE); CLOSE và ticket người khác bị loại", () => {
    const list = [t("1", "OPEN", "u1"), t("2", "OPEN", "u1"), t("3", "DONE", "u1"), t("4", "CLOSE", "u1"), t("5", "OPEN", "u2"), t("6", "DONE", "u2")];
    expect(summarizeAssignedTickets(list, "u1")).toEqual({ openTickets: 2, doneTickets: 1, totalTickets: 3, completionRate: 33 });
  });

  it("so sánh id dạng chuỗi (số và chuỗi coi là một)", () => {
    expect(summarizeAssignedTickets([t("1", "DONE", 7)], "7").doneTickets).toBe(1);
    expect(summarizeAssignedTickets([t("1", "DONE", "7")], 7).doneTickets).toBe(1);
  });

  it("làm tròn kiểu Math.round: 1/3 → 33, 2/3 → 67, 1/2 → 50", () => {
    expect(summarizeAssignedTickets([t("1", "DONE", "u"), t("2", "OPEN", "u"), t("3", "OPEN", "u")], "u").completionRate).toBe(33);
    expect(summarizeAssignedTickets([t("1", "DONE", "u"), t("2", "DONE", "u"), t("3", "OPEN", "u")], "u").completionRate).toBe(67);
    expect(summarizeAssignedTickets([t("1", "DONE", "u"), t("2", "OPEN", "u")], "u").completionRate).toBe(50);
  });

  it("không có ticket hoặc không có userId => toàn bộ bằng 0, tỷ lệ 0 (không chia cho 0)", () => {
    const zero = { openTickets: 0, doneTickets: 0, totalTickets: 0, completionRate: 0 };
    expect(summarizeAssignedTickets([], "u1")).toEqual(zero);
    expect(summarizeAssignedTickets([t("1", "OPEN", "u1")], undefined)).toEqual(zero);
  });
});

describe("welcomeRoleLabel", () => {
  it.each([
    [["ROLE_TEACHER"], "Giảng viên"],
    [["ROLE_MENTOR"], "Giảng viên"], // HSK cũ: selectIsTeacher gồm cả MENTOR
    [["ROLE_USER", "ROLE_TEACHER"], "Giảng viên"],
    [["ROLE_USER"], "Người dùng"],
    [[], "Người dùng"],
    [undefined, "Người dùng"],
  ])("%j => %s", (roles, expected) => {
    expect(welcomeRoleLabel(roles as string[] | undefined)).toBe(expected);
  });
});
