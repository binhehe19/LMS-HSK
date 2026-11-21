"use client";
import { LessonAudio } from "./lesson-audio";
import { safeResourceUrl } from "./lesson-source";
import { plainText } from "./timetable-source";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
// Tên quy ước của ảnh đề: "passage-image" (ảnh chung của phần) và "question-image" (ảnh của câu). Dữ liệu chuyển từ LMS 1.0
// (backend/scripts/migrate-lms1/load-quizzes.mjs) ghi {url, name} KHÔNG có mimeType và url /api/storage/file/<id> không có đuôi,
// nên phải nhận theo tên; màn sửa đề HSK (lms-quiz-client withImage) cũng dùng tên "passage-image".
const IMAGE_FILE_NAMES = new Set(["passage-image", "question-image"]);
const isImage = (file: Obj) => {
  const name = String(file.name ?? "");
  return /^image\//i.test(String(file.mimeType ?? "")) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name) || (!file.mimeType && IMAGE_FILE_NAMES.has(name));
};

/** Ảnh trong danh sách tệp [{url, name, mimeType}] (của phần hoặc của câu), chỉ giữ đường dẫn an toàn. */
export function imagesOf(files: unknown): { src: string; alt: string }[] {
  return list(files).map(obj).filter(isImage).flatMap((file) => {
    const src = safeResourceUrl(typeof file.url === "string" ? file.url : undefined);
    const name = typeof file.name === "string" && !IMAGE_FILE_NAMES.has(file.name) ? file.name : "Hình minh hoạ";
    return src ? [{ src, alt: name }] : [];
  });
}

/** Phần của bài làm chứa câu `questionId` (layout v2): mỗi câu thuộc đúng một phần. */
export function sectionOfQuestion(content: unknown, questionId: unknown): Obj | null {
  if (typeof questionId !== "string") return null;
  const layout = obj(obj(content).layout);
  const sections = list(layout.sections);
  const found = sections.find((section) => list(obj(section).questionIds).includes(questionId));
  if (found) return obj(found);
  const passage = obj(layout.meta).passageText;
  return !sections.length && typeof passage === "string" && passage.trim() ? { content: passage } : null;
}

/** Văn bản chung của phần thành các đoạn thuần (HTML bị bỏ thẻ, không render HTML): xuống dòng ở </p> và <br>. */
export const sectionParagraphs = (html: unknown): string[] => (typeof html === "string" ? html.split(/<\/p>|<br\s*\/?>/i).map(plainText).filter(Boolean) : []);

/** Đoạn đọc, ảnh và audio dùng chung của phần, hiện phía trên câu hỏi (audio ở mọi kỹ năng, như LMS 1.0). */
export function LessonSection({ section }: { section: Obj | null }) {
  if (!section) return null;
  const paragraphs = sectionParagraphs(section.content);
  const images = imagesOf(section.files);
  const audios = list(section.media).map(obj).filter((m) => m.kind === "audio");
  if (!paragraphs.length && !images.length && !audios.length) return null;
  return (
    <div className="hsk-section-context">
      {audios.map((media, i) => (
        <LessonAudio key={i} url={typeof media.url === "string" ? media.url : undefined} />
      ))}
      {images.map((image, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh storage nội bộ, kích thước không biết trước
        <img key={i} src={image.src} alt={image.alt} style={{ maxWidth: "100%" }} />
      ))}
      {paragraphs.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
    </div>
  );
}
