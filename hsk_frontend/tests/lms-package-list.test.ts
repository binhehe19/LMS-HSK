import { beforeEach, describe, expect, it, vi } from "vitest";
import { lmsClient } from "@/lib/api/lms-client";
import { listFreeContentPackages } from "@/lib/api/lms-package-list";
import { listQuizPackages } from "@/lib/api/lms-quiz-client";

vi.mock("@/lib/api/lms-client", () => ({ lmsClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const get = vi.mocked(lmsClient.get);
const post = vi.mocked(lmsClient.post);
const page = (items: unknown[], totalPages: number) => ({ items, total_elements: items.length, total_pages: totalPages, page: 0, size: 100 });
const pkg = (id: string) => ({ id, type: "ASSESSMENT", syllabusId: null, draftVersionId: "v", publishedVersionId: null, draftVersion: { id: "v", title: `Gói ${id}`, description: null }, publishedVersion: null });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("lms-package-list", () => {
  it("listFreeContentPackages: xin học phần tự do (library=true), không gửi syllabusId, size=100, đi hết các trang rồi dừng", async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}` }));
    get.mockResolvedValueOnce(page(full, 2)).mockResolvedValueOnce(page([{ id: "last" }], 2));
    const all = await listFreeContentPackages<{ id: string }>("ASSESSMENT");
    expect(all).toHaveLength(101);
    expect(get.mock.calls.map(([url]) => url)).toEqual([
      "/content-packages?type=ASSESSMENT&library=true&page=0&size=100",
      "/content-packages?type=ASSESSMENT&library=true&page=1&size=100",
    ]);
  });

  it("listQuizPackages: liệt kê qua library=true và không gắn thông tin giáo trình vào gói", async () => {
    get.mockResolvedValueOnce(page([pkg("a"), pkg("b")], 1));
    const list = await listQuizPackages();
    expect(get.mock.calls[0][0]).toBe("/content-packages?type=ASSESSMENT&library=true&page=0&size=100");
    expect(list.map((p) => [p.id, p.name])).toEqual([["a", "Gói a"], ["b", "Gói b"]]);
    expect(list.every((p) => !("syllabusId" in p) && !("syllabusName" in p))).toBe(true);
  });
});
