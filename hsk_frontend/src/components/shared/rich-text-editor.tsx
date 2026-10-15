"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyEditor } from "tinymce";
import DOMPurify from "dompurify";
import "./rich-text-editor.scss";

const TINYMCE_SRC = "/tinymce/tinymce.min.js";
const TAGS = ["p", "div", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li"];
const noopSubscribe = () => () => {};

function sanitize(html: string) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: [], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false });
}

function escapeText(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/\r?\n/g, "<br>");
}

interface RichTextEditorProps {
  label: string;
  text: string;
  html?: string;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  onChange: (text: string, html?: string) => void;
}

// Khởi tạo TinyMCE sau khung xem trước để giữ bố cục khi tải, như editor của IELTS.
export function RichTextEditor({ label, text, html, placeholder, readOnly, disabled, multiline, onChange }: RichTextEditorProps) {
  const [ready, setReady] = useState(false);
  const toolbarId = useId();
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const safeHtml = isClient && html ? sanitize(html) : undefined;
  const content = safeHtml || escapeText(text);

  const [initialContent] = useState(content);
  const editorRef = useRef<TinyEditor | null>(null);
  const appliedContent = useRef(initialContent);
  const composing = useRef(false);

  // Keep TinyMCE in charge of its DOM while typing. Updating from sanitized HTML on each edit resets IME and undo.
  useEffect(() => {
    if (!multiline || !ready || readOnly || composing.current || content === appliedContent.current) return;
    const editor = editorRef.current;
    if (!editor) return;
    appliedContent.current = content;
    if (editor.getContent() !== content) editor.setContent(content);
  }, [content, multiline, readOnly, ready]);

  const publish = (value: string) => {
    if (multiline && composing.current) return;
    const clean = sanitize(value);
    const paragraph = document.createElement("div");
    paragraph.innerHTML = multiline
      ? clean.replace(/<\/(?:p|div|li)>(?:[ \t]*\r?\n[ \t]*(?=<))?|<br\s*\/?>/gi, "\n")
      : clean.replace(/<\/?(?:p|div|br|li)\b[^>]*>/gi, " ");
    const plain = (paragraph.textContent ?? "").replace(multiline ? /[^\S\n]+/g : /\s+/g, " ").trim();
    const next = plain ? clean : undefined;
    if (multiline) {
      if ((next ?? "") === appliedContent.current) return;
      appliedContent.current = next ?? "";
    }
    onChange(plain, next);
  };

  return <div className="vocab-rich-wrapper">
    {multiline && !readOnly && <div id={toolbarId} />}
    {(!ready || readOnly) && (
      <div className="vocab-rich-field" aria-hidden={!readOnly || undefined}>
        {content ? <div className="vocab-rich-value" dangerouslySetInnerHTML={{ __html: content }} />
          : <div className="text-muted">{readOnly ? "—" : placeholder}</div>}
      </div>
    )}
    {!readOnly && <div className={ready ? undefined : "vocab-rich-loading"} inert={!ready} aria-hidden={!ready || undefined}>
      <Editor
        tinymceScriptSrc={TINYMCE_SRC}
        licenseKey="gpl"
        inline
        tagName="div"
        disabled={disabled}
        {...(multiline ? { initialValue: initialContent } : { value: content })}
        onInit={(_, editor) => {
          editorRef.current = editor;
          const body = editor.getBody();
          body.classList.add("vocab-rich-field", "vocab-rich-value");
          body.setAttribute("role", "textbox");
          body.setAttribute("aria-label", label);
          body.setAttribute("aria-multiline", "true");
          setReady(true);
        }}
        onEditorChange={publish}
        {...(multiline && {
          onInput: (event, editor) => { if (!event.isComposing) publish(editor.getContent()); },
          onCompositionStart: () => { composing.current = true; },
          onCompositionEnd: (_, editor) => {
            composing.current = false;
            publish(editor.getContent());
          },
        })}
        init={{
          menubar: false,
          toolbar: multiline ? "undo redo | bold italic underline | bullist numlist | removeformat" : false,
          ...(multiline && { fixed_toolbar_container: `[id="${toolbarId}"]`, toolbar_persist: true }),
          branding: false,
          promotion: false,
          statusbar: false,
          placeholder,
          plugins: ["lists", "quickbars"],
          quickbars_selection_toolbar: multiline ? false : "bold italic underline | bullist numlist | removeformat",
          quickbars_insert_toolbar: false,
          valid_elements: "p,div,br,strong,b,em,i,u,s,ul,ol,li",
          formats: { underline: { inline: "u", exact: true } },
          paste_data_images: false,
        }}
      />
    </div>}
  </div>;
}
