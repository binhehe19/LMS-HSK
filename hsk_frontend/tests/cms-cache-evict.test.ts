import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: api, isLmsApiConfigured: () => true }));
vi.mock("sonner", () => ({ toast }));
import { getSyllabus, listSyllabuses, requestCmsCacheEvict } from "@/lib/api/lms-syllabus-client";

beforeEach(() => vi.resetAllMocks());

it("nút Tải lại: xoá cache ERP xong mới gọi lại API giáo trình", async () => {
  const order: string[] = [];
  let finishEvict: () => void = () => {};
  api.post.mockImplementation((path: string) => {
    order.push(`post ${path}`);
    return new Promise<void>((resolve) => { finishEvict = () => { order.push("evicted"); resolve(); }; });
  });
  api.get.mockImplementation(async (path: string) => { order.push(`get ${path}`); return path === "/syllabuses" ? [] : { id: "s1" }; });

  void requestCmsCacheEvict();
  const list = listSyllabuses();
  const detail = getSyllabus("s1");
  await Promise.resolve();
  expect(api.get).not.toHaveBeenCalled(); // chưa xoá xong thì chưa đọc
  finishEvict();
  await Promise.all([list, detail]);
  expect(order).toEqual(["post /syllabuses/cache/evict", "evicted", "get /syllabuses", "get /syllabuses/s1"]);
});

it("xoá cache lỗi (vd. không có quyền) thì báo cảnh báo nhưng vẫn tải dữ liệu", async () => {
  api.post.mockRejectedValue(new Error("403"));
  api.get.mockResolvedValue([]);
  await requestCmsCacheEvict();
  await expect(listSyllabuses()).resolves.toEqual([]);
  expect(toast.warning).toHaveBeenCalledTimes(1);
});

it("không bấm Tải lại thì đọc thẳng, không gọi xoá cache", async () => {
  api.get.mockResolvedValue([]);
  await listSyllabuses();
  expect(api.post).not.toHaveBeenCalled();
});
