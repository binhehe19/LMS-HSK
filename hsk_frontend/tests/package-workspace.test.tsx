import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackageWorkspace } from "@/components/management/content-flat/package-workspace";
vi.mock("@/components/management/notifications/use-keyed-fetch", () => ({
  useKeyedFetch: (key: string | null) => ({
    state: { kind: "ok", data: key === "package-syllabuses" ? [{ id: "s1", name: "Giáo trình HSK" }, { id: "s2", name: "Giáo trình mới" }] : [{ sessionNo: 3 }] },
    reload: vi.fn(),
  }),
}));
vi.setConfig({ testTimeout: 15_000 });

const props = { pkg: { id: "p", name: "HSK 1", type: "VOCABULARY", publishStatus: "DRAFT" as const, sessionCount: 4 }, sessionNo: 3, itemCount: 2, busy: false, canPublish: true, onSession: vi.fn(), onSave: vi.fn(), onCopy: vi.fn(), onBack: vi.fn(), onImport: vi.fn(), onCreate: vi.fn() };
it("renders saved empty sessions and selects current session", () => {
  const html = renderToStaticMarkup(<PackageWorkspace {...props} canWrite><p>Resources</p></PackageWorkspace>);
  expect(html).toContain('aria-label="Buổi 4"');
  expect(html).toContain('aria-label="Buổi 3" aria-pressed="true"');
  expect(html).toContain("Thông tin học phần");
  expect(html).toContain("Resources");
  expect(html).toContain("Thêm buổi");
});
it("does not expose editing controls in read-only mode", () => {
  const html = renderToStaticMarkup(<PackageWorkspace {...props} canWrite={false}>Resources</PackageWorkspace>);
  expect(html).not.toContain("Lưu nháp");
  expect(html).not.toContain("Xuất bản");
  expect(html).not.toContain("Thêm buổi");
  expect(html).not.toContain("+ Thêm học liệu");
});

it("returns directly when the edit session has no changes", async () => {
  const onBack = vi.fn();
  render(<PackageWorkspace {...props} canWrite onBack={onBack} onDiscard={vi.fn()}>Resources</PackageWorkspace>);
  await userEvent.click(screen.getByRole("button", { name: "Quay lại" }));
  expect(onBack).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("offers to save and leave after resources change, and only leaves once saving succeeds", async () => {
  const onBack = vi.fn();
  const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const workspaceProps = { ...props, canWrite: true, onBack, onSave, onDiscard: vi.fn() };
  const { rerender } = render(<PackageWorkspace {...workspaceProps}>Resources</PackageWorkspace>);
  rerender(<PackageWorkspace {...workspaceProps} draftRevision={1}>Resources</PackageWorkspace>);
  await userEvent.click(screen.getByRole("button", { name: "Quay lại" }));
  const leave = await screen.findByRole("dialog", { name: "Rời màn soạn học phần?" });
  const saveDraft = within(leave).getByRole("button", { name: "Lưu nháp và thoát" });
  await userEvent.click(saveDraft);
  expect(onBack).not.toHaveBeenCalled();
  await userEvent.click(saveDraft);
  expect(onBack).toHaveBeenCalledOnce();
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ name: "HSK 1" }), false, expect.any(Object));
});

it.each([
  ["checking", "Đang tải màn soạn học phần"],
  ["finished", "Đang về danh sách học phần"],
] as const)("shows only a loading status while the edit session is %s", (status, message) => {
  render(<PackageWorkspace {...props} canWrite status={status}>Resources</PackageWorkspace>);
  expect(screen.getByRole("status")).toHaveTextContent(message);
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("uses separate draft and publish actions and confirms the copy destination", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  const onCopy = vi.fn().mockResolvedValue(true);
  render(<PackageWorkspace {...props} pkg={{ ...props.pkg, syllabusId: "s1" }} canWrite onSave={onSave} onCopy={onCopy}>Resources</PackageWorkspace>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ name: "HSK 1", sessionCount: 4 }), false, expect.any(Object));
  await user.click(screen.getByRole("button", { name: "Lưu & Xuất bản" }));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ name: "HSK 1", sessionCount: 4 }), true, expect.any(Object));
  await user.click(screen.getByRole("button", { name: "Tạo bản sao" }));
  const dialog = await screen.findByRole("dialog", { name: "Tạo bản sao học phần" });
  await user.click(within(dialog).getByRole("button", { name: "Tạo bản sao" }));
  expect(onCopy).toHaveBeenCalledExactlyOnceWith("s1");
});

