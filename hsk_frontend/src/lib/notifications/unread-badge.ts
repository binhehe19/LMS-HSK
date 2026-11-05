/** Nhãn huy hiệu chưa đọc: ẩn khi 0/không xác định, "99+" khi vượt 99 (như bản cũ). */
export function formatUnreadBadge(count: number | null): string | null {
  if (count === null || !Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}
