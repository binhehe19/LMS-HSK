"use client";
import {
  answerAudio,
  answerFiles,
  answerHtml,
  answerText,
  chunkOrder,
  encodeAudio,
  encodeChoice,
  encodeChunks,
  encodeFiles,
  encodeKeyed,
  encodeMatching,
  encodeMultiple,
  encodeText,
  keyedAnswers,
  matchingAnswers,
  optionLabel,
  optionValue,
  partKey,
  selectedChoice,
  selectedMultiple,
} from "@/lib/assessment/answer-codec";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { safeResourceUrl } from "./lesson-source";
import { plainText } from "./timetable-source";
import { LessonAudioAnswer } from "./lesson-audio-answer";
import { LessonFileAnswer } from "./lesson-file-answer";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string => (typeof value === "string" ? plainText(value) : "");

export interface AnswerFieldsProps {
  /** Câu hỏi công khai của bài làm (không có đáp án đúng). */
  question: Obj;
  /** Đáp án hiện tại của câu, dạng JSON backend; rỗng = chưa trả lời. */
  value: string;
  onChange: (answerJson: string) => void;
  disabled?: boolean;
  /** Câu ghi âm / nộp tệp báo đang ghi hoặc tải lên, để màn cha chặn nộp bài cho tới khi xong. */
  onBusyChange?: (busy: boolean) => void;
}

const numberOf = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);
const letter = (i: number) => String.fromCharCode(65 + i);
const imageOf = (value: unknown): string | null => safeResourceUrl(typeof value === "string" ? value : undefined);

/**
 * Thứ tự trộn cố định theo `seed` (id câu): như LMS 1.0 luôn trộn mảnh ghép câu và vế nối, để thứ tự lưu không lộ đáp án;
 * cùng một câu luôn ra cùng thứ tự nên không nhảy khi màn vẽ lại. Chỉ đổi thứ tự hiển thị, giá trị trả lời giữ nguyên.
 */