it("confirms before saving a change to an already linked syllabus", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  try {
    render(<PackageWorkspace {...props} pkg={{ ...props.pkg, syllabusId: "s1" }} canWrite onSave={onSave}>Resources</PackageWorkspace>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Giáo trình" }));
    await user.click(await screen.findByText("Giáo trình mới"));
    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ syllabusId: "s2" }), false, expect.any(Object));
  } finally {
    confirm.mockRestore();
  }
});

it("auto-saves changed draft fields and stops sending heartbeats after five idle minutes", async () => {
  vi.useFakeTimers();
  try {
    const onHeartbeat = vi.fn().mockResolvedValue(true);
    render(<PackageWorkspace {...props} canWrite onHeartbeat={onHeartbeat}>Resources</PackageWorkspace>);
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(onHeartbeat).toHaveBeenLastCalledWith(undefined);
    fireEvent.change(screen.getByLabelText("Tên học phần"), { target: { value: "HSK mới" } });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(onHeartbeat).toHaveBeenLastCalledWith({ title: "HSK mới", description: "", sessionCount: 4 });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(onHeartbeat).toHaveBeenLastCalledWith(undefined);
    await act(() => vi.advanceTimersByTimeAsync(4 * 60_000));
    expect(screen.getByText(/sắp hết hạn do không có hoạt động/)).toBeInTheDocument();
    expect(onHeartbeat).toHaveBeenCalledTimes(14);
  } finally {
    vi.useRealTimers();
  }
});

it.each([
  ["DRAFT", "sẽ bị xóa khỏi danh sách"],
  ["PUBLISHED", "Phiên bản đang xuất bản vẫn được giữ"],
] as const)("warns before discarding the entire draft of a %s package", async (publishStatus, warning) => {
  const onDiscard = vi.fn().mockResolvedValue(true);
  const user = userEvent.setup();
  render(<PackageWorkspace {...props} pkg={{ ...props.pkg, publishStatus }} canWrite onDiscard={onDiscard}>Resources</PackageWorkspace>);
  fireEvent.change(screen.getByLabelText("Tên học phần"), { target: { value: "HSK mới" } });
  await user.click(screen.getByRole("button", { name: "Quay lại" }));
  const leave = await screen.findByRole("dialog", { name: "Rời màn soạn học phần?" });
  expect(within(leave).getAllByRole("button").map(button => button.textContent?.trim()).filter(Boolean)).toEqual([
    "Hủy bỏ thay đổi", "Lưu nháp và thoát", "Lưu & Xuất bản",
  ]);
  await user.click(within(leave).getByRole("button", { name: "Hủy bỏ thay đổi" }));
  const confirmation = await screen.findByRole("dialog", { name: "Hủy toàn bộ bản nháp?" });
  expect(within(confirmation).getByText(/đã lưu trước đó/)).toBeInTheDocument();
  expect(within(confirmation).getByText(new RegExp(warning))).toBeInTheDocument();
  expect(onDiscard).not.toHaveBeenCalled();
  await user.click(within(confirmation).getByRole("button", { name: "Hủy bản nháp" }));
  expect(onDiscard).toHaveBeenCalledOnce();
});

