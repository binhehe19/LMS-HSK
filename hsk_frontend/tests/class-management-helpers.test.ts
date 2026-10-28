import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeLateDays,
  computeShift,
  computeStatus,
  display,
  fmtDate,
} from "@/lib/class-management/class-display";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T05:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("hàm thuần của màn hình quản lý lớp (nguyên văn bản cũ)", () => {
  it("display: rỗng/null/undefined => dấu gạch", () => {
    expect(display(undefined)).toBe("—");
    expect(display(null)).toBe("—");
    expect(display("")).toBe("—");
    expect(display(0)).toBe("0");
  });

  it("fmtDate: ngày hợp lệ theo vi-VN, không hợp lệ => dấu gạch", () => {
    expect(fmtDate("2026-09-01")).toBe(new Date("2026-09-01").toLocaleDateString("vi-VN"));
    expect(fmtDate(undefined)).toBe("—");
    expect(fmtDate("không phải ngày")).toBe("—");
  });

  it("computeShift: cộng thời lượng vào giờ bắt đầu, hỗ trợ duration dạng chuỗi", () => {
    expect(computeShift("19:00", 90)).toBe("19:00 – 20:30");
    expect(computeShift("08:30", "120")).toBe("08:30 – 10:30");
    expect(computeShift("23:30", 60)).toBe("23:30 – 00:30");
    expect(computeShift("19:00", 0)).toBe("19:00");
    expect(computeShift(undefined, 90)).toBe("—");
  });

  it("computeLateDays", () => {
    expect(computeLateDays("2026-06-30", "2026-07-09")).toBe(9);
    expect(computeLateDays("2026-06-30", "2026-06-30")).toBe(0);
    expect(computeLateDays("2026-06-30", undefined)).toBeNull();
  });

  it("computeStatus (hôm nay 2026-10-23)", () => {
    expect(computeStatus("2026-09-01", "2026-12-31")).toBe("Đang học");
    expect(computeStatus("2027-01-10", "2027-04-30")).toBe("Sắp khai giảng");
    expect(computeStatus("2026-03-01", "2026-06-30")).toBe("Đã kết thúc");
    expect(computeStatus("2026-09-01", "2026-12-31", "2026-10-01")).toBe("Đã kết thúc");
  });
});
