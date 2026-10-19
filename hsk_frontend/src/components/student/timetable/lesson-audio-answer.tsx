"use client";
// Ô trả lời câu "Ghi âm": ghi bằng micro (MediaRecorder), nghe lại, ghi lại, tải bản ghi lên storage. Trình duyệt không ghi âm được
// (hoặc không cấp quyền micro) thì cho chọn một tệp âm thanh có sẵn. Logic theo frontend/…/audio-answer-input.tsx, giao diện kiểu HSK.
import { useEffect, useRef, useState } from "react";
import { fileUrl, uploadFile } from "@/lib/api/storage-client";
import { AUDIO_MAX_SECONDS, DEFAULT_MAX_FILE_BYTES, formatFileSize, type FileAnswerRef } from "@/lib/assessment/file-answer";

interface Props {
  value: FileAnswerRef | null;
  onChange: (next: FileAnswerRef | null) => void;
  maxSeconds?: number;
  maxFileSizeBytes?: number;
  disabled?: boolean;
  /** Báo đang ghi/đang tải lên để màn cha chặn nộp bài cho tới khi xong. */
  onBusyChange?: (busy: boolean) => void;
}

type Phase = "idle" | "preparing" | "recording" | "uploading";

// Chọn định dạng ghi mà trình duyệt hỗ trợ (Chrome/Firefox: webm, Safari: mp4).
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
}

const extensionOf = (mime: string) => (mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm");

export function LessonAudioAnswer({ value, onChange, maxSeconds = AUDIO_MAX_SECONDS, maxFileSizeBytes, disabled, onBusyChange }: Props) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const retry = useRef<{ file: File; seconds?: number } | null>(null);
  const sizeLimit = maxFileSizeBytes && maxFileSizeBytes > 0 ? maxFileSizeBytes : DEFAULT_MAX_FILE_BYTES;
  const canRecord = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const busy = phase !== "idle";

  const setPhase = (next: Phase) => {
    onBusyChange?.(next !== "idle");
    setPhaseState(next);
  };

  const stopStream = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  // Rời câu giữa lúc ghi: tắt micro, bỏ bản ghi dở. Báo cha hết bận để nút nộp bài không bị kẹt.
  useEffect(
    () => () => {
      if (recorder.current && recorder.current.state !== "inactive") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stopStream();
      onBusyChange?.(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi gỡ component
    [],
  );

  const upload = async (file: File, seconds?: number) => {
    if (file.size > sizeLimit) {
      setPhase("idle");
      setError(`Bản ghi lớn hơn ${formatFileSize(sizeLimit)}. Hãy ghi ngắn hơn.`);
      return;
    }
    setPhase("uploading");
    setError("");
    retry.current = { file, seconds };
    try {
      const meta = await uploadFile(file);
      onChange({ fileId: meta.fileId, fileName: meta.filename || file.name, mimeType: meta.mimeType || file.type || undefined, sizeBytes: meta.sizeBytes ?? file.size, durationSeconds: seconds });
      retry.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải bản ghi lên thất bại. Vui lòng thử lại.");
    } finally {
      setPhase("idle");
    }
  };

  const stopRecording = () => {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  };

  const startRecording = async () => {
    setError("");
    setPhase("preparing");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mimeType = pickMimeType();
      const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      instance.onstop = () => {
        const seconds = Math.round(((Date.now() - startedAt.current) / 1000) * 10) / 10;
        const type = instance.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        stopStream();
        if (blob.size === 0) {
          setPhase("idle");
          setError("Không ghi được âm thanh. Hãy kiểm tra micro và thử lại.");
          return;
        }
        void upload(new File([blob], `ghi-am-${Date.now()}.${extensionOf(type)}`, { type }), seconds);
      };
      recorder.current = instance;
      startedAt.current = Date.now();
      setElapsed(0);
      instance.start();
      setPhase("recording");
      timer.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
        setElapsed(seconds);
        if (seconds >= maxSeconds) stopRecording();
      }, 500);
    } catch {
      stopStream();
      setPhase("idle");
      setError("Không truy cập được micro. Hãy cấp quyền thu âm hoặc chọn một tệp âm thanh.");
    }
  };

  const src = value ? fileUrl(value.fileId) : null;
  const title = phase === "recording" ? `Đang thu âm… ${elapsed}s` : phase === "uploading" ? "Đang tải bản ghi lên…" : value ? "Đã có bản ghi" : "Nhấn micro để bắt đầu thu âm";

  return (
    <div className="hsk-record-box">
      {canRecord && (
        <button type="button" className={`lesson-record-mic ${phase === "recording" ? "is-recording" : ""}`} aria-label={phase === "recording" ? "Dừng thu âm" : value ? "Ghi âm lại" : "Bắt đầu thu âm"} disabled={disabled || phase === "uploading" || phase === "preparing"} onClick={() => (phase === "recording" ? stopRecording() : void startRecording())}>
          <i className="fa-solid fa-microphone" aria-hidden="true" />
        </button>
      )}
      <strong>{title}</strong>
      <p>
        Tối đa {Math.floor(maxSeconds / 60)} phút{maxSeconds % 60 ? ` ${maxSeconds % 60} giây` : ""}. Bạn có thể nghe lại và ghi lại trước khi nộp.
        {!canRecord && " Trình duyệt này không ghi âm trực tiếp được, hãy chọn một tệp âm thanh."}
      </p>
      {src && <audio controls src={src} />}
      {value && !src && <small>Bản ghi đã tải lên ({value.fileName || value.fileId}).</small>}
      <div>
        <button type="button" disabled={disabled || busy} onClick={() => picker.current?.click()}>
          Chọn tệp âm thanh
        </button>
        {value && (
          <button type="button" disabled={disabled || busy} onClick={() => onChange(null)}>
            Xoá bản ghi
          </button>
        )}
      </div>
      <input
        ref={picker}
        type="file"
        accept="audio/*"
        hidden
        aria-label="Tệp âm thanh"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error && (
        <p role="alert">
          {error}{" "}
          {retry.current && (
            <button type="button" disabled={disabled || busy} onClick={() => retry.current && void upload(retry.current.file, retry.current.seconds)}>
              Thử tải lại bản ghi
            </button>
          )}
        </p>
      )}
    </div>
  );
}
