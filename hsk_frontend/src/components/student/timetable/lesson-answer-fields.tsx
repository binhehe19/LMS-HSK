"use client";
import {
  answerAudio,
  answerFiles,
  answerText,
  chunkOrder,
  encodeAudio,
  encodeChoice,
  encodeChunks,
  encodeFiles,
  encodeKeyed,
  encodeMultiple,
  encodeText,
  keyedAnswers,
  optionValue,
  partKey,
  selectedChoice,
  selectedMultiple,
} from "@/lib/assessment/answer-codec";
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

function Choice({ question, value, onChange, disabled }: AnswerFieldsProps) {
  const options = list(question.options);
  const picked = selectedChoice(value);
  return (
    <div className="hsk-answer-options" role="radiogroup">
      {options.map((option, i) => {
        const v = optionValue(option, i);
        return (
          <button type="button" key={i} role="radio" aria-checked={picked === v} disabled={disabled} className={picked === v ? "is-selected" : ""} onClick={() => onChange(encodeChoice(v))}>
            <span>{String.fromCharCode(65 + i)}</span>
            {str(obj(option).content)}
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
            <span>{String.fromCharCode(65 + i)}</span>
            {str(obj(option).content)}
          </button>
        );
      })}
    </div>
  );
}

function Matching({ question, value, onChange, disabled }: AnswerFieldsProps) {
  const given = keyedAnswers(value, "matchingAnswers");
  const choices = list(question.options).map((option) => str(obj(option).content));
  return (
    <div className="lesson-matching-fields">
      {list(question.matchingPairs).map((pair, i) => {
        const key = partKey(pair, i, "pairIndex");
        return (
          <label key={key}>
            <span>{str(obj(pair).prompt)}</span>
            <select value={given[key] ?? ""} disabled={disabled} onChange={(e) => onChange(encodeKeyed("matchingAnswers", { ...given, [key]: e.target.value }))}>
              <option value="">Chọn đáp án</option>
              {choices.map((choice, j) => (
                <option key={j} value={choice}>
                  {choice}
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
  const unused = chunks.map((_, i) => i).filter((i) => !order.includes(i));
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

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

function Essay({ question, value, onChange, disabled }: AnswerFieldsProps) {
  const text = answerText(value);
  const minimum = typeof question.minimumWords === "number" ? question.minimumWords : 0;
  return (
    <div className="hsk-answer-field">
      <textarea aria-label="Câu trả lời" value={text} disabled={disabled} onChange={(e) => onChange(encodeText(e.target.value))} placeholder="Nhập câu trả lời của bạn…" />
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
