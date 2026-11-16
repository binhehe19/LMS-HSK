import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ loading: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: api }));
vi.mock("sonner", () => ({ toast }));
import { syncPublishedToPackages } from "@/lib/api/library-sync-client";

beforeEach(() => vi.resetAllMocks());

const usages = [
  { linkId: "l1", packageTitle: "HSK 1", upToDate: false },
  { linkId: "l2", packageTitle: "HSK 2", upToDate: true },
  { linkId: "l3", packageTitle: "HSK 3", upToDate: false },
];

it("chỉ đồng bộ bản sao còn cũ, từng học phần một, báo tiến độ trên cùng toast", async () => {
  api.get.mockResolvedValue(usages);
  await syncPublishedToPackages("w1", "t", "Đã xuất bản.");
  expect(api.get).toHaveBeenCalledWith("/learning-resources/w1/package-usages");
  expect(api.post.mock.calls).toEqual([
    ["/learning-resources/w1/sync-to-packages", { linkIds: ["l1"] }],
    ["/learning-resources/w1/sync-to-packages", { linkIds: ["l3"] }],
  ]);
  expect(toast.loading).toHaveBeenCalledWith("Đang cập nhật học phần (2/2): HSK 3", { id: "t" });
  expect(toast.success).toHaveBeenCalledWith("Đã xuất bản. Đã cập nhật 2 học phần.", expect.objectContaining({ id: "t" }));
});

it("học phần lỗi không chặn học phần khác; báo số lỗi kèm nút thử lại", async () => {
  api.get.mockResolvedValue(usages);
  api.post.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(1);
  await syncPublishedToPackages("w1", "t", "Đã xuất bản.");
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(toast.error).toHaveBeenCalledWith("Đã lưu, chưa đồng bộ được 1 học phần.", expect.objectContaining({ id: "t", action: expect.objectContaining({ label: "Thử lại" }) }));
  expect(toast.success).not.toHaveBeenCalled();
});
