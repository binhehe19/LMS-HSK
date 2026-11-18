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

it("uses separate draft and publish actions and confirms the copy destination", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  const onCopy = vi.fn().mockResolvedValue(true);
  render(<PackageWorkspace {...props} pkg={{ ...props.pkg, syllabusId: "s1" }} canWrite onSave={onSave} onCopy={onCopy}>Resources</PackageWorkspace>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ name: "HSK 1", sessionCount: 4 }), false);
  await user.click(screen.getByRole("button", { name: "Lưu & Xuất bản" }));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ name: "HSK 1", sessionCount: 4 }), true);
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
    expect(onSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ syllabusId: "s2" }), false);
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
  await user.click(screen.getByRole("button", { name: "Quay lại" }));
  const leave = await screen.findByRole("dialog", { name: "Rời màn soạn học phần?" });
  await user.click(within(leave).getByRole("button", { name: "Hủy thay đổi" }));
  const confirmation = await screen.findByRole("dialog", { name: "Hủy toàn bộ bản nháp?" });
  expect(within(confirmation).getByText(/đã lưu trước đó/)).toBeInTheDocument();
  expect(within(confirmation).getByText(new RegExp(warning))).toBeInTheDocument();
  expect(onDiscard).not.toHaveBeenCalled();
  await user.click(within(confirmation).getByRole("button", { name: "Hủy bản nháp" }));
  expect(onDiscard).toHaveBeenCalledOnce();
});
