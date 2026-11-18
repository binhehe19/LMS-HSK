import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { createFolder, createItem, createItemsBulk, createPackage, deleteItem, getStudySet, listFolders, listItems, listPackages, listStudySets, publishPackage, searchItems, unpublishPackage, updateItem, updateStudySet, type ContentApiTarget } from "@/lib/api/content-tree-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import type { FlashcardCard } from "@/types/content-flashcard";

const flashcard: ContentApiTarget = { apiPrefix: "/flashcard", itemsPath: "cards" };
const grammar: ContentApiTarget = { apiPrefix: "/grammar/", itemsPath: "/grammar-points" };

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
const lastCall = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined, credentials: init.credentials };
};

afterEach(() => vi.unstubAllGlobals());

describe("content-tree-client — URL theo config (prefix + itemsPath), hợp đồng đề xuất", () => {
  it("chưa cấu hình NEXT_PUBLIC_HSK_API_BASE_PATH => ApiNotConfiguredError và KHÔNG gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(listPackages(flashcard)).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(listItems(flashcard, "s1")).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("đọc: packages / folders?packageId / study-sets?folderId / study-sets/{id} / {itemsPath}?studySetId / search — GET, cookie, mã hoá id", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    const fetchMock = respond(200, { success: true, data: [] });
    vi.stubGlobal("fetch", fetchMock);
    await listPackages(flashcard);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/packages", method: "GET", credentials: "include" });
    await listFolders(flashcard, "p 1");
    expect(lastCall(fetchMock).url).toBe("/api/hsk/flashcard/folders?packageId=p%201");
    await listStudySets(flashcard, "f/1");
    expect(lastCall(fetchMock).url).toBe("/api/hsk/flashcard/study-sets?folderId=f%2F1");
    await getStudySet(flashcard, "s1");
    expect(lastCall(fetchMock).url).toBe("/api/hsk/flashcard/study-sets/s1");
    await listItems(flashcard, "s1");
    expect(lastCall(fetchMock).url).toBe("/api/hsk/flashcard/cards?studySetId=s1");
    await searchItems(flashcard, "nǐ hǎo", 2, 20);
    expect(lastCall(fetchMock).url).toBe(`/api/hsk/flashcard/cards/search?q=${encodeURIComponent("nǐ hǎo")}&page=2&size=20`);
  });

  it("module khác chỉ đổi config: dấu '/' thừa ở prefix/itemsPath được chuẩn hoá", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "http://lms.test.invalid/api/hsk/");
    const fetchMock = respond(200, []);
    vi.stubGlobal("fetch", fetchMock);
    await listItems(grammar, "s9");
    expect(lastCall(fetchMock).url).toBe("http://lms.test.invalid/api/hsk/grammar/grammar-points?studySetId=s9");
    await listPackages(grammar);
    expect(lastCall(fetchMock).url).toBe("http://lms.test.invalid/api/hsk/grammar/packages");
  });

  it("ghi khi công tắc ĐÓNG (không demo, NEXT_PUBLIC_WRITE_CONTENT=disabled): WriteDisabledError, KHÔNG có request", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "disabled");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(() => createPackage(flashcard, { name: "A", type: "FREE" }, false)).toThrow(WriteDisabledError);
    expect(() => publishPackage(flashcard, "p1", false)).toThrow(WriteDisabledError);
    expect(() => deleteItem(flashcard, "c1", false)).toThrow(WriteDisabledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ghi khi công tắc MỞ bằng cờ: POST/PUT/DELETE đúng đường dẫn và body; bulk gửi {studySetId, items}; createItem gộp studySetId vào body", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    const fetchMock = respond(200, { success: true, data: { id: "x" } });
    vi.stubGlobal("fetch", fetchMock);
    await createPackage(flashcard, { name: "A", type: "FREE", description: "d" }, false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/packages", method: "POST", body: { name: "A", type: "FREE", description: "d" } });
    await createFolder(flashcard, { packageId: "p1", name: "F", isPrivate: false }, false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/folders", method: "POST", body: { packageId: "p1", name: "F" } });
    await updateStudySet(flashcard, "s1", { folderId: "f1", title: "T", isPrivate: true }, false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/study-sets/s1", method: "PUT", body: { folderId: "f1", title: "T" } });
    await createItem<FlashcardCard>(flashcard, "s1", { term: "你", meaning: "bạn", index: 3 }, false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/cards", method: "POST", body: { studySetId: "s1", term: "你", meaning: "bạn", index: 3 } });
    await createItemsBulk<FlashcardCard>(flashcard, "s1", [{ term: "一", meaning: "một" }], false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/cards/bulk", method: "POST", body: { studySetId: "s1", items: [{ term: "一", meaning: "một" }] } });
    await updateItem<FlashcardCard>(flashcard, "c 1", { term: "二", meaning: "hai" }, false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/cards/c%201", method: "PUT" });
    await deleteItem(flashcard, "c1", false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/cards/c1", method: "DELETE" });
    await unpublishPackage(flashcard, "p1", false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/packages/p1/unpublish", method: "POST" });
  });

  it("chế độ demo mở công tắc dù không có cờ", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "disabled");
    const fetchMock = respond(200, { success: true, data: { id: "p1" } });
    vi.stubGlobal("fetch", fetchMock);
    await publishPackage(flashcard, "p1", true);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/flashcard/packages/p1/publish", method: "POST" });
  });

  it.each([403, 404, 409, 500])("HTTP %i => ApiError mang đúng status", async (status) => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubGlobal("fetch", respond(status, ""));
    await expect(listPackages(flashcard)).rejects.toMatchObject({ name: "ApiError", status });
  });

  it("phản hồi bọc {success,data} được bóc; thông điệp lỗi của máy chủ được giữ", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubGlobal("fetch", respond(200, { success: true, data: [{ id: "p1", name: "A", type: "FREE" }] }));
    await expect(listPackages(flashcard)).resolves.toEqual([{ id: "p1", name: "A", type: "FREE" }]);
    vi.stubGlobal("fetch", respond(400, { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "Thiếu tên gói (MOCK)" }));
    const error = await listPackages(flashcard).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("Thiếu tên gói (MOCK)");
    expect((error as ApiError).errorCode).toBe("VALIDATION_ERROR");
  });
});
