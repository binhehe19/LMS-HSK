import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { FlatItemsBreadcrumbView } from "@/components/management/content-flat/flat-items-breadcrumb-view";
import { VOCAB_SET_CONFIG } from "@/components/management/content-flashcard/flashcard-config";
import type { FlashcardCard } from "@/types/content-flashcard";

it("opens the chosen card in read-only mode and disables edit and delete", async () => {
  const cards: FlashcardCard[] = [
    { id: "one", studySetId: "p", term: "你好", meaning: "Xin chào" },
    { id: "two", studySetId: "p", term: "谢谢", meaning: "Cảm ơn" },
  ];

  render(<FlatItemsBreadcrumbView
    embedded
    config={VOCAB_SET_CONFIG}
    pkg={null}
    state={{ kind: "ok", data: cards }}
    items={cards}
    canWrite={false}
    busy={false}
    onCreate={vi.fn()}
    onEdit={vi.fn()}
    onDelete={vi.fn()}
    onBack={vi.fn()}
    onRetry={vi.fn()}
  />);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Chỉnh sửa 谢谢" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Xóa 谢谢" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Xem 谢谢" }));

  const dialog = await screen.findByRole("dialog", { name: "Xem từ" });
  expect(within(dialog).getByText("Cảm ơn")).toBeInTheDocument();
  expect(within(dialog).queryByText("Xin chào")).not.toBeInTheDocument();
});

it("bản sao lấy từ Kho không sửa tại chỗ mà mở trang sửa ở Kho trong tab mới; mục tạo trong học phần vẫn sửa được", async () => {
  const onEdit = vi.fn();
  const cards: FlashcardCard[] = [
    { id: "copy", studySetId: "p", term: "你好", meaning: "Xin chào", sourceResourceId: "dict-1" },
    { id: "own", studySetId: "p", term: "谢谢", meaning: "Cảm ơn", sourceResourceId: null },
  ];
  render(<FlatItemsBreadcrumbView embedded config={VOCAB_SET_CONFIG} pkg={null} state={{ kind: "ok", data: cards }} items={cards}
    canWrite busy={false} onCreate={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} onBack={vi.fn()} onRetry={vi.fn()} />);

  const link = screen.getByRole("link", { name: "Sửa 你好 trong Kho" });
  expect(link).toHaveAttribute("href", "/vocabulary/manage?keySearch=%E4%BD%A0%E5%A5%BD&edit=dict-1");
  expect(link).toHaveAttribute("target", "_blank");
  expect(screen.queryByRole("button", { name: "Chỉnh sửa 你好" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa 谢谢" }));
  expect(onEdit).toHaveBeenCalledWith(cards[1]);
});
