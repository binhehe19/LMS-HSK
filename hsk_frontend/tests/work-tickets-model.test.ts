import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import {
  EMPTY_TICKET_FILTERS,
  assigneeRoleLabel,
  countTicketsByStatus,
  filterAssignees,
  filterTickets,
  formatTicketDate,
  isOwnTicket,
  ticketAssigneeName,
  ticketCombinations,
  ticketModuleLabel,
  ticketToForm,
  toggleSelection,
  validateTicketForm,
} from "@/lib/work-tickets/ticket-model";
import type { TicketAssigneeOptionResponse, TicketResponse } from "@/types/ticket";

const t = (id: string, over: Partial<TicketResponse> = {}): TicketResponse => ({
  id, status: "OPEN", assignedId: "u1", description: `Mô tả ${id}`, module: "QUIZ", assignedName: "Nguyễn Văn An", assignedEmail: "an@example.test", createdAt: "2026-10-20T08:00:00", ...over,
});
const list: TicketResponse[] = [
  t("t1"),
  t("t2", { status: "DONE", module: "WRITING", assignedId: "u2", assignedName: "Trần Thị Bình", assignedEmail: "binh@example.test", createdAt: "2026-10-25T23:30:00" }),
  t("t3", { status: "CLOSE", module: "FLASHCARD", description: "Việc cũ đã đóng", createdAt: undefined }),
];

describe("filterTickets (logic useMemo của hai màn cũ)", () => {
  it("tìm kiếm không phân biệt hoa/thường: Admin khớp tên/email/mô tả, giảng viên CHỈ khớp mô tả", () => {
    expect(filterTickets(list, { ...EMPTY_TICKET_FILTERS, search: "BINH@" }, "manager").map((x) => x.id)).toEqual(["t2"]);
    expect(filterTickets(list, { ...EMPTY_TICKET_FILTERS, search: "trần thị" }, "manager").map((x) => x.id)).toEqual(["t2"]);
    expect(filterTickets(list, { ...EMPTY_TICKET_FILTERS, search: "binh@" }, "instructor")).toEqual([]);
    expect(filterTickets(list, { ...EMPTY_TICKET_FILTERS, search: "đã đóng" }, "instructor").map((x) => x.id)).toEqual(["t3"]);
    expect(filterTickets(list, EMPTY_TICKET_FILTERS, "manager")).toHaveLength(3);
  });

  it("lọc module, trạng thái và khoảng ngày tạo (đầu ngày từ, cuối ngày đến); ticket không có createdAt vẫn qua bộ lọc ngày (giữ hành vi cũ)", () => {
    expect(filterTickets(list, { ...EMPTY_TICKET_FILTERS, module: "WRITING" }, "manager").map((x) => x.id)).toEqual(["t2"]);
    expect(filterTickets(list, { ...EMPTY_TICKET_FILTERS, status: "CLOSE" }, "manager").map((x) => x.id)).toEqual(["t3"]);
    const range: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs("2026-10-25T15:00:00"), dayjs("2026-10-25T01:00:00")];
    expect(filterTickets(list, { ...EMPTY_TICKET_FILTERS, range }, "manager").map((x) => x.id)).toEqual(["t2", "t3"]);
    expect(filterTickets(list, { ...EMPTY_TICKET_FILTERS, range: [dayjs("2026-10-21"), null] }, "manager").map((x) => x.id)).toEqual(["t2", "t3"]);
    expect(filterTickets(list, { ...EMPTY_TICKET_FILTERS, range: [null, dayjs("2026-10-20")] }, "manager").map((x) => x.id)).toEqual(["t1", "t3"]);
  });
});

