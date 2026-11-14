// Sao chép từ frontend/ (cùng hợp đồng backend); sửa ở một nơi thì sửa nơi kia.
// Đáp án dạng tệp của câu "Nộp file" ({"files":[...]}) và "Ghi âm" ({"audio":{...}}). Backend (QuizAnswerSanitizer) chỉ
// giữ đúng các trường này khi nộp bài.
export interface FileAnswerRef {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  /** Chỉ có với bản ghi âm. */
  durationSeconds?: number;
}

export const DEFAULT_MAX_FILES = 3;
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const AUDIO_MAX_SECONDS = 180;

export function formatFileSize(bytes: number | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Loại tệp được phép: danh sách rỗng = mọi loại; hỗ trợ ký tự đại diện kiểu "image/*" và đuôi tệp kiểu ".pdf".
export function isAcceptedFile(file: File, accepted: string[] | undefined): boolean {
  if (!accepted || accepted.length === 0) return true;
  return accepted.some((rule) => {
    const r = rule.trim().toLowerCase();
    if (!r) return false;
    if (r.startsWith(".")) return file.name.toLowerCase().endsWith(r);
    if (r.endsWith("/*")) return file.type.toLowerCase().startsWith(r.slice(0, -1));
    return file.type.toLowerCase() === r;
  });
}

// Đọc danh sách tệp từ đáp án JSON đã parse (an toàn với dữ liệu lạ).
export function filesFromAnswer(answer: unknown): FileAnswerRef[] {
  const files = (answer as { files?: unknown } | null)?.files;
  if (!Array.isArray(files)) return [];
  return files.filter((f): f is FileAnswerRef => typeof f?.fileId === "string");
}

export function audioFromAnswer(answer: unknown): FileAnswerRef | null {
  const audio = (answer as { audio?: unknown } | null)?.audio as FileAnswerRef | null | undefined;
  return audio && typeof audio.fileId === "string" ? audio : null;
}
