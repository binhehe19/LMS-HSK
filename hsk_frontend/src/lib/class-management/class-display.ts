// Hàm thuần của màn hình quản lý lớp (Admin) — NGUYÊN VĂN từ LMS_Frontend/src/features/admin/class-management/
// admin-class-management-page.tsx, chỉ thêm 'export' để kiểm thử được.

export const display = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

export const fmtDate = (d?: string): string => {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN");
};

export const computeShift = (startTime?: string, duration?: number | string): string => {
  if (!startTime) return "—";
  const dur = typeof duration === "string" ? parseInt(duration, 10) : (duration ?? 0);
  if (!dur) return startTime;
  const [h, m] = startTime.split(":").map(Number);
  const totalMin = h * 60 + m + dur;
  const eh = Math.floor(totalMin / 60) % 24;
  const em = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} – ${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
};

export const computeLateDays = (endDate?: string, actualEndDate?: string): number | null => {
  if (!actualEndDate || !endDate) return null;
  const diff = new Date(actualEndDate).getTime() - new Date(endDate).getTime();
  return Math.round(diff / 86400000);
};

export const computeStatus = (startDate?: string, endDate?: string, actualEndDate?: string): string => {
  if (actualEndDate) return "Đã kết thúc";
  const now = new Date();
  if (startDate && new Date(startDate) > now) return "Sắp khai giảng";
  if (endDate && new Date(endDate) < now) return "Đã kết thúc";
  return "Đang học";
};

export const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  "Đang học":        { color: "#0d6efd", bg: "#e7f0ff" },
  "Đã kết thúc":    { color: "#6c757d", bg: "#f0f0f0" },
  "Sắp khai giảng": { color: "#198754", bg: "#e8f5e9" },
};
