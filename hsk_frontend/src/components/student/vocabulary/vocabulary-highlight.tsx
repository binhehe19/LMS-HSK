import { Fragment } from "react";
import { splitHighlight } from "@/lib/dictionary/vocabulary-detail-model";

/** Tô đỏ chữ đang tra trong câu (trang chi tiết dùng lớp "hl", popup hội thoại dùng "cv-hl" như bản cũ). */
export function VocabularyHighlight({ text, needle, className }: { text: string; needle: string; className: string }) {
  return (
    <>
      {splitHighlight(text, needle).map((part, i) => (
        <Fragment key={i}>{part.hit ? <span className={className}>{part.text}</span> : part.text}</Fragment>
      ))}
    </>
  );
}
