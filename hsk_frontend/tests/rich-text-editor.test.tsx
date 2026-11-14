import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RichTextEditor } from "@/components/shared/rich-text-editor";

const mockEditor = vi.hoisted(() => ({ initialize: undefined as (() => void) | undefined }));
vi.mock("@tinymce/tinymce-react", async () => {
  const { useEffect, useRef } = await import("react");
  return {
    Editor: ({ value, initialValue, onInit, onEditorChange, onCompositionStart, onCompositionEnd }: {
      value?: string; initialValue?: string;
      onInit: (event: unknown, editor: unknown) => void;
      onEditorChange: (value: string) => void;
      onCompositionStart?: () => void;
      onCompositionEnd?: (event: unknown, editor: { getContent: () => string }) => void;
    }) => {
      const body = useRef<HTMLTextAreaElement>(null);
      const editor = useRef({
        getBody: () => body.current,
        getContent: () => body.current?.value ?? "",
        setContent: (html: string) => { if (body.current) body.current.value = html; },
      }).current;
      useEffect(() => {
        mockEditor.initialize = () => onInit(null, editor);
      }, [editor, onInit]);
      return <textarea ref={body} aria-label="TinyMCE" defaultValue={initialValue ?? value}
        onChange={event => onEditorChange(event.target.value)}
        onCompositionStart={onCompositionStart} onCompositionEnd={event => onCompositionEnd?.(event, editor)} />;
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

it("giữ xuống dòng trong văn bản thuần khi dùng editor nhiều dòng", () => {
  const onChange = vi.fn();
  render(<RichTextEditor label="Câu trả lời" text="" multiline onChange={onChange} />);
  act(() => mockEditor.initialize?.());
  const html = "<p><strong>第一行</strong></p>\n<p>第二行</p>";
  fireEvent.change(screen.getByRole("textbox", { name: "Câu trả lời" }), { target: { value: html } });
  expect(onChange).toHaveBeenCalledWith("第一行\n第二行", html);
});

it("chờ bộ gõ tiếng Trung hoàn tất rồi mới lưu và vẫn đồng bộ bản nháp từ bên ngoài", () => {
  const onChange = vi.fn();
  const { rerender } = render(<RichTextEditor label="Câu trả lời" text="" multiline onChange={onChange} />);
  act(() => mockEditor.initialize?.());
  const editor = screen.getByRole("textbox", { name: "Câu trả lời" });
  fireEvent.compositionStart(editor);
  fireEvent.change(editor, { target: { value: "mafan" } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(editor, { target: { value: "<p>麻烦</p>" } });
  fireEvent.compositionEnd(editor, { data: "麻烦" });
  expect(onChange).toHaveBeenCalledExactlyOnceWith("麻烦", "<p>麻烦</p>");

  rerender(<RichTextEditor label="Câu trả lời" text="bản nháp" html="<p><em>bản nháp</em></p>" multiline onChange={onChange} />);
  expect(editor).toHaveValue("<p><em>bản nháp</em></p>");
});
