import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RichTextEditor } from "@/components/shared/rich-text-editor";

const mockEditor = vi.hoisted(() => ({ initialize: undefined as (() => void) | undefined }));
vi.mock("@tinymce/tinymce-react", async () => {
  const { useEffect, useRef } = await import("react");
  return {
    Editor: ({ value, onInit, onEditorChange }: {
      value: string; onInit: (event: unknown, editor: unknown) => void; onEditorChange: (value: string) => void;
    }) => {
      const body = useRef<HTMLTextAreaElement>(null);
      useEffect(() => {
        mockEditor.initialize = () => onInit(null, { getBody: () => body.current });
      }, [onInit]);
      return <textarea ref={body} aria-label="TinyMCE" defaultValue={value} onChange={event => onEditorChange(event.target.value)} />;
    },
  };
});

beforeEach(() => { mockEditor.initialize = undefined; });

it("khởi tạo trình soạn ngay khi mở ô và thay khung tĩnh khi TinyMCE sẵn sàng", () => {
  render(<RichTextEditor label="Nghĩa" text="cửa hàng" onChange={vi.fn()} />);
  const editor = screen.getByLabelText("TinyMCE");
  expect(editor.closest("[inert]")).toBeInTheDocument();
  expect(screen.getByText("cửa hàng", { selector: ".vocab-rich-value" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Nghĩa" })).not.toBeInTheDocument();

  act(() => mockEditor.initialize?.());
  expect(screen.getByRole("textbox", { name: "Nghĩa" })).toBe(editor);
  expect(editor.closest("[inert]")).toBeNull();
  expect(screen.queryByText("cửa hàng", { selector: "div.vocab-rich-value" })).not.toBeInTheDocument();
});

it("hiển thị định dạng an toàn và gửi định dạng lẫn văn bản thuần khi sửa", () => {
  const onChange = vi.fn();
  const { container } = render(<RichTextEditor label="Nghĩa" text="Tốt" html='<p><strong>Tốt</strong><img src="x" onerror="alert(1)"></p>' onChange={onChange} />);
  expect(container.querySelector("strong")).toHaveTextContent("Tốt");
  expect(container.querySelector("img")).toBeNull();
  act(() => mockEditor.initialize?.());
  fireEvent.change(screen.getByRole("textbox", { name: "Nghĩa" }), { target: { value: "<p><em>Rất tốt</em></p><p>Ví dụ</p>" } });
  expect(onChange).toHaveBeenCalledWith("Rất tốt Ví dụ", "<p><em>Rất tốt</em></p><p>Ví dụ</p>");
});

it("chế độ xem chỉ hiển thị nội dung tĩnh", () => {
  render(<RichTextEditor label="Nghĩa" text="cửa hàng" readOnly onChange={vi.fn()} />);
  expect(screen.getByText("cửa hàng")).toBeInTheDocument();
  expect(screen.queryByLabelText("TinyMCE")).not.toBeInTheDocument();
  expect(mockEditor.initialize).toBeUndefined();
});
