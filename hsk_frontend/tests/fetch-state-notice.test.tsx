import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";

it("hiện lỗi tải trong khung có biểu tượng và cho phép thử lại", () => {
  const onRetry = vi.fn();
  const { rerender } = render(<FetchStateNotice state={{ kind: "error", message: "Internal Server Error" }} waitingText="Chưa kết nối API" onRetry={onRetry} />);
  const notice = screen.getByRole("alert");
  expect(notice).toHaveAttribute("data-kind", "error");
  expect(notice).toHaveTextContent("Không thể tải dữ liệu");
  expect(notice).not.toHaveTextContent("Internal Server Error");
  expect(notice.querySelector("svg")).toBeInTheDocument();
  fireEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
  expect(onRetry).toHaveBeenCalledOnce();

  rerender(<FetchStateNotice state={{ kind: "waiting" }} waitingText="Chưa kết nối API" onRetry={onRetry} />);
  expect(screen.getByRole("status")).toHaveTextContent("Chưa kết nối API");
  expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
});
