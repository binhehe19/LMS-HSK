import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { usePackageEditSession } from "@/components/management/content-flat/use-package-edit-session";

const api = vi.hoisted(() => ({
  acquire: vi.fn(), draft: vi.fn(), heartbeat: vi.fn(), publish: vi.fn(), discard: vi.fn(), release: vi.fn(), releaseOnUnload: vi.fn(),
}));
vi.mock("@/lib/api/package-edit-session-client", () => ({ packageEditSessionClient: () => api }));

beforeEach(() => {
  vi.resetAllMocks();
  api.acquire.mockResolvedValue({ acquired: true });
  api.draft.mockResolvedValue({ id: "draft-1", title: "HSK" });
  api.heartbeat.mockResolvedValue({ acquired: true, saved: true });
  api.release.mockResolvedValue(undefined);
});

it("requires the lock before opening the draft and retries when the editor is locked", async () => {
  api.acquire.mockResolvedValueOnce({ acquired: false });
  const { result, unmount } = renderHook(() => usePackageEditSession("package-1"));
  await waitFor(() => expect(result.current.status).toBe("denied"));
  expect(api.draft).not.toHaveBeenCalled();
  expect(await result.current.run(undefined, undefined, "discard")).toBe(false);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(api.draft).toHaveBeenCalledOnce();
  api.release.mockClear();
  unmount();
  await waitFor(() => expect(api.release).toHaveBeenCalledOnce());
});

it("saves fields on the current draft before publishing", async () => {
  const { result } = renderHook(() => usePackageEditSession("package-1"));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    expect(await result.current.run({ title: "Updated", description: "", sessionCount: 5 }, undefined, "publish")).toBe(true);
  });
  expect(api.heartbeat).toHaveBeenCalledWith({ versionId: "draft-1", title: "Updated", description: "", sessionCount: 5 });
  expect(api.publish).toHaveBeenCalledExactlyOnceWith("draft-1");
  expect(api.heartbeat.mock.invocationCallOrder[0]).toBeLessThan(api.publish.mock.invocationCallOrder[0]);
  expect(result.current.hasLock()).toBe(false);
});

it("drops write access and preserves the draft when a heartbeat is denied", async () => {
  const { result } = renderHook(() => usePackageEditSession("package-1"));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  api.heartbeat.mockResolvedValueOnce({ acquired: false, saved: false });
  await act(async () => {
    expect(await result.current.run(undefined, undefined, "discard")).toBe(false);
  });
  expect(api.discard).not.toHaveBeenCalled();
  expect(result.current.status).toBe("lost");
  expect(result.current.draft?.id).toBe("draft-1");
});

it("discards the current draft without saving local fields or publishing", async () => {
  const { result } = renderHook(() => usePackageEditSession("package-1"));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    expect(await result.current.run(undefined, undefined, "discard")).toBe(true);
  });
  expect(api.heartbeat).toHaveBeenCalledExactlyOnceWith(undefined);
  expect(api.discard).toHaveBeenCalledOnce();
  expect(api.publish).not.toHaveBeenCalled();
  expect(result.current.hasLock()).toBe(false);
});

it("releases the lock on pagehide and blocks further draft writes", async () => {
  const { result } = renderHook(() => usePackageEditSession("package-1"));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  act(() => { window.dispatchEvent(new Event("pagehide")); });
  expect(api.releaseOnUnload).toHaveBeenCalledOnce();
  expect(result.current.status).toBe("lost");
  expect(await result.current.run()).toBe(false);
  expect(api.heartbeat).not.toHaveBeenCalled();
});
