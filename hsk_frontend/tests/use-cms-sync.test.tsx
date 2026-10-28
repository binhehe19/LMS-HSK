import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYNC_IDLE_MESSAGE, useCmsSync } from "@/components/management/teacher-management/use-cms-sync";
import { ApiError } from "@/lib/api/api-client";
import { fetchTeacherJobStatus, syncTeachersFromCms } from "@/lib/api/teacher-management-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import { doneJob, processingJob } from "./fixtures/teachers";

vi.mock("@/lib/api/teacher-management-client", () => ({ syncTeachersFromCms: vi.fn(), fetchTeacherJobStatus: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const fast = { pollMs: 5, autoCloseMs: 20 };

beforeEach(() => {
  vi.mocked(syncTeachersFromCms).mockReset();
  vi.mocked(fetchTeacherJobStatus).mockReset();
  for (const fn of [toast.success, toast.error]) vi.mocked(fn).mockClear();
});

describe("useCmsSync — máy trạng thái modal Đồng bộ CMS", () => {
  it("mở modal => idle với thông điệp của bản cũ; đóng được khi không chạy", () => {
    const { result } = renderHook(() => useCmsSync(true, vi.fn(), fast));
    expect(result.current.open).toBe(false);
    act(() => result.current.openModal());
    expect(result.current.open).toBe(true);
    expect(result.current.state).toEqual({ phase: "idle", progress: 0, message: SYNC_IDLE_MESSAGE });
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });

  it("job PROCESSING rồi DONE: running (tiến trình tăng, dừng ≤ 90) → success 100% với thông điệp của máy chủ, gọi onSynced, toast, tự đóng", async () => {
    vi.mocked(syncTeachersFromCms).mockResolvedValue({ jobId: "sync-1", status: "PROCESSING" });
    vi.mocked(fetchTeacherJobStatus).mockResolvedValueOnce(processingJob).mockResolvedValueOnce(processingJob).mockResolvedValue(doneJob);
    const onSynced = vi.fn();
    // autoCloseMs đủ dài để quan sát được pha success trước khi modal tự đóng (20ms là quá ngắn khi máy bận).
    const { result } = renderHook(() => useCmsSync(true, onSynced, { pollMs: 5, autoCloseMs: 400 }));
    act(() => result.current.openModal());
    act(() => void result.current.start());
    await waitFor(() => expect(result.current.state.phase).toBe("running"));
    expect(result.current.syncing).toBe(true);
    await waitFor(() => expect(result.current.state.phase).toBe("success"));
    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.message).toBe(doneJob.message);
    expect(fetchTeacherJobStatus).toHaveBeenCalledTimes(3);
    expect(onSynced).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Đồng bộ CMS thành công", { id: "teacher-sync" });
    await waitFor(() => expect(result.current.open).toBe(false));
    expect(result.current.state.phase).toBe("idle");
  });

  it("POST /sync trả DONE ngay => success không cần hỏi trạng thái", async () => {
    vi.mocked(syncTeachersFromCms).mockResolvedValue({ jobId: "sync-2", status: "DONE", message: "Không có gì mới" });
    const { result } = renderHook(() => useCmsSync(true, vi.fn(), fast));
    act(() => result.current.openModal());
    await act(async () => result.current.start());
    expect(result.current.state).toMatchObject({ phase: "success", progress: 100, message: "Không có gì mới" });
    expect(fetchTeacherJobStatus).not.toHaveBeenCalled();
  });

  it("job FAILED => error với thông điệp máy chủ, tiến trình ≥ 25, toast lỗi, không gọi onSynced; Thử lại chạy được", async () => {
    vi.mocked(syncTeachersFromCms).mockResolvedValue({ jobId: "sync-3", status: "PROCESSING" });
    vi.mocked(fetchTeacherJobStatus).mockResolvedValue({ ...processingJob, status: "FAILED", inProgress: false, message: "CMS không phản hồi" });
    const onSynced = vi.fn();
    const { result } = renderHook(() => useCmsSync(true, onSynced, fast));
    act(() => result.current.openModal());
    await act(async () => result.current.start());
    expect(result.current.state).toMatchObject({ phase: "error", message: "CMS không phản hồi" });
    expect(result.current.state.progress).toBeGreaterThanOrEqual(25);
    expect(toast.error).toHaveBeenCalledWith("CMS không phản hồi", { id: "teacher-sync" });
    expect(onSynced).not.toHaveBeenCalled();
    vi.mocked(syncTeachersFromCms).mockResolvedValue({ jobId: "sync-4", status: "DONE" });
    await act(async () => result.current.start());
    expect(result.current.state.phase).toBe("success");
  });

  it("công tắc ghi đóng (WriteDisabledError) => error 'chưa tích hợp', KHÔNG thành công giả; lỗi API => thông điệp của lỗi", async () => {
    vi.mocked(syncTeachersFromCms).mockRejectedValueOnce(new WriteDisabledError("teacher-management")).mockRejectedValueOnce(new ApiError("Đang có tiến trình khác", 409));
    const onSynced = vi.fn();
    const { result } = renderHook(() => useCmsSync(false, onSynced, fast));
    act(() => result.current.openModal());
    await act(async () => result.current.start());
    expect(result.current.state.phase).toBe("error");
    expect(result.current.state.message).toContain("WAITING FOR BACKEND");
    await act(async () => result.current.start());
    expect(result.current.state.message).toBe("Đang có tiến trình khác");
    expect(onSynced).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("đang chạy: close() không đóng, start() lần hai bị bỏ qua (một request)", async () => {
    let release: (v: { jobId: string; status: "DONE" }) => void = () => {};
    vi.mocked(syncTeachersFromCms).mockReturnValue(new Promise((r) => (release = r)));
    const { result } = renderHook(() => useCmsSync(true, vi.fn(), fast));
    act(() => result.current.openModal());
    act(() => void result.current.start());
    await waitFor(() => expect(result.current.state.phase).toBe("running"));
    act(() => void result.current.start());
    act(() => result.current.close());
    expect(result.current.open).toBe(true);
    expect(syncTeachersFromCms).toHaveBeenCalledTimes(1);
    await act(async () => release({ jobId: "s", status: "DONE" }));
    expect(result.current.state.phase).toBe("success");
  });
});
