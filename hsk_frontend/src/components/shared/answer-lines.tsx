import { RichTextEditor } from "./rich-text-editor";
import type { AnswerLine } from "@/lib/assessment/answer-parts";

/** Các dòng đáp án của học viên; dòng có `correct` được đánh dấu ✓ (xanh) hoặc ✗ (đỏ). Màu viết tại chỗ để dùng được ở cả màn học viên và màn quản lý. */
export function AnswerLines({ lines }: { lines: readonly AnswerLine[] }) {
  return (
    <div>
      {lines.map((line, i) => (
        <div key={i} style={{ whiteSpace: "pre-line", color: line.correct === undefined ? undefined : line.correct ? "#2e7d4f" : "#bd071b" }}>
          {line.correct !== undefined && <span aria-label={line.correct ? "Đúng" : "Sai"}>{line.correct ? "✓ " : "✗ "}</span>}
          {line.html ? <RichTextEditor label="Câu trả lời" text={line.text} html={line.html} readOnly onChange={() => {}} /> : line.text}
        </div>
      ))}
    </div>
  );
}
