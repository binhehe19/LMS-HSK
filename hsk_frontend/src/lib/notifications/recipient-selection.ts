import type { AdminUser } from "@/types/admin-user";

/** Người đã chọn: id -> tên hiển thị (Map giữ thứ tự chọn, như bản cũ). */
export type RecipientMap = ReadonlyMap<string, string>;

/** Tên hiển thị của người nhận: họ tên, nếu không có thì email, nếu không có thì id (như bản cũ). */
export function recipientName(user: Pick<AdminUser, "id" | "email" | "fullName">): string {
  return user.fullName || user.email || user.id;
}

/** Bật/tắt chọn một người. */
export function toggleRecipient(current: RecipientMap, id: string, name?: string): Map<string, string> {
  const next = new Map(current);
  if (next.has(id)) next.delete(id);
  else next.set(id, name || id);
  return next;
}

/** Thêm nhiều người (đã chọn rồi thì giữ vị trí, cập nhật tên như bản cũ dùng Map.set). */
export function addRecipients(current: RecipientMap, users: readonly AdminUser[]): Map<string, string> {
  const next = new Map(current);
  for (const user of users) next.set(user.id, recipientName(user));
  return next;
}

export const RECIPIENT_ROLE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "Tất cả vai trò" },
  { value: "ROLE_USER", label: "Học viên (Student)" },
  { value: "ROLE_TEACHER", label: "Giảng viên (Teacher)" },
  { value: "ROLE_TEACHER_MANAGER", label: "Quản lý giảng viên (Teacher Manager)" },
  { value: "ROLE_COLLABORATOR", label: "Cộng tác viên (Collaborator)" },
];

export const stripRolePrefix = (role: string) => role.replace("ROLE_", "");

/** Nhãn nút "Chọn tất cả …" theo vai trò đang lọc. */
export function selectAllLabel(roleFilter: string): string {
  return `Chọn tất cả ${roleFilter ? stripRolePrefix(roleFilter) : "người dùng"}`;
}

/** Số người hiển thị tối đa dưới dạng chip trong form (phần còn lại gộp thành "… và N người khác"). */
export const MAX_RECIPIENT_CHIPS = 30;

/** Lớp màu của nhãn trạng thái chiến dịch trong lịch sử (như bản cũ: SUCCESS xanh, PROCESSING xanh dương, còn lại vàng). */
export function campaignStatusClass(status: string): string {
  if (status === "SUCCESS") return "bg-success bg-opacity-10 text-success";
  if (status === "PROCESSING") return "bg-info bg-opacity-10 text-info";
  return "bg-warning bg-opacity-10 text-warning";
}
