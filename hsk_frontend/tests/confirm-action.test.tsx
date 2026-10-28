import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/components/shared/antd-static-render";
import { confirmAction } from "@/components/shared/confirm-action";

// Modal.confirm là API tĩnh của antd: với React 19 nó chỉ render khi đã cấu hình unstableSetRender (antd-static-render.tsx). Test này render THẬT trong jsdom
// (không mock confirmAction) để chắc rằng hộp xác nhận xuất hiện và trả về đúng lựa chọn.
describe("confirmAction (antd Modal.confirm + React 19)", () => {
  it("hiện hộp xác nhận với tiêu đề/nút, bấm Xác nhận => true", async () => {
    let result: Promise<boolean>;
    act(() => {
      result = confirmAction({ title: "Xoá bộ thẻ?", content: "Không thể hoàn tác.", okText: "Xoá", danger: true });
    });
    await waitFor(() => expect(screen.getByText("Xoá bộ thẻ?")).toBeInTheDocument());
    expect(screen.getByText("Không thể hoàn tác.")).toBeInTheDocument();
    const ok = screen.getByRole("button", { name: "Xoá" });
    expect(ok.className).toContain("ant-btn-dangerous");
    act(() => ok.click());
    await expect(result!).resolves.toBe(true);
  });

  it("bấm Hủy => false", async () => {
    let result: Promise<boolean>;
    act(() => {
      result = confirmAction({ title: "Khoá giảng viên?" });
    });
    await waitFor(() => expect(screen.getByText("Khoá giảng viên?")).toBeInTheDocument());
    act(() => screen.getByRole("button", { name: "Hủy" }).click());
    await expect(result!).resolves.toBe(false);
  });
});
