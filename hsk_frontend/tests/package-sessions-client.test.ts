import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: api }));
vi.mock("@/lib/api/write-gate", () => ({ assertWriteEnabled: vi.fn() }));
import { ApiError } from "@/lib/api/api-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import { clearPackageSession, listPackageSessionNames, renamePackageSession } from "@/lib/api/package-sessions-client";

beforeEach(() => vi.resetAllMocks());

function backend(pkg: { draftVersionId: string | null; publishedVersionId: string | null }, sessions: unknown[] | Error = []) {
  api.get.mockImplementation(async (url: string) => {
    if (url === "/content-packages/p1") return pkg;
    if (/\/versions\/[^/]+\/sessions$/.test(url)) {
      if (sessions instanceof Error) throw sessions;
      return sessions;
    }
    throw Error("Unexpected GET " + url);
  });
  api.post.mockResolvedValue({ id: "draft-new" });
  api.put.mockResolvedValue({});
  api.delete.mockResolvedValue(undefined);
}

it("list: đọc bản nháp nếu có và lập bảng số buổi → tên", async () => {
  backend({ draftVersionId: "d1", publishedVersionId: "pub1" }, [{ sessionNo: 2, title: "Bài 02" }]);
  expect(await listPackageSessionNames("p1")).toEqual({ 2: "Bài 02" });
  expect(api.get).toHaveBeenCalledWith("/content-packages/versions/d1/sessions");
});

it("list: không có phiên bản nào thì rỗng; backend chưa có API (404) thì coi như chưa có tên, lỗi khác vẫn ném", async () => {
  backend({ draftVersionId: null, publishedVersionId: null });
  expect(await listPackageSessionNames("p1")).toEqual({});
  backend({ draftVersionId: null, publishedVersionId: "pub1" }, new ApiError("not found", 404));
  expect(await listPackageSessionNames("p1")).toEqual({});
  backend({ draftVersionId: null, publishedVersionId: "pub1" }, new ApiError("boom", 500));
  await expect(listPackageSessionNames("p1")).rejects.toThrow("boom");
});

it("rename: ghi vào bản nháp hiện có theo số buổi và kiểm công tắc ghi", async () => {
  backend({ draftVersionId: "d1", publishedVersionId: null });
  await renamePackageSession("p1", 3, "Gia đình", true);
  expect(assertWriteEnabled).toHaveBeenCalledWith("content", true);
  expect(api.put).toHaveBeenCalledWith("/content-packages/versions/d1/sessions/3", { title: "Gia đình" });
  expect(api.post).not.toHaveBeenCalled();
});

it("rename/clear trên gói đã xuất bản chưa có nháp: tạo nháp rồi ghi vào nháp mới", async () => {
  backend({ draftVersionId: null, publishedVersionId: "pub1" });
  await renamePackageSession("p1", 1, "Mở đầu", false);
  expect(api.post).toHaveBeenCalledWith("/content-packages/p1/draft");
  expect(api.put).toHaveBeenCalledWith("/content-packages/versions/draft-new/sessions/1", { title: "Mở đầu" });
  await clearPackageSession("p1", 1, false);
  expect(api.delete).toHaveBeenCalledWith("/content-packages/versions/draft-new/sessions/1");
});
