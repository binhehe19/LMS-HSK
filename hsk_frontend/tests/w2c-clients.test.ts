import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { createStorageVideo, listStorageFolders, listStoragePackages, setStoragePackagePublished } from "@/lib/api/hsk-storage-client";
import { deleteOnlineCourse, listOnlineCourseLeads, listOnlineCourses, startOnlineSync, updateOnlineCourse } from "@/lib/api/online-course-client";
import { WriteDisabledError } from "@/lib/api/write-gate";

const okResponse = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: body }), { status: 200 }));

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk"));
afterEach(() => vi.unstubAllGlobals());

describe("online-course-client (hợp đồng đề xuất /online-learning/*)", () => {
  it("chưa cấu hình NEXT_PUBLIC_HSK_API_BASE_PATH => ApiNotConfiguredError, KHÔNG gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(listOnlineCourses()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(listOnlineCourseLeads({ page: 0, size: 20 })).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("listOnlineCourseLeads chỉ gửi tham số có giá trị + sort cố định registeredAt,desc; dùng cookie", async () => {
    const fetchMock = okResponse({ content: [], totalElements: 0, totalPages: 1, size: 20, number: 0 });
    vi.stubGlobal("fetch", fetchMock);
    await listOnlineCourseLeads({ courseCode: "H 40", from: "2026-10-01", page: 2, size: 20 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/hsk/online-learning/leads?courseCode=H+40&from=2026-10-01&page=2&size=20&sort=registeredAt%2Cdesc");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("thao tác ghi bị công tắc 'online-course' đóng => WriteDisabledError, không có request", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_ONLINE_COURSE", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(() => updateOnlineCourse("oc-1", { name: "x" }, false)).toThrow(WriteDisabledError);
    expect(() => deleteOnlineCourse("oc-1", false)).toThrow(WriteDisabledError);
    expect(() => startOnlineSync(false)).toThrow(WriteDisabledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("demo mở công tắc: PUT /courses/{id} có body JSON, DELETE đúng URL (id được mã hoá), POST /sync/all", async () => {
    const fetchMock = okResponse({ id: "oc 1" });
    vi.stubGlobal("fetch", fetchMock);
    await updateOnlineCourse("oc 1", { name: "Mới", price: 10 }, true);
    await deleteOnlineCourse("oc 1", true);
    await startOnlineSync(true);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/hsk/online-learning/courses/oc%201");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PUT", body: JSON.stringify({ name: "Mới", price: 10 }) });
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/hsk/online-learning/sync/all");
    expect(fetchMock.mock.calls[2][1].method).toBe("POST");
  });
});

describe("hsk-storage-client (kho đa phương tiện riêng của HSK, /storage/*)", () => {
  it("đọc: packages?type=VIDEO_COURSE mặc định, folders?packageId mã hoá", async () => {
    const fetchMock = okResponse([]);
    vi.stubGlobal("fetch", fetchMock);
    await listStoragePackages();
    await listStorageFolders("pk/1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/hsk/storage/packages?type=VIDEO_COURSE");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/hsk/storage/folders?packageId=pk%2F1");
  });

  it("ghi (công tắc 'storage' mở bằng cờ): POST /videos {studySetId, fileId, title}; publish/unpublish đúng hậu tố; đóng => WriteDisabledError", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_STORAGE", "enabled");
    const fetchMock = okResponse({ id: "v1" });
    vi.stubGlobal("fetch", fetchMock);
    await createStorageVideo({ studySetId: "s1", fileId: "f1", title: "Video" }, false);
    await setStoragePackagePublished("p1", true, false);
    await setStoragePackagePublished("p1", false, false);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/hsk/storage/videos");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ studySetId: "s1", fileId: "f1", title: "Video" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/hsk/storage/packages/p1/publish");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/hsk/storage/packages/p1/unpublish");
    vi.stubEnv("NEXT_PUBLIC_WRITE_STORAGE", "");
    expect(() => createStorageVideo({ studySetId: "s1", fileId: "f1", title: "Video" }, false)).toThrow(WriteDisabledError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
