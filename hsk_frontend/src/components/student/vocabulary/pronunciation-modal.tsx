"use client";

// Popup Luyện phát âm (pronunciation-modal.tsx của HSK cũ): nghe câu mẫu, ghi âm bằng MediaRecorder rồi nghe lại. Như bản cũ, KHÔNG chấm điểm.
// Khác bản cũ: nghe lại bằng thẻ <audio controls> của trình duyệt thay cho AppAudioPlayer (trình phát dùng chung chưa chuyển sang).
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AssetImage } from "@/components/shared/asset-image";
import { alignPinyin } from "@/lib/dictionary/vocabulary-detail-model";
import { PracticeModal } from "./practice-modal";

interface PronunciationModalProps {
  /** câu chữ Hán để luyện, vd "我去了那座山。" */
  sentenceCn: string;
  /** pinyin của câu, các âm tiết cách nhau bởi khoảng trắng */
  sentencePinyin?: string;
  sentenceVi?: string;
  /** chữ đang tra — hiện cạnh tiêu đề */
  hanzi: string;
  onSpeak: (text: string) => void;
  onClose: () => void;
}

export function PronunciationModal({ sentenceCn, sentencePinyin, sentenceVi, hanzi, onSpeak, onClose }: PronunciationModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const chars = alignPinyin(sentenceCn, sentencePinyin);

  // thu hồi object URL cũ khi có bản ghi mới / khi đóng popup
  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  // đóng popup khi đang ghi => tắt micro
  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Trình duyệt không hỗ trợ ghi âm");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Không truy cập được micro. Hãy cấp quyền cho trình duyệt.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <PracticeModal icon="isax-microphone-2" iconSrc="assets/hocba/pm-head-mic.svg" title="Luyện phát âm:" hanzi={hanzi} onClose={onClose}>
      <div className="pm-steps">
        <span>Nghe mẫu</span>
        <i className="isax isax-arrow-right-3" />
        <span>Ghi âm</span>
        <i className="isax isax-arrow-right-3" />
        <span>Nghe đánh giá kết quả</span>
      </div>

      <div className="pm-sentence">
        <button type="button" className="pm-speaker" onClick={() => onSpeak(sentenceCn)} title="Nghe câu mẫu">
          <AssetImage className="pm-icon-idle" src="assets/hocba/pm-speaker-red.svg" alt="" />
          <AssetImage className="pm-icon-hover" src="assets/hocba/pm-speaker-white.svg" alt="" />
        </button>

        <div>
          <div className="pm-ruby">
            {chars.map((c, i) => (
              <span className="pm-ruby__char" key={`${c.char}-${i}`}>
                <span className="pm-ruby__pinyin">{c.pinyin}</span>
                <span className="pm-ruby__hanzi">{c.char}</span>
              </span>
            ))}
          </div>
          {sentenceVi && <p className="pm-translation">{sentenceVi}</p>}
        </div>
      </div>

      <div className="pm-record">
        <button
          type="button"
          className={`pm-mic ${isRecording ? "is-recording" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
        >
          {isRecording ? (
            <AssetImage className="pm-mic__glyph" src="assets/hocba/pm-mic-white.svg" alt="" />
          ) : (
            <>
              <AssetImage className="pm-mic__glyph pm-icon-idle" src="assets/hocba/pm-mic-red.svg" alt="" />
              <AssetImage className="pm-mic__glyph pm-icon-hover" src="assets/hocba/pm-mic-white.svg" alt="" />
            </>
          )}
        </button>

        <p className="pm-hint">{isRecording ? "Đang ghi âm — nhấn để dừng" : "Nhấn để bắt đầu ghi âm"}</p>

        {recordedUrl && !isRecording && (
          <div className="pm-playback">
            <audio controls src={recordedUrl} />
          </div>
        )}
      </div>
    </PracticeModal>
  );
}
