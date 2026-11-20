"use client";

// Trang Chi tiết từ vựng của học viên (/vocabulary/:id) — chuyển từ features/learning-path/vocabulary/detail/vocabulary-detail.tsx của HSK cũ.
// Khác bản cũ (có chủ đích):
// - Dữ liệu: getPublishedVocabulary (repo-lms, chỉ từ ĐÃ XUẤT BẢN, id ULID chuỗi); chữ thành phần lấy từ `components` của API (chữ có id là
//   liên kết tới trang của chữ đó), không có thì rơi về ô bộ thủ tra theo KÝ TỰ bộ thủ ("NHẤT 一" => "一").
// - Trạng thái: 404 => "Không tìm thấy từ vựng"; thiếu cấu hình API => WAITING FOR BACKEND; lỗi khác => thông báo + "Thử lại" (bản cũ gộp hết
//   thành "Không tìm thấy").
// - Ảnh Wikimedia chỉ hiển thị, mặc định tắt (NEXT_PUBLIC_DICTIONARY_WIKIMEDIA_FALLBACK); không upload, không sync-etymology.
// - Có audioUrl => nút loa của từ phát tệp đó thay cho TTS.
// - Không ghi page-view / trackEvent (analytics của bản cũ chưa có ở frontend mới). Nút lưu từ chỉ là trạng thái tại chỗ + toast như bản cũ.
// - Có <Toaster> riêng vì khu học viên chưa gắn Toaster dùng chung (bản cũ gắn ở src/index.tsx).
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import {
  clearRecentWords,
  getRecentWordsServerSnapshot,
  getRecentWordsSnapshot,
  recordRecentWord,
  subscribeRecentWords,
} from "@/lib/dictionary/recent-vocabulary";
import { useTextToSpeech } from "@/lib/dictionary/use-text-to-speech";
import { buildAnalysisNodes, selectExamples, selectPrimaryPinyin, splitWordTypes } from "@/lib/dictionary/vocabulary-detail-model";
import type { VocabularyDetail } from "@/types/dictionary";
import { ConversationModal } from "./conversation-modal";
import { PronunciationModal } from "./pronunciation-modal";
import { StrokeOrderModal } from "./stroke-order-modal";
import { useVocabularyDetail } from "./use-vocabulary-detail";
import { useWikimediaSealImage } from "./use-wikimedia-seal-image";
import { VocabPracticeModal } from "./vocab-practice-modal";
import { VOCABULARY_HOME_PATH, VocabularyDetailView, vocabularyDetailPath, type VocabularyPracticeKind } from "./vocabulary-detail-view";
import "./vocabulary-detail.scss";

function deriveWord(detail: VocabularyDetail) {
  const primary = selectPrimaryPinyin(detail.pinyins);
  const meanings = primary?.meanings ?? [];
  const wordTypes = splitWordTypes(primary);
  return {
    primary,
    displayPinyin: primary?.pinyin ?? "",
    sinoVietnamese: primary?.sinoVietnamese ?? "",
    wordTypes,
    wordType: wordTypes[0] ?? "",
    primaryMeaning: meanings[0]?.meaning || meanings[0]?.meaningEn || meanings[0]?.meaningZh || "",
    examples: selectExamples(meanings),
    analysisNodes: buildAnalysisNodes(detail.hanzi, detail.components, detail.radical),
  };
}

