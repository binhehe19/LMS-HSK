import { beforeEach, describe, expect, it, vi } from "vitest";
import { lmsClient } from "@/lib/api/lms-client";
import { HSK_LIBRARY_LABEL, isHskLibrarySyllabus, listAllContentPackages, syllabusSourceResolver } from "@/lib/api/lms-package-list";
import { listQuizPackages } from "@/lib/api/lms-quiz-client";
import { listSyllabuses } from "@/lib/api/lms-syllabus-client";
import { packageSyllabusOptions } from "@/lib/content/content-tree-model";

vi.mock("@/lib/api/lms-client", () => ({ lmsClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/api/lms-syllabus-client", () => ({ listSyllabuses: vi.fn() }));

const get = vi.mocked(lmsClient.get);
const page = (items: unknown[], totalPages: number) => ({ items, total_elements: items.length, total_pages: totalPages, page: 0, size: 100 });
const pkg = (id: string, syllabusId: string) => ({ id, type: "ASSESSMENT", syllabusId, draftVersionId: "v", publishedVersionId: null, draftVersion: { id: "v", title: `Gói ${id}`, description: null }, publishedVersion: null });

beforeEach(() => {
  get.mockReset();
  vi.mocked(listSyllabuses).mockReset().mockResolvedValue([{ id: "syl-gt2", name: "GT2", code: "GT2-01" }, { id: "syl-noname" }]);
});

describe("lms-package-list", () => {
  it("isHskLibrarySyllabus: mọi mã giả HSK-LIBRARY*; mã thật/thiếu => false", () => {
    expect(["HSK-LIBRARY", "HSK-LIBRARY-QUIZ", "HSK-LIBRARY-SLIDE"].every(isHskLibrarySyllabus)).toBe(true);
    expect([isHskLibrarySyllabus("syl-gt2"), isHskLibrarySyllabus(null), isHskLibrarySyllabus(undefined)]).toEqual([false, false, false]);
  });

  it("listAllContentPackages: KHÔNG gửi syllabusId, size=100, đi hết các trang rồi dừng", async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}` }));
    get.mockResolvedValueOnce(page(full, 2)).mockResolvedValueOnce(page([{ id: "last" }], 2));
    const all = await listAllContentPackages<{ id: string }>("ASSESSMENT");
    expect(all).toHaveLength(101);
    expect(get.mock.calls.map(([url]) => url)).toEqual(["/content-packages?type=ASSESSMENT&page=0&size=100", "/content-packages?type=ASSESSMENT&page=1&size=100"]);
  });

  it("nguồn giáo trình: mã giả => 'Kho HSK'; mã thật => 'tên (mã)'; không có trong danh mục => mã thô; thiếu => rỗng", async () => {
    const source = await syllabusSourceResolver(["HSK-LIBRARY-QUIZ", "syl-gt2"]);
    expect(source("HSK-LIBRARY-QUIZ")).toEqual({ syllabusId: "HSK-LIBRARY-QUIZ", syllabusName: HSK_LIBRARY_LABEL });
    expect(source("syl-gt2")).toEqual({ syllabusId: "syl-gt2", syllabusName: "GT2 (GT2-01)" });
    expect(source("syl-noname").syllabusName).toBe("syl-noname");
    expect(source("syl-la").syllabusName).toBe("syl-la");
    expect(source(null)).toEqual({});
  });

  it("chỉ có gói của Kho => không gọi /syllabuses; tra tên lỗi => vẫn trả nguồn bằng mã, không ném", async () => {
    await syllabusSourceResolver(["HSK-LIBRARY", "HSK-LIBRARY-QUIZ"]);
    expect(listSyllabuses).not.toHaveBeenCalled();
    vi.mocked(listSyllabuses).mockRejectedValueOnce(new Error("CMS lỗi"));
    const source = await syllabusSourceResolver(["syl-gt2"]);
    expect(source("syl-gt2")).toEqual({ syllabusId: "syl-gt2", syllabusName: "syl-gt2" });
  });

  it("listQuizPackages: thấy cả gói Kho HSK lẫn gói gắn giáo trình thật, mỗi gói kèm nguồn", async () => {
    get.mockResolvedValueOnce(page([pkg("a", "HSK-LIBRARY-QUIZ"), pkg("b", "syl-gt2")], 1));
    const list = await listQuizPackages();
    expect(get.mock.calls[0][0]).toBe("/content-packages?type=ASSESSMENT&page=0&size=100");
    expect(list.map((p) => [p.id, p.name, p.syllabusName])).toEqual([["a", "Gói a", "Kho HSK"], ["b", "Gói b", "GT2 (GT2-01)"]]);
  });

  it("packageSyllabusOptions: gom theo giáo trình kèm số gói; gói không có giáo trình bị bỏ qua", () => {
    const base = { type: "ASSESSMENT", name: "x" };
    expect(packageSyllabusOptions([{ ...base, id: "1", syllabusId: "s1", syllabusName: "Kho HSK" }, { ...base, id: "2", syllabusId: "s2", syllabusName: "GT2" }, { ...base, id: "3", syllabusId: "s1", syllabusName: "Kho HSK" }, { ...base, id: "4" }])).toEqual([
      { id: "s1", name: "Kho HSK", count: 2 },
      { id: "s2", name: "GT2", count: 1 },
    ]);
  });
});