export function shuffledOrder(count: number, seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const next = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function OptionImage({ url, alt }: { url: unknown; alt: string }) {
  const src = imageOf(url);
  // eslint-disable-next-line @next/next/no-img-element -- ảnh storage nội bộ, kích thước không biết trước
  return src ? <img className="hsk-answer-image" src={src} alt={alt} /> : null;
}

/** Chữ của lựa chọn, bỏ trống khi chữ chỉ là nhãn trùng chữ cái của ô ("A", "A.") để không hiện "A … A" (đề chọn tranh của LMS 1.0). */
function optionText(option: unknown, i: number): string {
  const text = str(obj(option).content);
  return /^[A-Z]\.?$/.test(text.trim()) && text.trim()[0] === letter(i) ? "" : text;
}

function Choice({ question, value, onChange, disabled }: AnswerFieldsProps) {
  const options = list(question.options);
  const picked = selectedChoice(value);
  return (
    <div className="hsk-answer-options" role="radiogroup">
      {options.map((option, i) => {
        const v = optionValue(option, i);
        return (
          <button type="button" key={i} role="radio" aria-checked={picked === v} disabled={disabled} className={picked === v ? "is-selected" : ""} onClick={() => onChange(encodeChoice(v))}>
            <span>{letter(i)}</span>
            <OptionImage url={obj(option).mediaUrl} alt={`Đáp án ${letter(i)}`} />
            {optionText(option, i)}
          </button>
        );
      })}
    </div>
  );
}

function Multiple({ question, value, onChange, disabled }: AnswerFieldsProps) {
  const picked = selectedMultiple(value);
  const toggle = (v: number) => onChange(encodeMultiple(picked.includes(v) ? picked.filter((p) => p !== v) : [...picked, v]));
  return (
    <div className="hsk-answer-options" role="group">
      {list(question.options).map((option, i) => {
        const v = optionValue(option, i);
        return (
          <button type="button" key={i} role="checkbox" aria-checked={picked.includes(v)} disabled={disabled} className={picked.includes(v) ? "is-selected" : ""} onClick={() => toggle(v)}>
            <span>{letter(i)}</span>
            <OptionImage url={obj(option).mediaUrl} alt={`Đáp án ${letter(i)}`} />
            {optionText(option, i)}
          </button>
        );
      })}
    </div>
  );
}

function Matching({ question, value, onChange, disabled }: AnswerFieldsProps) {
  const given = matchingAnswers(value);
  const options = list(question.options);
  // Giá trị gửi là optionIndex (chấm theo chỉ số); nhãn là chữ của lựa chọn, rỗng thì chữ cái theo vị trí lưu.
  const all = options.map((option, i) => ({ value: optionValue(option, i), label: plainText(optionLabel(options, optionValue(option, i))), mediaUrl: obj(option).mediaUrl }));
  const choices = shuffledOrder(all.length, `${String(question.questionId ?? "")}:choices`).map((i) => all[i]);
  const withImages = choices.some((choice) => imageOf(choice.mediaUrl));
  return (
    <div className="lesson-matching-fields">
      {withImages && (
        <ol className="lesson-matching-choices" aria-label="Các lựa chọn">
          {choices.map((choice) => (
            <li key={choice.value}>
              <strong>{choice.label}</strong>
              <OptionImage url={choice.mediaUrl} alt={`Lựa chọn ${choice.label}`} />
            </li>
          ))}
        </ol>
      )}
      {list(question.matchingPairs).map((pair, i) => {
        const key = partKey(pair, i, "pairIndex");
        return (
          <label key={key}>
            <span>
              <OptionImage url={obj(pair).promptMediaUrl} alt={`Dòng ${i + 1}`} />
              {str(obj(pair).prompt)}
            </span>
            <select
              value={given[key] === undefined ? "" : String(given[key])}
              disabled={disabled}
              onChange={(e) => onChange(encodeMatching({ ...given, [key]: e.target.value === "" ? null : Number(e.target.value) }))}
            >
              <option value="">Chọn đáp án</option>
              {choices.map((choice) => (
                <option key={choice.value} value={String(choice.value)}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

/** Câu điền: `{{n}}` trong đề là chỗ trống thứ n (khoá `blankIndex` = n-1). */
function Blanks({ question, value, onChange, disabled }: AnswerFieldsProps) {
  const given = keyedAnswers(value, "blankAnswers");
  const text = (typeof question.questionText === "string" ? question.questionText : "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ");
  const set = (key: string, next: string) => onChange(encodeKeyed("blankAnswers", { ...given, [key]: next }));
  return (
    <div className="lesson-fill-blanks">
      {text.split(/(\{\{\d+\}\})/g).map((part, i) => {
        const marker = /^\{\{(\d+)\}\}$/.exec(part);
        if (!marker) return <span key={i}>{part}</span>;
        const key = String(Number(marker[1]) - 1);
        return <input key={i} aria-label={`Ô trống ${marker[1]}`} value={given[key] ?? ""} disabled={disabled} onChange={(e) => set(key, e.target.value)} />;
      })}
    </div>
  );
}

function Chunks({ question, value, onChange, disabled }: AnswerFieldsProps) {
  const chunks = list(question.sentenceChunks).map((chunk) => str(obj(chunk).content));
  const order = chunkOrder(value);
  const unused = shuffledOrder(chunks.length, `${String(question.questionId ?? "")}:chunks`).filter((i) => !order.includes(i));
  return (
    <div className="lesson-sentence-builder">
      <div aria-label="Các mảnh câu">
        {unused.map((i) => (
          <button key={i} type="button" disabled={disabled} onClick={() => onChange(encodeChunks([...order, i]))}>
            {chunks[i]}
          </button>
        ))}
      </div>
      <div aria-label="Câu đã xếp">
        {order.map((i, position) => (
          <button key={`${i}-${position}`} type="button" className="is-selected" disabled={disabled} title="Bấm để bỏ mảnh này" onClick={() => onChange(encodeChunks(order.filter((_, p) => p !== position)))}>
            {chunks[i]}
          </button>
        ))}
      </div>
      <button type="button" disabled={disabled || !order.length} onClick={() => onChange("")}>
        Làm lại
      </button>
    </div>
  );
}

const chineseSegmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh", { granularity: "word" }) : null;
const wordCount = (text: string) => {
  if (chineseSegmenter && /\p{Script=Han}/u.test(text)) {
    return Array.from(chineseSegmenter.segment(text)).filter(word => word.isWordLike).length;
  }
  return text.trim() ? text.trim().split(/\s+/).length : 0;
};

function Essay({ question, value, onChange, disabled }: AnswerFieldsProps) {
  const text = answerText(value);
  const minimum = typeof question.minimumWords === "number" ? question.minimumWords : 0;
  return (
    <div className="hsk-answer-field hsk-essay-answer">
      <RichTextEditor
        label="Câu trả lời"
        placeholder="Nhập câu trả lời của bạn…"
        text={text}
        html={answerHtml(value)}
        multiline
        disabled={disabled}
        onChange={(nextText, html) => onChange(encodeText(nextText, html))}
      />
      <small>
        {wordCount(text)} từ{minimum ? ` · tối thiểu ${minimum} từ` : ""}
      </small>
    </div>
  );
}

/** Ô trả lời theo loại câu. Ghi âm và nộp tệp chưa nộp được qua luồng này (cần tải lên storage). */
export function AnswerFields(props: AnswerFieldsProps) {
  switch (props.question.questionType) {
    case "MULTIPLE_CHOICE":
      return <Choice {...props} />;
    case "MULTIPLE_SELECT":
      return <Multiple {...props} />;
    case "MATCHING":
      return <Matching {...props} />;
    case "FILL_IN_BLANK":
      return <Blanks {...props} />;
    case "SENTENCE_BUILDER":
      return <Chunks {...props} />;
    case "AUDIO_RESPONSE":
      return <LessonAudioAnswer value={answerAudio(props.value)} onChange={(audio) => props.onChange(encodeAudio(audio))} maxFileSizeBytes={numberOf(props.question.maxFileSizeBytes)} disabled={props.disabled} onBusyChange={props.onBusyChange} />;
    case "FILE_UPLOAD":
      return (
        <LessonFileAnswer
          value={answerFiles(props.value)}
          onChange={(files) => props.onChange(encodeFiles(files))}
          maxFiles={numberOf(props.question.maxFiles)}
          maxFileSizeBytes={numberOf(props.question.maxFileSizeBytes)}
          acceptedMimeTypes={Array.isArray(props.question.acceptedMimeTypes) ? props.question.acceptedMimeTypes.filter((t): t is string => typeof t === "string") : undefined}
          disabled={props.disabled}
          onBusyChange={props.onBusyChange}
        />
      );
    default:
      return <Essay {...props} />;
  }
}