function StateBox({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <div className="content hsk-vocab-detail">
      <div className="vd-page">
        <div className="vd-state" data-testid={testId}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function VocabularyDetailPageContent({ id }: { id: string }) {
  const router = useRouter();
  const { state, reload } = useVocabularyDetail(id);
  const { speak, stop } = useTextToSpeech();
  const recent = useSyncExternalStore(subscribeRecentWords, getRecentWordsSnapshot, getRecentWordsServerSnapshot);
  const [isSaved, setIsSaved] = useState(false);
  const [practice, setPractice] = useState<VocabularyPracticeKind | null>(null);

  const detail = state.kind === "ok" ? state.data : null;
  const word = detail ? deriveWord(detail) : null;
  const displayPinyin = word?.displayPinyin ?? "";

  const wikiImage = useWikimediaSealImage(detail && !detail.imageUrl ? detail.hanzi : "");

  // Lưu "Từ đã xem" (kho ngoài localStorage, không phải state của component).
  useEffect(() => {
    if (detail) recordRecentWord({ id: detail.id, hanzi: detail.hanzi, pinyin: displayPinyin });
  }, [detail, displayPinyin]);

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(VOCABULARY_HOME_PATH);
  };

  if (state.kind === "loading") {
    return (
      <StateBox testId="vocabulary-detail-loading">
        <div className="spinner-border text-primary" role="status" aria-label="Đang tải" />
      </StateBox>
    );
  }

  if (state.kind === "waiting") {
    return (
      <StateBox testId="vocabulary-detail-waiting">
        <i className="isax isax-warning-2" />
        <h4>Từ điển chưa kết nối API (WAITING FOR BACKEND)</h4>
        <p className="vd-empty">Dịch vụ từ điển chưa được cấu hình nên chưa xem được chi tiết từ vựng.</p>
      </StateBox>
    );
  }

  if (state.kind === "error") {
    return (
      <StateBox testId="vocabulary-detail-error">
        <i className="isax isax-warning-2" />
        <h4>Không tải được từ vựng</h4>
        <p className="vd-empty">{state.message}</p>
        <div className="d-flex gap-2">
          <button type="button" className="vd-btn-primary" onClick={reload}>
            Thử lại
          </button>
          <button type="button" className="vd-btn-outline" onClick={goBack}>
            Quay lại
          </button>
        </div>
      </StateBox>
    );
  }

  if (!detail || !word) {
    return (
      <StateBox testId="vocabulary-detail-not-found">
        <i className="isax isax-warning-2" />
        <h4>Không tìm thấy từ vựng</h4>
        <button type="button" className="vd-btn-primary" onClick={goBack}>
          Quay lại
        </button>
      </StateBox>
    );
  }

  /** Nút loa của chính từ này phát tệp phát âm thật nếu có; câu ví dụ / đoạn hội thoại luôn đọc bằng TTS. */
  const handleSpeak = (text: string, rate?: number) => {
    if (!text) return;
    const primary = detail.pinyins?.find(pinyin => pinyin.isPrimary) ?? detail.pinyins?.[0];
    speak(text, { rate, audioUrl: text === detail.hanzi ? primary?.audioUrl : undefined });
  };

  const closePractice = () => {
    stop();
    setPractice(null);
  };

  const toggleSave = () => {
    setIsSaved((v) => !v);
    toast.success(isSaved ? "Đã bỏ lưu từ vựng" : "Đã lưu từ vựng");
  };

  const firstExample = word.examples[0];

  return (
    <div className="content hsk-vocab-detail">
      <Toaster richColors position="top-center" />
      <VocabularyDetailView
        detail={detail}
        displayPinyin={word.displayPinyin}
        sinoVietnamese={word.sinoVietnamese}
        wordTypes={word.wordTypes}
        primaryMeaning={word.primaryMeaning}
        examples={word.examples}
        analysisNodes={word.analysisNodes}
        illustration={detail.imageUrl || wikiImage}
        recent={recent}
        isSaved={isSaved}
        onToggleSave={toggleSave}
        onSpeak={handleSpeak}
        onOpenPractice={setPractice}
        onOpenRecent={(recentId) => router.push(vocabularyDetailPath(recentId))}
        onClearRecent={clearRecentWords}
      />

      {practice === "pronunciation" && (
        <PronunciationModal
          hanzi={detail.hanzi}
          sentenceCn={firstExample?.zh || detail.hanzi}
          sentencePinyin={firstExample?.pinyin || word.displayPinyin}
          sentenceVi={firstExample?.vi}
          onSpeak={handleSpeak}
          onClose={closePractice}
        />
      )}

      {practice === "stroke" && (
        <StrokeOrderModal
          hanzi={detail.hanzi}
          hskLevel={detail.hskLevel}
          pinyin={word.displayPinyin}
          meaning={word.primaryMeaning}
          wordType={word.wordType}
          analysisNodes={word.analysisNodes}
          onSpeak={handleSpeak}
          onClose={closePractice}
        />
      )}

      {practice === "conversation" && (
        <ConversationModal
          hanzi={detail.hanzi}
          hskLevel={detail.hskLevel}
          pinyin={word.displayPinyin}
          meaning={word.primaryMeaning}
          wordType={word.wordType}
          examples={word.examples}
          onSpeak={handleSpeak}
          onStop={stop}
          onClose={closePractice}
        />
      )}

      {practice === "practice" && <VocabPracticeModal hanzi={detail.hanzi} compounds={word.primary?.compounds} examples={word.examples} onClose={() => setPractice(null)} />}
    </div>
  );
}
