"use client";
// Ô trả lời câu "Nộp tệp": chọn nhiều tệp, kiểm tra số lượng / dung lượng / loại tệp theo cấu hình câu hỏi, tải lên storage rồi báo danh sách
// tệp đã tải lên cho màn cha ghi vào đáp án. Logic theo frontend/…/file-answer-input.tsx, giao diện kiểu HSK.
import { useRef, useState } from "react";
import { uploadFile } from "@/lib/api/storage-client";
import { DEFAULT_MAX_FILES, DEFAULT_MAX_FILE_BYTES, formatFileSize, isAcceptedFile, type FileAnswerRef } from "@/lib/assessment/file-answer";

interface Props {
  value: FileAnswerRef[];
  onChange: (next: FileAnswerRef[]) => void;
  maxFiles?: number;
  maxFileSizeBytes?: number;
  acceptedMimeTypes?: string[];
  disabled?: boolean;
  /** Báo đang tải lên để màn cha chặn nộp bài cho tới khi xong. */
  onBusyChange?: (busy: boolean) => void;
}

export function LessonFileAnswer({ value, onChange, maxFiles, maxFileSizeBytes, acceptedMimeTypes, disabled, onBusyChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const limit = maxFiles && maxFiles > 0 ? maxFiles : DEFAULT_MAX_FILES;
  const sizeLimit = maxFileSizeBytes && maxFileSizeBytes > 0 ? maxFileSizeBytes : DEFAULT_MAX_FILE_BYTES;
  const accept = acceptedMimeTypes?.length ? acceptedMimeTypes.join(",") : undefined;

  const setBusy = (busy: boolean) => {
    setUploading(busy);
    onBusyChange?.(busy);
  };

  const handle = async (picked: FileList | null) => {
    if (!picked?.length) return;
    setError("");
    const files = Array.from(picked);
    if (value.length + files.length > limit) return setError(`Chỉ được nộp tối đa ${limit} tệp.`);
    for (const file of files) {
      if (file.size > sizeLimit) return setError(`"${file.name}" lớn hơn ${formatFileSize(sizeLimit)}.`);
      if (!isAcceptedFile(file, acceptedMimeTypes)) return setError(`"${file.name}" không thuộc loại tệp được phép.`);
    }
    setBusy(true);
    const uploaded: FileAnswerRef[] = [];
    try {
      for (const file of files) {
        const meta = await uploadFile(file);
        uploaded.push({ fileId: meta.fileId, fileName: meta.filename || file.name, mimeType: meta.mimeType || file.type || undefined, sizeBytes: meta.sizeBytes ?? file.size });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải tệp lên thất bại. Vui lòng thử lại.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
      // Các tệp đã tải xong trước khi lỗi vẫn được giữ lại.
      if (uploaded.length) onChange([...value, ...uploaded]);
    }
  };

  return (
    <div className="hsk-record-box">
      <strong>
        Nộp tệp ({value.length}/{limit})
      </strong>
      <p>
        Mỗi tệp tối đa {formatFileSize(sizeLimit)}
        {acceptedMimeTypes?.length ? ` · Loại cho phép: ${acceptedMimeTypes.join(", ")}` : ""}
      </p>
      <button type="button" disabled={disabled || uploading || value.length >= limit} onClick={() => input.current?.click()}>
        {uploading ? "Đang tải lên…" : "Chọn tệp"}
      </button>
      <input ref={input} type="file" hidden aria-label="Chọn tệp nộp" multiple={limit - value.length > 1} accept={accept} onChange={(event) => void handle(event.target.files)} />
      {error && <p role="alert">{error}</p>}
      {value.length > 0 && (
        <ul>
          {value.map((file) => (
            <li key={file.fileId}>
              <span>{file.fileName || file.fileId}</span> <small>{formatFileSize(file.sizeBytes)}</small>{" "}
              <button type="button" disabled={disabled || uploading} title="Bỏ tệp này" onClick={() => onChange(value.filter((f) => f.fileId !== file.fileId))}>
                Bỏ
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
