import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TimetableToolbar from "@/components/student/timetable/timetable-toolbar";

it("switches scope and view independently and exposes the date and refresh actions", () => {
  const onMonth = vi.fn();
  const onToday = vi.fn();
  const onScope = vi.fn();
  const onView = vi.fn();
  const onReload = vi.fn();
  const props = { month: "11/2026", view: "calendar" as const, onMonth, onToday, onScope, onView, onReload };
  const { rerender } = render(<TimetableToolbar {...props} wholeCourse={false} />);

  fireEvent.click(screen.getByRole("button", { name: "Tháng trước" }));
  fireEvent.click(screen.getByRole("button", { name: "Tháng sau" }));
  expect(onMonth.mock.calls).toEqual([[-1], [1]]);
  fireEvent.click(screen.getByRole("button", { name: "Hôm nay" }));
  expect(onToday).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Tải lại lịch" }));
  expect(onReload).toHaveBeenCalledOnce();
  expect(screen.getByRole("radio", { name: "Dạng thẻ" })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: "Dạng danh sách" }));
  expect(onView).toHaveBeenCalledWith("list");
  fireEvent.click(screen.getByRole("radio", { name: "Toàn khóa" }));
  expect(onScope).toHaveBeenCalledWith(true);

  rerender(<TimetableToolbar {...props} wholeCourse />);
  expect(screen.queryByRole("button", { name: "Tháng sau" })).not.toBeInTheDocument();
});
