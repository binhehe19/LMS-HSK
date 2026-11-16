import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminClasses } from "@/components/management/class-management/use-admin-classes";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { listAdminGradingClasses } from "@/lib/api/quiz-grading-client";
import { classesFixture } from "./fixtures/classes";

vi.mock("@/lib/api/quiz-grading-client", () => ({ listAdminGradingClasses: vi.fn() }));
const listMock = vi.mocked(listAdminGradingClasses);

beforeEach(() => listMock.mockReset());

describe("useAdminClasses (ánh xạ kết quả API sang trạng thái màn hình)", () => {
  it("bắt đầu ở loading rồi ok với danh sách", async () => {
    listMock.mockResolvedValue(classesFixture);
    const { result } = renderHook(() => useAdminClasses());
    expect(result.current.state).toEqual({ kind: "loading" });
    await waitFor(() => expect(result.current.state).toEqual({ kind: "ok", classes: classesFixture }));
  });

  it("service chưa cấu hình => not-integrated (WAITING FOR BACKEND), không phải error", async () => {
    listMock.mockRejectedValue(new ApiNotConfiguredError());
    const { result } = renderHook(() => useAdminClasses());
    await waitFor(() => expect(result.current.state.kind).toBe("not-integrated"));
    expect(JSON.stringify(result.current.state)).toContain("WAITING FOR BACKEND");
  });

  it("ApiError => error mang thông báo của lỗi", async () => {
    listMock.mockRejectedValue(new ApiError("Máy chủ lỗi", 500));
    const { result } = renderHook(() => useAdminClasses());
    await waitFor(() => expect(result.current.state).toEqual({ kind: "error", message: "Máy chủ lỗi" }));
  });

  it("phản hồi không phải mảng => error (không im lặng coi là rỗng)", async () => {
    listMock.mockResolvedValue({ items: [] } as never);
    const { result } = renderHook(() => useAdminClasses());
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
  });

  it("lỗi không xác định => error với thông báo chung", async () => {
    listMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAdminClasses());
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
  });

  it("reload quay lại loading rồi gọi API lần nữa", async () => {
    listMock.mockRejectedValueOnce(new ApiError("lỗi", 500)).mockResolvedValueOnce(classesFixture);
    const { result } = renderHook(() => useAdminClasses());
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    act(() => result.current.reload());
    expect(result.current.state).toEqual({ kind: "loading" });
    await waitFor(() => expect(result.current.state.kind).toBe("ok"));
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
