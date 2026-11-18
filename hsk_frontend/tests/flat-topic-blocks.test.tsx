import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlatTopicBlocks } from "@/components/management/content-flat/flat-topic-blocks";
import { SessionHeading } from "@/components/management/content-flat/session-heading";
import type { FlatTopicUi } from "@/types/content";

const items = [{ id: "i1" }, { id: "i2" }];
const membership: Record<string, string> = { i1: "ta" };

function topicUi(overrides: Partial<FlatTopicUi> = {}): FlatTopicUi {
  return {
    topics: [{ id: "ta", title: "Gia đình", itemCount: 1 }, { id: "tb", title: "Bạn bè", itemCount: 0 }],
    topicOf: (id) => membership[id] ?? null,
    onCreate: vi.fn(), onRename: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onAssign: vi.fn(),
    ...overrides,
  };
}

const renderBlocks = (ui: FlatTopicUi, canWrite = true) => render(
  <FlatTopicBlocks items={items} ui={ui} canWrite={canWrite} busy={false} noun="từ vựng"
    renderCard={(item, drag) => <li key={item.id} {...drag} data-testid={`card-${item.id}`}>{item.id}</li>} />,
);

it("gom học liệu theo khối chủ đề: chủ đề trống vẫn hiện, mục chưa phân chủ đề ở khối Không chủ đề cuối", () => {
  renderBlocks(topicUi());
  const family = screen.getByRole("region", { name: "Chủ đề Gia đình" });
  expect(within(family).getByTestId("card-i1")).toBeTruthy();
  const friends = screen.getByRole("region", { name: "Chủ đề Bạn bè" });
  expect(within(friends).getByText("Chưa có từ vựng nào trong chủ đề này")).toBeTruthy();
  const none = screen.getByRole("region", { name: "Không chủ đề" });
  expect(within(none).getByTestId("card-i2")).toBeTruthy();
});

it("thả thẻ vào khối khác thì chuyển chủ đề; thả vào Không chủ đề thì bỏ khỏi chủ đề; thả vào chính khối đang ở thì bỏ qua", () => {
  const ui = topicUi();
  renderBlocks(ui);
  const dataTransfer = (id: string) => ({ types: ["application/x-flat-item"], getData: () => id });
  fireEvent.drop(screen.getByRole("region", { name: "Chủ đề Bạn bè" }), { dataTransfer: dataTransfer("i1") });
  expect(ui.onAssign).toHaveBeenLastCalledWith("i1", "tb");
  fireEvent.drop(screen.getByRole("region", { name: "Không chủ đề" }), { dataTransfer: dataTransfer("i1") });
  expect(ui.onAssign).toHaveBeenLastCalledWith("i1", null);
  vi.mocked(ui.onAssign).mockClear();
  fireEvent.drop(screen.getByRole("region", { name: "Chủ đề Gia đình" }), { dataTransfer: dataTransfer("i1") });
  expect(ui.onAssign).not.toHaveBeenCalled();
});

it("không có quyền ghi thì thẻ không kéo được và thả không đổi chủ đề", () => {
  const ui = topicUi();
  renderBlocks(ui, false);
  expect(screen.getByTestId("card-i1").getAttribute("draggable")).toBe("false");
  fireEvent.drop(screen.getByRole("region", { name: "Chủ đề Bạn bè" }), { dataTransfer: { types: ["application/x-flat-item"], getData: () => "i1" } });
  expect(ui.onAssign).not.toHaveBeenCalled();
});

it("tiêu đề buổi: chưa có tên thì hiện Buổi n, đặt tên bằng ô nhập tại chỗ và Enter lưu", async () => {
  const onRename = vi.fn().mockResolvedValue(undefined);
  render(<SessionHeading sessionNo={3} onRename={onRename} actions={<button type="button">Thêm chủ đề</button>} />);
  expect(screen.getByRole("heading", { name: "Buổi 3" })).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Đặt tên buổi" }));
  await user.type(screen.getByRole("textbox", { name: "Tên buổi 3" }), "  Gia đình {Enter}");
  expect(onRename).toHaveBeenCalledWith(3, "Gia đình");
});

it("tiêu đề buổi: có tên thì tên là tiêu đề và Buổi n nằm dưới; chỉ đọc thì không có nút đổi tên", () => {
  render(<SessionHeading sessionNo={3} title="Gia đình" />);
  expect(screen.getByRole("heading", { name: "Gia đình" })).toBeTruthy();
  expect(screen.getByText("Buổi 3")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /tên buổi/i })).toBeNull();
});
