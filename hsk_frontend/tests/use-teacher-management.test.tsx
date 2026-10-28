import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTeacherManagement, writeErrorMessage } from "@/components/management/teacher-management/use-teacher-management";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/teacher-management-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import { EMPTY_TEACHER_FORM } from "@/lib/teacher-management/teacher-form";
import { idleJob, processingJob, teacher, teachersFixture } from "./fixtures/teachers";

vi.mock("@/lib/api/teacher-management-client", () => ({
  fetchTeachers: vi.fn(),
  fetchTeacherJobStatus: vi.fn(),
  fetchRecentlyCreatedTeachers: vi.fn(),
  syncTeachersFromCms: vi.fn(),
  createTeacher: vi.fn(),
  updateTeacher: vi.fn(),
  resendTeacherAccountEmail: vi.fn(),
  blockTeacher: vi.fn(),
  activateTeacher: vi.fn(),
  importTeachers: vi.fn(),
}));
vi.mock("@/hooks/use-write-gate", () => ({ useWriteGate: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const form = { ...EMPTY_TEACHER_FORM, email: "moi@example.test", fullName: "Giảng viên mới" };

beforeEach(() => {
  for (const fn of Object.values(client)) vi.mocked(fn).mockReset();
  vi.mocked(client.fetchTeachers).mockResolvedValue(teachersFixture);
  vi.mocked(client.fetchTeacherJobStatus).mockResolvedValue(idleJob);
  vi.mocked(useWriteGate).mockReturnValue({ availability: "enabled", enabled: true, demo: true });
  for (const fn of [toast.success, toast.error, toast.warning, toast.info]) vi.mocked(fn).mockClear();
});

describe("useTeacherManagement — danh sách và trạng thái tiến trình", () => {
  it("loading => ok với danh sách; hỏi trạng thái tiến trình ngay khi mở", async () => {
    const { result } = renderHook(() => useTeacherManagement());
    expect(result.current.state).toEqual({ kind: "loading" });
    expect(result.current.teachers).toEqual([]);
    await waitFor(() => expect(result.current.state.kind).toBe("ok"));
    expect(result.current.teachers).toEqual(teachersFixture);
    expect(result.current.refreshing).toBe(false);
    await waitFor(() => expect(result.current.jobStatus).toEqual(idleJob));
    expect(result.current.importInProgress).toBe(false);
  });

  it("dịch vụ chưa cấu hình => waiting (không phải error); tiến trình nền không hỏi lại", async () => {
    vi.mocked(client.fetchTeachers).mockRejectedValue(new ApiNotConfiguredError());
    vi.mocked(client.fetchTeacherJobStatus).mockRejectedValue(new ApiNotConfiguredError());
    const { result } = renderHook(() => useTeacherManagement());
    await waitFor(() => expect(result.current.state.kind).toBe("waiting"));
    expect(result.current.jobStatus).toBeNull();
  });

  it("ApiError => error mang thông báo; phản hồi không phải mảng => error hợp đồng (không im lặng coi là rỗng)", async () => {
    vi.mocked(client.fetchTeachers).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500));
    const { result, rerender } = renderHook(() => useTeacherManagement());
    await waitFor(() => expect(result.current.state).toMatchObject({ kind: "error", message: "Máy chủ lỗi" }));
    vi.mocked(client.fetchTeachers).mockResolvedValue({ items: teachersFixture } as never);
    act(() => result.current.reload());
    rerender();
    await waitFor(() => expect(result.current.state).toMatchObject({ kind: "error", message: "Dữ liệu trả về không đúng định dạng danh sách giảng viên." }));
  });

  it("reload giữ dữ liệu cũ và báo refreshing trong lúc tải lại", async () => {
    const { result } = renderHook(() => useTeacherManagement());
    await waitFor(() => expect(result.current.state.kind).toBe("ok"));
    vi.mocked(client.fetchTeachers).mockReturnValue(new Promise(() => {}));
    act(() => result.current.reload());
    expect(result.current.state.kind).toBe("loading");
    expect(result.current.refreshing).toBe(true);
    expect(result.current.teachers).toEqual(teachersFixture);
  });

  it("đang có tiến trình import => importInProgress và chọn file bị từ chối bằng toast cảnh báo, không gọi import", async () => {
    vi.mocked(client.fetchTeacherJobStatus).mockResolvedValue(processingJob);
    const { result } = renderHook(() => useTeacherManagement());
    await waitFor(() => expect(result.current.importInProgress).toBe(true));
    await act(async () => {
      expect(await result.current.importFile(new File(["x"], "x.csv"))).toBeNull();
    });
    expect(toast.warning).toHaveBeenCalledWith("Đang có tiến trình import giáo viên, vui lòng chờ hoàn tất rồi thử lại");
    expect(client.importTeachers).not.toHaveBeenCalled();
  });
});

describe("useTeacherManagement — thao tác ghi", () => {
  it("tạo: form sai => toast lỗi, không gọi API; đủ => gọi với payload đã cắt, toast thành công, tải lại danh sách", async () => {
    vi.mocked(client.createTeacher).mockResolvedValue({ teacher: teacher(99), emailStatus: "SUCCESS" });
    const { result } = renderHook(() => useTeacherManagement());
    await waitFor(() => expect(result.current.state.kind).toBe("ok"));
    await act(async () => {
      expect(await result.current.create({ ...form, fullName: " " })).toBeNull();
    });
    expect(toast.error).toHaveBeenCalledWith("Họ và tên là bắt buộc");
    expect(client.createTeacher).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current.create({ ...form, email: " moi@example.test " })).toMatchObject({ emailStatus: "SUCCESS" });
    });
    expect(client.createTeacher).toHaveBeenCalledWith({ email: "moi@example.test", fullName: "Giảng viên mới" }, true);
    expect(toast.success).toHaveBeenCalledWith("Tạo giảng viên thành công. Mật khẩu đã được gửi qua email.");
    expect(client.fetchTeachers).toHaveBeenCalledTimes(2);
  });

  it("tạo thành công nhưng email thất bại => toast cảnh báo kèm lý do", async () => {
    vi.mocked(client.createTeacher).mockResolvedValue({ teacher: teacher(99), emailStatus: "FAILED", emailStatusReason: "Hộp thư không tồn tại" });
    const { result } = renderHook(() => useTeacherManagement());
    await act(async () => {
      await result.current.create(form);
    });
    expect(toast.warning).toHaveBeenCalledWith("Tạo giảng viên thành công nhưng gửi email thất bại: Hộp thư không tồn tại");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("công tắc ghi đóng ở lớp client (WriteDisabledError) => toast 'chưa tích hợp', KHÔNG toast thành công, không tải lại", async () => {
    vi.mocked(client.blockTeacher).mockRejectedValue(new WriteDisabledError("teacher-management"));
    const { result } = renderHook(() => useTeacherManagement());
    await waitFor(() => expect(result.current.state.kind).toBe("ok"));
    await act(async () => {
      expect(await result.current.block(teacher(1))).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledWith("Thao tác chưa được tích hợp với backend (WAITING FOR BACKEND).");
    expect(toast.success).not.toHaveBeenCalled();
    expect(client.fetchTeachers).toHaveBeenCalledTimes(1);
  });

  it("khoá/mở khoá: đúng endpoint theo trạng thái, toast của bản cũ, tải lại; lỗi API => toast thông điệp của lỗi", async () => {
    vi.mocked(client.blockTeacher).mockResolvedValue(teacher(1, { status: "BLOCKED" }));
    vi.mocked(client.activateTeacher).mockRejectedValue(new ApiError("Giảng viên đang hoạt động", 409));
    const { result } = renderHook(() => useTeacherManagement());
    await waitFor(() => expect(result.current.state.kind).toBe("ok"));
    await act(async () => {
      expect(await result.current.block(teacher(1))).toBe(true);
    });
    expect(client.blockTeacher).toHaveBeenCalledWith("gv-1", true);
    expect(toast.success).toHaveBeenCalledWith("Đã khóa quyền truy cập tài khoản giảng viên");
    await act(async () => {
      expect(await result.current.unblock(teacher(3, { status: "BLOCKED" }))).toBe(false);
    });
    expect(client.activateTeacher).toHaveBeenCalledWith("gv-3", true);
    expect(toast.error).toHaveBeenCalledWith("Giảng viên đang hoạt động");
    expect(client.fetchTeachers).toHaveBeenCalledTimes(2); // chỉ lần khoá thành công tải lại
  });

  it("cập nhật: payload không có email/status, toast thành công", async () => {
    vi.mocked(client.updateTeacher).mockResolvedValue(teacher(1, { fullName: "Tên mới" }));
    const { result } = renderHook(() => useTeacherManagement());
    await act(async () => {
      expect(await result.current.update(teacher(1), { ...form, fullName: " Tên mới ", email: "giangvien1@example.test" })).toBe(true);
    });
    expect(client.updateTeacher).toHaveBeenCalledWith("gv-1", { fullName: "Tên mới" }, true);
    expect(toast.success).toHaveBeenCalledWith("Cập nhật giảng viên thành công");
  });

  it("gửi lại email: SUCCESS => toast thành công; FAILED => toast lỗi kèm lý do", async () => {
    vi.mocked(client.resendTeacherAccountEmail).mockResolvedValueOnce({ teacher: teacher(1), emailStatus: "SUCCESS" }).mockResolvedValueOnce({ teacher: teacher(1), emailStatus: "FAILED", emailStatusReason: "Bị từ chối" });
    const { result } = renderHook(() => useTeacherManagement());
    await act(async () => {
      await result.current.resendEmail("gv-1");
      await result.current.resendEmail("gv-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Đã gửi lại email tài khoản giảng viên.");
    expect(toast.error).toHaveBeenCalledWith("Gửi email thất bại: Bị từ chối");
  });

  it("đổi email & gửi lại: email sai => toast, không gọi; đúng => PUT {email} rồi POST resend, toast thành công", async () => {
    vi.mocked(client.updateTeacher).mockResolvedValue(teacher(1, { email: "khac@example.test" }));
    vi.mocked(client.resendTeacherAccountEmail).mockResolvedValue({ teacher: teacher(1), emailStatus: "SUCCESS" });
    const { result } = renderHook(() => useTeacherManagement());
    await act(async () => {
      expect(await result.current.changeEmailAndResend("gv-1", "sai")).toBeNull();
    });
    expect(toast.error).toHaveBeenCalledWith("Email không hợp lệ");
    expect(client.updateTeacher).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current.changeEmailAndResend("gv-1", " khac@example.test ")).toMatchObject({ emailStatus: "SUCCESS" });
    });
    expect(client.updateTeacher).toHaveBeenCalledWith("gv-1", { email: "khac@example.test" }, true);
    expect(client.resendTeacherAccountEmail).toHaveBeenCalledWith("gv-1", true);
    expect(toast.success).toHaveBeenCalledWith("Đã cập nhật email và gửi lại thông tin tài khoản.");
  });

  it("import: toast theo số tạo/bỏ qua như bản cũ; không dòng hợp lệ => toast lỗi; tải lại khi có dòng tạo được", async () => {
    vi.mocked(client.importTeachers)
      .mockResolvedValueOnce({ createdCount: 2, skippedCount: 1, skippedReasons: ["Dòng 3: Email chưa đúng định dạng"], items: [] })
      .mockResolvedValueOnce({ createdCount: 0, skippedCount: 0, items: [] });
    const { result } = renderHook(() => useTeacherManagement());
    await waitFor(() => expect(result.current.state.kind).toBe("ok"));
    const file = new File(["x"], "gv.csv", { type: "text/csv" });
    await act(async () => {
      await result.current.importFile(file);
    });
    expect(client.importTeachers).toHaveBeenCalledWith(file, true);
    expect(toast.success).toHaveBeenCalledWith("Đã nhập thành công 2 giảng viên từ Excel");
    expect(toast.warning).toHaveBeenCalledWith("Bỏ qua 1 dòng không import được: Dòng 3: Email chưa đúng định dạng");
    expect(client.fetchTeachers).toHaveBeenCalledTimes(2);
    await act(async () => {
      await result.current.importFile(file);
    });
    expect(toast.error).toHaveBeenCalledWith("Không có dòng dữ liệu hợp lệ để import");
    expect(client.fetchTeachers).toHaveBeenCalledTimes(2);
    expect(result.current.importing).toBe(false);
  });

  it("chống bấm đúp: hai thao tác ghi chồng nhau chỉ gọi API một lần", async () => {
    let release: (t: typeof teachersFixture[number]) => void = () => {};
    vi.mocked(client.blockTeacher).mockReturnValue(new Promise((r) => (release = r)));
    const { result } = renderHook(() => useTeacherManagement());
    await waitFor(() => expect(result.current.state.kind).toBe("ok"));
    let first: Promise<boolean> = Promise.resolve(false);
    let second: Promise<boolean> = Promise.resolve(false);
    act(() => {
      first = result.current.block(teacher(1));
      second = result.current.block(teacher(1));
    });
    await waitFor(() => expect(result.current.busy).toBe(true));
    expect(await second).toBe(false);
    await act(async () => release(teacher(1, { status: "BLOCKED" })));
    expect(await first).toBe(true);
    expect(client.blockTeacher).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.busy).toBe(false));
  });
});

describe("writeErrorMessage", () => {
  it("phân loại lỗi ghi", () => {
    expect(writeErrorMessage(new WriteDisabledError("teacher-management"), "x")).toContain("WAITING FOR BACKEND");
    expect(writeErrorMessage(new ApiNotConfiguredError(), "x")).toContain("WAITING FOR BACKEND");
    expect(writeErrorMessage(new ApiError("Email đã tồn tại", 409), "x")).toBe("Email đã tồn tại");
    expect(writeErrorMessage(new Error("boom"), "Không thể tạo giảng viên")).toBe("Không thể tạo giảng viên");
  });
});
