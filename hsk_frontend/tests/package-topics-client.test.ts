import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: api }));
vi.mock("@/lib/api/write-gate", () => ({ assertWriteEnabled: vi.fn() }));
import { assertWriteEnabled } from "@/lib/api/write-gate";
import { packageTopicsClient } from "@/lib/api/package-topics-client";

beforeEach(() => vi.resetAllMocks());

// Gói P: bản nháp (nếu có) và bản đã xuất bản; chủ đề của mỗi phiên bản; học liệu kèm topicId.
function backend(pkg: { draftVersionId: string | null; publishedVersionId: string | null }, topicsByVersion: Record<string, { id: string; title: string; topicOrder: number }[]>, links: Record<string, unknown[]> = {}) {
  api.get.mockImplementation(async (url: string) => {
    if (url === "/content-packages/p1") return pkg;
    const topics = /\/versions\/([^/]+)\/topics\?sessionNo=1$/.exec(url);
    if (topics) return topicsByVersion[topics[1]] ?? [];
    const resources = /\/versions\/([^/]+)\/resources\?sessionNo=1$/.exec(url);
    if (resources) return links[resources[1]] ?? [];
    throw Error("Unexpected GET " + url);
  });
  api.post.mockImplementation(async (url: string) => {
    if (url === "/content-packages/p1/draft") return { id: "draft-new" };
    return {};
  });
  api.put.mockResolvedValue({});
  api.delete.mockResolvedValue(undefined);
}

it("list: đọc bản nháp nếu có, sắp chủ đề theo thứ tự và lập bảng mục → chủ đề (bỏ mục không chủ đề)", async () => {
  backend(
    { draftVersionId: "d1", publishedVersionId: "pub1" },
    { d1: [{ id: "t2", title: "Đọc", topicOrder: 2 }, { id: "t1", title: "Nghe", topicOrder: 1 }], pub1: [] },
    { d1: [{ learningResourceId: "r1", topicId: "t1" }, { learningResourceId: "r2", topicId: null }, { learningResourceId: "r3" }] },
  );
  const state = await packageTopicsClient.list("p1");
  expect(state.topics.map((t) => t.id)).toEqual(["t1", "t2"]);
  expect(state.membership).toEqual({ r1: "t1" });
  expect(api.get.mock.calls.some(([url]) => String(url).includes("/versions/pub1"))).toBe(false);
});

it("list: không có nháp thì đọc bản đã xuất bản; không có phiên bản nào thì rỗng", async () => {
  backend({ draftVersionId: null, publishedVersionId: "pub1" }, { pub1: [{ id: "tp", title: "Bộ", topicOrder: 1 }] });
  expect((await packageTopicsClient.list("p1")).topics.map((t) => t.id)).toEqual(["tp"]);
  backend({ draftVersionId: null, publishedVersionId: null }, {});
  expect(await packageTopicsClient.list("p1")).toEqual({ topics: [], membership: {} });
});

it("create: ghi vào bản nháp ở buổi 1 và kiểm công tắc ghi", async () => {
  backend({ draftVersionId: "d1", publishedVersionId: null }, {});
  await packageTopicsClient.create("p1", "Gia đình", true);
  expect(assertWriteEnabled).toHaveBeenCalledWith("content", true);
  expect(api.post).toHaveBeenCalledWith("/content-packages/versions/d1/topics", { sessionNo: 1, title: "Gia đình" });
});

it("rename trên gói có sẵn bản nháp: giữ nguyên id chủ đề, không tạo nháp mới", async () => {
  backend({ draftVersionId: "d1", publishedVersionId: null }, {});
  await packageTopicsClient.rename("p1", { id: "t1", title: "Nghe" }, "Nghe hiểu", false);
  expect(api.put).toHaveBeenCalledWith("/content-packages/versions/d1/topics/t1", { title: "Nghe hiểu" });
  expect(api.post.mock.calls.some(([url]) => String(url).endsWith("/draft"))).toBe(false);
});

it("gói chỉ có bản đã xuất bản: lần ghi đầu tạo nháp rồi tìm lại chủ đề trong nháp theo tên (id đã đổi, không phân biệt hoa thường)", async () => {
  backend({ draftVersionId: null, publishedVersionId: "pub1" }, { "draft-new": [{ id: "t-moi", title: "Gia Đình", topicOrder: 1 }] });
  await packageTopicsClient.rename("p1", { id: "t-cu", title: "gia đình " }, "Gia đình lớn", false);
  expect(api.post).toHaveBeenCalledWith("/content-packages/p1/draft");
  expect(api.put).toHaveBeenCalledWith("/content-packages/versions/draft-new/topics/t-moi", { title: "Gia đình lớn" });
});

it("gói chỉ có bản đã xuất bản mà chủ đề không có trong nháp: báo lỗi rõ và không ghi gì", async () => {
  backend({ draftVersionId: null, publishedVersionId: "pub1" }, { "draft-new": [] });
  await expect(packageTopicsClient.remove("p1", { id: "t-cu", title: "Đã mất" }, false)).rejects.toThrow('Không tìm thấy chủ đề "Đã mất"');
  expect(api.delete).not.toHaveBeenCalled();
});

it("reorder: gửi đủ mọi chủ đề theo thứ tự mới ở buổi 1, đã đổi sang id của nháp mới", async () => {
  backend({ draftVersionId: null, publishedVersionId: "pub1" }, { "draft-new": [{ id: "n1", title: "Nghe", topicOrder: 1 }, { id: "n2", title: "Đọc", topicOrder: 2 }] });
  await packageTopicsClient.reorder("p1", [{ id: "o2", title: "Đọc" }, { id: "o1", title: "Nghe" }], false);
  expect(api.put).toHaveBeenCalledWith("/content-packages/versions/draft-new/topics/reorder", { sessionNo: 1, topicIdsInOrder: ["n2", "n1"] });
});

it("assign: gắn mục vào chủ đề (đã đổi id trên nháp mới) hoặc bỏ khỏi chủ đề bằng null, id mục không đổi", async () => {
  backend({ draftVersionId: null, publishedVersionId: "pub1" }, { "draft-new": [{ id: "n1", title: "Nghe", topicOrder: 1 }] });
  await packageTopicsClient.assign("p1", "res-1", { id: "o1", title: "Nghe" }, false);
  expect(api.put).toHaveBeenLastCalledWith("/content-packages/versions/draft-new/resources/res-1/topic", { topicId: "n1" });
  await packageTopicsClient.assign("p1", "res-1", null, false);
  expect(api.put).toHaveBeenLastCalledWith("/content-packages/versions/draft-new/resources/res-1/topic", { topicId: null });
});