describe("đếm, nhãn, định dạng", () => {
  it("countTicketsByStatus đếm 4 ô; ticketModuleLabel theo MODULE_OPTIONS cũ (mã lạ in nguyên, thiếu => —); formatTicketDate DD/MM/YYYY hoặc N/A", () => {
    expect(countTicketsByStatus(list)).toEqual({ total: 3, open: 1, done: 1, closed: 1 });
    expect(countTicketsByStatus([])).toEqual({ total: 0, open: 0, done: 0, closed: 0 });
    expect(ticketModuleLabel("FLASHCARD")).toBe("Thẻ ghi nhớ (Flashcard)");
    expect(ticketModuleLabel("OTHER")).toBe("Giáo trình (Syllabus)");
    expect(ticketModuleLabel("GRAMMAR")).toBe("GRAMMAR");
    expect(ticketModuleLabel(undefined)).toBe("—");
    expect(formatTicketDate("2026-10-20T08:00:00")).toBe("20/10/2026");
    expect(formatTicketDate(undefined)).toBe("N/A");
  });

  it("ticketAssigneeName nhận assignedName hoặc assignedFullName (bản cũ lệch tên trường); isOwnTicket so sánh dạng chuỗi", () => {
    expect(ticketAssigneeName(t("x"))).toBe("Nguyễn Văn An");
    expect(ticketAssigneeName(t("x", { assignedName: undefined, assignedFullName: "Từ backend" }))).toBe("Từ backend");
    expect(ticketAssigneeName(t("x", { assignedName: undefined }))).toBe("");
    expect(isOwnTicket(t("x", { assignedId: "7" }), 7)).toBe(true);
    expect(isOwnTicket(t("x", { assignedId: "7" }), "8")).toBe(false);
    expect(isOwnTicket(t("x"), undefined)).toBe(false);
  });
});

describe("bộ chọn người được giao và form", () => {
  const people: TicketAssigneeOptionResponse[] = [
    { id: "a", email: "an@example.test", fullName: "Nguyễn Văn An", roles: ["ROLE_TEACHER"] },
    { id: "b", email: "ctv@example.test", fullName: "Lê CTV", roles: ["ROLE_COLLABORATOR"] },
    { id: "c", email: "mentor@example.test", fullName: "Trợ Giảng", roles: ["ROLE_MENTOR"] },
  ];

  it("filterAssignees theo tên/email + chip vai trò; assigneeRoleLabel có nhãn cho MENTOR, mã lạ in nguyên", () => {
    expect(filterAssignees(people, "", "ALL")).toHaveLength(3);
    expect(filterAssignees(people, "CTV@", "ALL").map((p) => p.id)).toEqual(["b"]);
    expect(filterAssignees(people, "", "ROLE_TEACHER").map((p) => p.id)).toEqual(["a"]);
    expect(filterAssignees(people, "an", "ROLE_COLLABORATOR")).toEqual([]);
    expect(assigneeRoleLabel("ROLE_TEACHER")).toBe("Giảng viên");
    expect(assigneeRoleLabel("ROLE_COLLABORATOR")).toBe("Cộng tác viên");
    expect(assigneeRoleLabel("ROLE_MENTOR")).toBe("Trợ giảng");
    expect(assigneeRoleLabel("ROLE_X")).toBe("ROLE_X");
  });

  it("toggleSelection (nhiều khi tạo, một khi sửa); ticketToForm; validateTicketForm theo chế độ; ticketCombinations = người × module", () => {
    expect(toggleSelection(["a"], "b", false)).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b"], "a", false)).toEqual(["b"]);
    expect(toggleSelection(["a"], "b", true)).toEqual(["b"]);
    expect(ticketToForm(t("t1"))).toEqual({ description: "Mô tả t1", modules: ["QUIZ"], assignedIds: ["u1"] });
    expect(ticketToForm(t("t1", { module: undefined, description: undefined }))).toEqual({ description: "", modules: [], assignedIds: ["u1"] });
    expect(validateTicketForm({ description: "  ", modules: ["QUIZ"], assignedIds: ["a"] }, "add")).toBe("Vui lòng chọn ít nhất 1 người dùng, 1 module và nhập mô tả");
    expect(validateTicketForm({ description: "x", modules: [], assignedIds: ["a"] }, "edit")).toBe("Vui lòng điền đầy đủ thông tin");
    expect(validateTicketForm({ description: "x", modules: ["QUIZ"], assignedIds: ["a"] }, "add")).toBeNull();
    expect(ticketCombinations({ description: "d", modules: ["QUIZ", "WRITING"], assignedIds: ["a", "b"] })).toEqual([
      { assignedId: "a", module: "QUIZ", description: "d" },
      { assignedId: "a", module: "WRITING", description: "d" },
      { assignedId: "b", module: "QUIZ", description: "d" },
      { assignedId: "b", module: "WRITING", description: "d" },
    ]);
  });
});
