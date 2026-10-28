import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/auth/roles";
import { CONTENT_MODULE_LABEL, canManageContent, canPublishContent, type ContentAccessTicket } from "@/lib/tickets/ticket-access";

const tickets: ContentAccessTicket[] = [
  { status: "OPEN", assignedId: "gv-1", module: "WRITING" },
  { status: "DONE", assignedId: "gv-1", module: "QUIZ" },
  { status: "CLOSE", assignedId: "gv-1", module: "GRAMMAR" },
  { status: "OPEN", assignedId: "gv-2", module: "FLASHCARD" },
  { status: "OPEN", assignedId: 7, module: "DICTIONARY" },
];

describe("quyền nội dung theo ticket (quy tắc use-ticket-access của HSK cũ)", () => {
  it("Admin và Teacher-manager luôn có quyền, kể cả không có ticket", () => {
    expect(canManageContent([ROLES.ADMIN], "x", [], "QUIZ")).toBe(true);
    expect(canManageContent([ROLES.TEACHER_MANAGER], undefined, [], "QUIZ")).toBe(true);
  });

  it("Giảng viên/Mentor/Cộng tác viên: cần ticket OPEN hoặc DONE đúng module giao cho chính mình", () => {
    expect(canManageContent([ROLES.TEACHER], "gv-1", tickets, "WRITING")).toBe(true); // OPEN
    expect(canManageContent([ROLES.MENTOR], "gv-1", tickets, "QUIZ")).toBe(true); // DONE
    expect(canManageContent([ROLES.COLLABORATOR], "gv-1", tickets, "GRAMMAR")).toBe(false); // CLOSE
    expect(canManageContent([ROLES.TEACHER], "gv-1", tickets, "FLASHCARD")).toBe(false); // của người khác
    expect(canManageContent([ROLES.TEACHER], "gv-1", tickets, "PRONUNCIATION")).toBe(false); // không có ticket
  });

  it("so sánh assignedId dạng chuỗi (backend có thể trả số)", () => {
    expect(canManageContent([ROLES.TEACHER], 7, tickets, "DICTIONARY")).toBe(true);
    expect(canManageContent([ROLES.TEACHER], "7", tickets, "DICTIONARY")).toBe(true);
  });

  it("vai trò khác (học viên, không role) hoặc thiếu userId => không có quyền", () => {
    expect(canManageContent([ROLES.USER], "gv-1", tickets, "WRITING")).toBe(false);
    expect(canManageContent([], "gv-1", tickets, "WRITING")).toBe(false);
    expect(canManageContent(undefined, "gv-1", tickets, "WRITING")).toBe(false);
    expect(canManageContent([ROLES.TEACHER], undefined, tickets, "WRITING")).toBe(false);
    expect(canManageContent([ROLES.TEACHER], "", tickets, "WRITING")).toBe(false);
  });

  it("publish/unpublish chỉ Admin/Teacher-manager", () => {
    expect(canPublishContent([ROLES.ADMIN])).toBe(true);
    expect(canPublishContent([ROLES.TEACHER_MANAGER])).toBe(true);
    expect(canPublishContent([ROLES.TEACHER])).toBe(false);
    expect(canPublishContent([ROLES.TEACHER, ROLES.MENTOR])).toBe(false);
  });

  it("mọi module đều có nhãn tiếng Việt", () => {
    for (const label of Object.values(CONTENT_MODULE_LABEL)) expect(label.length).toBeGreaterThan(0);
    expect(CONTENT_MODULE_LABEL.WRITING).toContain("Hán tự");
  });
});
