import { describe, expect, it } from "vitest";
import {
  EMPTY_MEMBERSHIP_FORM,
  ITEM_TYPE_META,
  PAYMENT_STATUS_META,
  buyerDisplayName,
  buyerInitial,
  filterTransactions,
  formatCurrency,
  formatPaidAt,
  formatPlanPrice,
  membershipStatusMeta,
  normalizeItemType,
  normalizeStatus,
  planToForm,
  transactionTypes,
  truncateDescription,
  validateMembershipPlan,
} from "@/lib/payment/payment-model";
import type { TransactionReportItem } from "@/types/payment";

const nbsp = (s: string) => s.replace(/ /g, " ");
const tx = (code: number, over: Partial<TransactionReportItem> = {}): TransactionReportItem => ({
  orderId: `o${code}`, orderCode: code, status: "COMPLETED", createdAt: "2026-10-20T08:00:00", paidAt: "2026-10-20T09:15:00", totalPrice: 1500000,
  buyer: { userId: "u1", username: "anng", fullName: "Nguyễn Văn An", email: "an@example.test" },
  courses: [{ packageId: "c1", packageName: "HSK 4 — H40", price: 1500000 }],
  ...over,
});

describe("định dạng tiền và ngày (currency-formatter + moment của bản cũ)", () => {
  it("formatCurrency vi-VN VND; formatPlanPrice 'x ₫'; formatPaidAt DD/MM/YYYY HH:mm hoặc '-'", () => {
    expect(nbsp(formatCurrency(1500000))).toBe("1.500.000 ₫");
    expect(nbsp(formatCurrency(0))).toBe("0 ₫");
    expect(nbsp(formatPlanPrice(199000))).toBe("199.000 ₫");
    expect(formatPaidAt("2026-10-20T09:15:00")).toBe("20/10/2026 09:15");
    expect(formatPaidAt(undefined)).toBe("-");
  });
});

describe("trạng thái và loại mục", () => {
  it("normalizeStatus: PAID => COMPLETED, lạ/thiếu => PENDING; meta đủ 4 trạng thái", () => {
    expect(normalizeStatus("paid")).toBe("COMPLETED");
    expect(normalizeStatus("COMPLETED")).toBe("COMPLETED");
    expect(normalizeStatus("PAYING")).toBe("PAYING");
    expect(normalizeStatus("CANCELLED")).toBe("CANCELLED");
    expect(normalizeStatus("weird")).toBe("PENDING");
    expect(normalizeStatus(undefined)).toBe("PENDING");
    expect(PAYMENT_STATUS_META.COMPLETED.label).toBe("Hoàn thành");
    expect(PAYMENT_STATUS_META.CANCELLED.className).toContain("text-danger");
  });

  it("normalizeItemType chỉ nhận MEMBERSHIP (không phân biệt hoa/thường), còn lại COURSE; transactionTypes không trùng, giữ thứ tự", () => {
    expect(normalizeItemType({ itemType: "membership" })).toBe("MEMBERSHIP");
    expect(normalizeItemType({ itemType: "COURSE" })).toBe("COURSE");
    expect(normalizeItemType(undefined)).toBe("COURSE");
    expect(transactionTypes([{ packageId: "a", packageName: "A", price: 1, itemType: "MEMBERSHIP" }, { packageId: "b", packageName: "B", price: 1 }, { packageId: "c", packageName: "C", price: 1, itemType: "MEMBERSHIP" }])).toEqual(["MEMBERSHIP", "COURSE"]);
    expect(transactionTypes(undefined)).toEqual([]);
    expect(ITEM_TYPE_META.MEMBERSHIP).toEqual({ label: "Trả phí", color: "gold" });
  });

  it("filterTransactions theo loại và từ khoá (mã đơn, người mua, email, trạng thái, tên mục) trên trang hiện tại", () => {
    const list = [tx(1), tx(2, { courses: [{ packageId: "m1", packageName: "VIP 1 tháng", price: 199000, itemType: "MEMBERSHIP" }], buyer: { userId: "u2", username: "binh", fullName: "Trần Thị Bình" } }), tx(3, { status: "CANCELLED" })];
    expect(filterTransactions(list, "", "ALL")).toHaveLength(3);
    expect(filterTransactions(list, "", "MEMBERSHIP").map((x) => x.orderCode)).toEqual([2]);
    expect(filterTransactions(list, "vip 1", "ALL").map((x) => x.orderCode)).toEqual([2]);
    expect(filterTransactions(list, "bình", "ALL").map((x) => x.orderCode)).toEqual([2]);
    expect(filterTransactions(list, "an@example", "ALL").map((x) => x.orderCode)).toEqual([1, 3]);
    expect(filterTransactions(list, "cancelled", "ALL").map((x) => x.orderCode)).toEqual([3]);
    expect(filterTransactions(list, "3", "MEMBERSHIP")).toEqual([]);
  });

  it("buyerDisplayName ưu tiên họ tên rồi username; buyerInitial từ username, thiếu => ?", () => {
    expect(buyerDisplayName({ userId: "u", username: "anng", fullName: "Nguyễn Văn An" })).toBe("Nguyễn Văn An");
    expect(buyerDisplayName({ userId: "u", username: "anng" })).toBe("anng");
    expect(buyerDisplayName(undefined)).toBe("—");
    expect(buyerInitial({ userId: "u", username: "anng" })).toBe("A");
    expect(buyerInitial(undefined)).toBe("?");
  });
});

describe("gói thành viên", () => {
  it("validateMembershipPlan: thiếu tên / giá <= 0 => thông điệp cũ; thời hạn < 1 => lỗi riêng; hợp lệ => null", () => {
    expect(validateMembershipPlan({ ...EMPTY_MEMBERSHIP_FORM, name: "  ", price: 100 })).toBe("Vui lòng điền đầy đủ tên và giá hợp lệ");
    expect(validateMembershipPlan({ ...EMPTY_MEMBERSHIP_FORM, name: "VIP", price: 0 })).toBe("Vui lòng điền đầy đủ tên và giá hợp lệ");
    expect(validateMembershipPlan({ ...EMPTY_MEMBERSHIP_FORM, name: "VIP", price: 1000, durationInDays: 0 })).toBe("Thời hạn phải là số ngày nguyên, tối thiểu 1");
    expect(validateMembershipPlan({ ...EMPTY_MEMBERSHIP_FORM, name: "VIP", price: 1000 })).toBeNull();
  });

  it("planToForm, truncateDescription (40 ký tự), membershipStatusMeta", () => {
    expect(planToForm({ id: "p", name: "VIP", description: "D", price: 5, durationInDays: 7, active: false })).toEqual({ name: "VIP", description: "D", price: 5, durationInDays: 7, active: false });
    expect(truncateDescription("a".repeat(41))).toBe(`${"a".repeat(40)}...`);
    expect(truncateDescription("ngắn")).toBe("ngắn");
    expect(truncateDescription(undefined)).toBe("");
    expect(membershipStatusMeta(true)).toEqual({ label: "Đang bán", className: "bg-success-light text-success" });
    expect(membershipStatusMeta(false).label).toBe("Đã ẩn");
  });
});