it("keeps newer typing pending while the previous autosave completes", async () => {
  vi.useFakeTimers();
  try {
    let finishFirst!: (saved: boolean) => void;
    const first = new Promise<boolean>(resolve => { finishFirst = resolve; });
    const onHeartbeat = vi.fn().mockReturnValueOnce(first).mockResolvedValue(true);
    render(<PackageWorkspace {...props} canWrite onHeartbeat={onHeartbeat} onDiscard={vi.fn()}>Resources</PackageWorkspace>);
    const name = screen.getByLabelText("Tên học phần");
    fireEvent.change(name, { target: { value: "Lần 1" } });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(name).toBeEnabled();
    fireEvent.change(name, { target: { value: "Lần 2" } });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(onHeartbeat).toHaveBeenCalledOnce();
    await act(async () => { finishFirst(true); });
    expect(name).toHaveValue("Lần 2");
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(onHeartbeat).toHaveBeenLastCalledWith({ title: "Lần 2", description: "", sessionCount: 4 });
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(screen.getByRole("dialog", { name: "Rời màn soạn học phần?" })).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it("retries on the same draft and protects local text if a conflicting draft is returned", async () => {
  const firstDraft = { id: "draft", title: "HSK gốc", description: "", sessionCount: 4 };
  const onRetryEdit = vi.fn();
  const workspace = { ...props, canWrite: true, onRetryEdit };
  const { rerender } = render(<PackageWorkspace {...workspace} status="ready" draft={firstDraft}>Resources</PackageWorkspace>);
  fireEvent.change(screen.getByLabelText("Tên học phần"), { target: { value: "Nội dung đang gõ" } });
  rerender(<PackageWorkspace {...workspace} status="lost" draft={firstDraft}>Resources</PackageWorkspace>);
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(onRetryEdit).toHaveBeenCalledOnce();
  rerender(<PackageWorkspace {...workspace} status="ready" draft={{ ...firstDraft }}>Resources</PackageWorkspace>);
  expect(screen.getByLabelText("Tên học phần")).toHaveValue("Nội dung đang gõ");
  rerender(<PackageWorkspace {...workspace} status="ready" draft={{ ...firstDraft, title: "Tên sửa ở phiên khác" }}>Resources</PackageWorkspace>);
  expect(screen.getByRole("heading", { name: "Bản nháp đã thay đổi" })).toBeInTheDocument();
  expect((screen.getByLabelText("Nội dung chưa lưu") as HTMLTextAreaElement).value).toContain("Nội dung đang gõ");
  fireEvent.click(screen.getByRole("button", { name: "Mở bản mới nhất" }));
  expect(screen.getByLabelText("Tên học phần")).toHaveValue("Tên sửa ở phiên khác");
});

it("uses the requested destination only after saving and tracks a partial save", async () => {
  const navigationGuardRef = { current: null } as { current: ((navigate: (refresh?: boolean) => void) => void) | null };
  const navigate = vi.fn();
  const onSave = vi.fn(async (_input, _publish, progress) => { progress.fieldsSaved(); return false; });
  render(<PackageWorkspace {...props} canWrite onDiscard={vi.fn()} navigationGuardRef={navigationGuardRef} onSave={onSave}>Resources</PackageWorkspace>);
  fireEvent.change(screen.getByLabelText("Tên học phần"), { target: { value: "Nháp đã lưu" } });
  act(() => navigationGuardRef.current?.(navigate));
  const leave = screen.getByRole("dialog", { name: "Rời màn soạn học phần?" });
  await userEvent.click(within(leave).getByRole("button", { name: "Lưu & Xuất bản" }));
  expect(navigate).not.toHaveBeenCalled();
  expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
  onSave.mockResolvedValueOnce(true);
  await userEvent.click(within(leave).getByRole("button", { name: "Lưu nháp và thoát" }));
  expect(navigate).toHaveBeenCalledOnce();
});

it("adds an empty session locally and saves its count through the heartbeat", async () => {
  vi.useFakeTimers();
  try {
    const onHeartbeat = vi.fn().mockResolvedValue(true);
    const onSave = vi.fn();
    const onSession = vi.fn();
    render(<PackageWorkspace {...props} canWrite onHeartbeat={onHeartbeat} onSave={onSave} onSession={onSession}>Resources</PackageWorkspace>);
    fireEvent.click(screen.getByRole("button", { name: /Thêm buổi/ }));
    expect(onSession).toHaveBeenCalledExactlyOnceWith(5);
    expect(screen.getByRole("button", { name: "Buổi 5" })).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(onHeartbeat).toHaveBeenLastCalledWith({ title: "HSK 1", description: "", sessionCount: 5 });
  } finally {
    vi.useRealTimers();
  }
});
