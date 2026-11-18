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
