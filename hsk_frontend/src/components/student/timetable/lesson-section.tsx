"use client";
import { LessonAudio } from "./lesson-audio";
import { safeResourceUrl } from "./lesson-source";
import { plainText } from "./timetable-source";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const isImage = (file: Obj) => /^image\//i.test(String(file.mimeType ?? "")) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(String(file.name ?? ""));

/** Phần của bài làm chứa câu `questionId` (layout v2): mỗi câu thuộc đúng một phần. */
export function sectionOfQuestion(content: unknown, questionId: unknown): Obj | null {
  if (typeof questionId !== "string") return null;
  const found = list(obj(obj(content).layout).sections).find((section) => list(obj(section).questionIds).includes(questionId));
  return found ? obj(found) : null;
}

/** Văn bản chung của phần thành các đoạn thuần (HTML bị bỏ thẻ, không render HTML): xuống dòng ở </p> và <br>. */
export const sectionParagraphs = (html: unknown): string[] => (typeof html === "string" ? html.split(/<\/p>|<br\s*\/?>/i).map(plainText).filter(Boolean) : []);

/** Đoạn đọc, ảnh và audio dùng chung của phần, hiện phía trên câu hỏi. Audio chỉ hiện cho bài nghe/nói (`showAudio`). */
export function LessonSection({ section, showAudio }: { section: Obj | null; showAudio: boolean }) {
  if (!section) return null;
  const paragraphs = sectionParagraphs(section.content);
  const images = list(section.files).map(obj).filter(isImage).flatMap((file) => {
    const src = safeResourceUrl(typeof file.url === "string" ? file.url : undefined);
    return src ? [{ src, alt: typeof file.name === "string" ? file.name : "Hình minh hoạ" }] : [];
  });
  const audios = showAudio ? list(section.media).map(obj).filter((m) => m.kind === "audio") : [];
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
