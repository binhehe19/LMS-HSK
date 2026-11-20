// Mã hoá/giải mã đáp án của học viên theo định dạng bộ chấm của backend (QuestionAutoGrader):
//   trắc nghiệm -> {"selectedOptionIndex": n}          chọn nhiều   -> {"selectedOptionIndexes": [n, ...]}
//   câu nối     -> {"matchingAnswers": {"<pairIndex>": <optionIndex của lựa chọn>}}  (chấm theo chỉ số: hai lựa chọn trùng chữ vẫn phân biệt)
//   câu điền    -> {"blankAnswers": {"<blankIndex>": "<chữ nhập>"}}
//   xếp câu     -> {"chunkOrder": [chỉ số trong sentenceChunks, ...]}      tự luận -> {"text": "..."}
// Chuỗi rỗng = chưa trả lời. Backend ghi đè đáp án theo CÂU nên luôn mã hoá đủ mọi ý đã có của câu.

import { audioFromAnswer, filesFromAnswer, type FileAnswerRef } from "@/lib/assessment/file-answer";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {});

export function parseAnswer(json: string | null | undefined): Obj {
  if (!json) return {};
  try {
    return obj(JSON.parse(json));
  } catch {
    return {};
  }
}

/** Khoá của một ý trong câu nối/câu điền: `pairIndex`/`blankIndex` của backend, thiếu thì theo vị trí (khớp cách backend chấm). */
export function partKey(item: unknown, index: number, field: "pairIndex" | "blankIndex"): string {
  const value = obj(item)[field];
  return String(Number.isInteger(value) ? value : index);
}

/** Số của một lựa chọn trong đáp án: `optionIndex` của backend, thiếu thì theo vị trí. */
export const optionValue = (option: unknown, index: number): number => {
  const value = obj(option).optionIndex;
  return Number.isInteger(value) ? (value as number) : index;
};

export const encodeChoice = (value: number | null): string => (value === null ? "" : JSON.stringify({ selectedOptionIndex: value }));

export const encodeMultiple = (values: number[]): string => (values.length ? JSON.stringify({ selectedOptionIndexes: [...values].sort((a, b) => a - b) }) : "");

/** Câu nối: dòng -> optionIndex đã chọn; bỏ dòng chưa chọn; không còn dòng nào thì là chưa trả lời. */
export function encodeMatching(values: Record<string, number | null | undefined>): string {
  const filled = Object.entries(values).filter((entry): entry is [string, number] => Number.isInteger(entry[1]));
  return filled.length ? JSON.stringify({ matchingAnswers: Object.fromEntries(filled) }) : "";
}

/** Câu nối: dòng -> optionIndex đã chọn (giá trị không phải số bị bỏ). Nhận cả chuỗi JSON lẫn đối tượng đã parse. */
export function matchingAnswers(answer: string | Obj | null | undefined): Record<string, number> {
  const value = obj((typeof answer === "string" || answer == null ? parseAnswer(answer as string | null) : answer).matchingAnswers);
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => Number.isInteger(entry[1])));
}

/** Nhãn của lựa chọn có optionIndex = value: nội dung chữ, rỗng thì chữ cái theo vị trí (A, B…); không tìm thấy thì "". */
export function optionLabel(options: unknown, value: number | null | undefined): string {
  if (!Number.isInteger(value)) return "";
  const list = Array.isArray(options) ? options : [];
  const index = list.findIndex((option, i) => optionValue(option, i) === value);
  if (index < 0) return "";
  const content = obj(list[index]).content;
  return typeof content === "string" && content.trim() ? content : String.fromCharCode(65 + index);
}

/** Câu điền: bỏ ý để trống; không còn ý nào thì là chưa trả lời. */
export function encodeKeyed(field: "blankAnswers", values: Record<string, string>): string {
  const filled = Object.entries(values).filter(([, text]) => text.trim() !== "");
  return filled.length ? JSON.stringify({ [field]: Object.fromEntries(filled) }) : "";
}

export const encodeChunks = (order: number[]): string => (order.length ? JSON.stringify({ chunkOrder: order }) : "");

export const encodeText = (text: string): string => (text.trim() === "" ? "" : JSON.stringify({ text }));

/** Ghi âm: một bản ghi đã tải lên storage. Backend (QuizAnswerSanitizer) chỉ giữ fileId, fileName, mimeType, sizeBytes, durationSeconds. */
export const encodeAudio = (audio: FileAnswerRef | null): string => (audio ? JSON.stringify({ audio }) : "");

/** Nộp tệp: các tệp đã tải lên storage (backend giữ tối đa `maxFiles` tệp). */
export const encodeFiles = (files: FileAnswerRef[]): string => (files.length ? JSON.stringify({ files }) : "");

export const answerAudio = (json: string | undefined): FileAnswerRef | null => audioFromAnswer(parseAnswer(json));

export const answerFiles = (json: string | undefined): FileAnswerRef[] => filesFromAnswer(parseAnswer(json));

export const selectedChoice = (json: string | undefined): number | null => {
  const value = parseAnswer(json).selectedOptionIndex;
  return Number.isInteger(value) ? (value as number) : null;
};

export const selectedMultiple = (json: string | undefined): number[] => {
  const value = parseAnswer(json).selectedOptionIndexes;
  return Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v)) : [];
};

export function keyedAnswers(json: string | undefined, field: "blankAnswers"): Record<string, string> {
  const value = obj(parseAnswer(json)[field]);
  return Object.fromEntries(Object.entries(value).map(([key, text]) => [key, typeof text === "string" ? text : ""]));
}

export const chunkOrder = (json: string | undefined): number[] => {
  const value = parseAnswer(json).chunkOrder;
  return Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v)) : [];
};

export const answerText = (json: string | undefined): string => {
  const value = parseAnswer(json).text;
  return typeof value === "string" ? value : "";
};

export const isAnswered = (json: string | undefined): boolean => !!json && json.trim() !== "";
