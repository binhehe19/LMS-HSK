"use client";

// Đọc to cho trang Chi tiết từ vựng (core/hooks/use-text-to-speech.ts của HSK cũ): ưu tiên Web Speech, tự nhận ngôn ngữ zh-CN / vi-VN / en-US;
// máy không có giọng đọc khớp ngôn ngữ (hay gặp tiếng Trung trên Android — speak() im lặng, không bắn onerror) => đọc qua VoiceRSS.
// Khác bản cũ:
// - Khoá VoiceRSS lấy từ NEXT_PUBLIC_TTS_VOICERSS_KEY (bản cũ ghi cứng trong mã). Trống => không có nhánh VoiceRSS, vẫn gọi Web Speech như
//   nhánh dự phòng cuối của bản cũ.
// - `audioUrl`: từ có tệp phát âm thật thì phát tệp đó; tệp lỗi => quay về đọc bằng TTS.
// - Không giữ isSpeaking/currentUtteranceId (trang này không dùng).
import { useCallback, useEffect, useRef } from "react";

type DetectedLang = "zh-cn" | "vi" | "en";

function detectLanguage(text: string): DetectedLang {
  if (/[一-鿿]/.test(text)) return "zh-cn";
  if (/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text)) return "vi";
  return "en";
}

function toSpeechLang(detected: DetectedLang): string {
  if (detected === "zh-cn") return "zh-CN";
  if (detected === "vi") return "vi-VN";
  return "en-US";
}

function toVoiceRssLang(detected: DetectedLang): string {
  if (detected === "zh-cn") return "zh-cn";
  if (detected === "vi") return "vi-vn";
  return "en-us";
}

function getSynth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

function pickVoice(synth: SpeechSynthesis, detected: DetectedLang): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (!voices.length) return null;
  const lang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase();
  const name = (v: SpeechSynthesisVoice) => v.name.toLowerCase();
  if (detected === "zh-cn") {
    return voices.find((v) => lang(v).startsWith("zh") || lang(v).includes("cmn") || name(v).includes("chinese") || name(v).includes("mandarin")) ?? null;
  }
  if (detected === "vi") return voices.find((v) => lang(v).startsWith("vi") || name(v).includes("vietnamese")) ?? null;
  return (
    voices.find((v) => lang(v).startsWith("en") && (name(v).includes("female") || name(v).includes("zira") || name(v).includes("susan"))) ??
    voices.find((v) => lang(v).startsWith("en")) ??
    null
  );
}

export interface SpeakOptions {
  rate?: number;
  /** Tệp phát âm thật của từ (Vocabulary.audioUrl). */
  audioUrl?: string;
}

export function useTextToSpeech(): { speak: (text: string, options?: SpeakOptions) => void; stop: () => void } {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audioRef.current = null;
    }
    getSynth()?.cancel();
  }, []);

  useEffect(() => stop, [stop]);

  /** Phát một URL âm thanh; lỗi (tải hỏng / bị chặn tự phát) => onFail MỘT lần. */
  const playUrl = useCallback((url: string, rate: number, onFail: () => void) => {
    const audio = new Audio(url);
    audio.playbackRate = rate;
    audioRef.current = audio;
    let failed = false;
    const fail = () => {
      if (failed) return;
      failed = true;
      if (audioRef.current === audio) audioRef.current = null;
      onFail();
    };
    audio.onended = () => {
      if (audioRef.current === audio) audioRef.current = null;
    };
    audio.onerror = fail;
    audio.play().catch(fail);
  }, []);

  const speak = useCallback(
    (text: string, options?: SpeakOptions) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      stop();

      const rate = options?.rate ?? 1;
      const detected = detectLanguage(trimmed);
      const synth = getSynth();

      // Nhánh cuối, không gọi lại VoiceRSS để tránh vòng lặp khi cả hai đều không đọc được (im lặng còn hơn lặp).
      const speakPlain = () => {
        if (!synth) return;
        const utterance = new SpeechSynthesisUtterance(trimmed);
        utterance.lang = toSpeechLang(detected);
        utterance.rate = rate;
        synth.speak(utterance);
      };

      const speakWithVoiceRss = () => {
        const key = process.env.NEXT_PUBLIC_TTS_VOICERSS_KEY?.trim();
        if (!key) {
          speakPlain();
          return;
        }
        const url = `https://api.voicerss.org/?key=${encodeURIComponent(key)}&hl=${toVoiceRssLang(detected)}&src=${encodeURIComponent(trimmed)}&c=MP3&f=44khz_16bit_stereo`;
        playUrl(url, rate, speakPlain);
      };

      const speakWithBrowser = () => {
        if (!synth) {
          speakWithVoiceRss();
          return;
        }
        const voice = pickVoice(synth, detected);
        if (!voice && detected !== "en") {
          speakWithVoiceRss();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(trimmed);
        utterance.lang = toSpeechLang(detected);
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;
        if (voice) utterance.voice = voice;
        synth.speak(utterance);
      };

      if (options?.audioUrl) playUrl(options.audioUrl, rate, speakWithBrowser);
      else speakWithBrowser();
    },
    [stop, playUrl],
  );

  return { speak, stop };
}
