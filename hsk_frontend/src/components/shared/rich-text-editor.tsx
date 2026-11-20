"use client";

import { useState, useSyncExternalStore } from "react";
import { Editor } from "@tinymce/tinymce-react";
import DOMPurify from "dompurify";

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
  onChange: (text: string, html?: string) => void;
}

// Khởi tạo TinyMCE sau khung xem trước để giữ bố cục khi tải, như editor của IELTS.
export function RichTextEditor({ label, text, html, placeholder, readOnly, disabled, onChange }: RichTextEditorProps) {
  const [ready, setReady] = useState(false);
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const safeHtml = isClient && html ? sanitize(html) : undefined;
  const content = safeHtml ?? escapeText(text);

  return <div className="vocab-rich-wrapper">
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
        value={content}
        onInit={(_, editor) => {
          const body = editor.getBody();
          body.classList.add("vocab-rich-field", "vocab-rich-value");
          body.setAttribute("role", "textbox");
          body.setAttribute("aria-label", label);
          body.setAttribute("aria-multiline", "true");
          setReady(true);
        }}
        onEditorChange={value => {
          const clean = sanitize(value);
          const paragraph = document.createElement("div");
          paragraph.innerHTML = clean.replace(/<\/?(?:p|div|br|li)\b[^>]*>/gi, " ");
          const plain = (paragraph.textContent ?? "").replace(/\s+/g, " ").trim();
          onChange(plain, plain ? clean : undefined);
        }}
        init={{
          menubar: false,
          toolbar: false,
          branding: false,
          promotion: false,
          statusbar: false,
          placeholder,
          plugins: ["lists", "quickbars"],
          quickbars_selection_toolbar: "bold italic underline | bullist numlist | removeformat",
          quickbars_insert_toolbar: false,
          valid_elements: "p,div,br,strong,b,em,i,u,s,ul,ol,li",
          formats: { underline: { inline: "u", exact: true } },
          paste_data_images: false,
        }}
      />
    </div>}
  </div>;
}
