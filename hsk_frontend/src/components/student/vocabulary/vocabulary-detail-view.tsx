"use client";

// Giao diện trang Chi tiết từ vựng khi đã có dữ liệu (DOM + lớp CSS giữ như vocabulary-detail.tsx của HSK cũ). Không gọi API, không đụng storage:
// mọi dữ liệu đã dựng sẵn và thao tác đi qua props (container: vocabulary-detail-page-content.tsx).
import NextLink from "next/link";
import { useState } from "react";
import { AssetImage } from "@/components/shared/asset-image";
import type { RecentWord } from "@/lib/dictionary/recent-vocabulary";
import type { AnalysisNode } from "@/lib/dictionary/vocabulary-detail-model";
import { getWordTypeBadgeStyle } from "@/lib/dictionary/word-type-style";
import type { VocabularyDetail, VocabularyExample } from "@/types/dictionary";
import { VocabularyHighlight } from "./vocabulary-highlight";

export type VocabularyPracticeKind = "pronunciation" | "conversation" | "stroke" | "practice";

export interface VocabularyDetailViewProps {
  detail: VocabularyDetail;
  displayPinyin: string;
  sinoVietnamese: string;
  wordTypes: string[];
  primaryMeaning: string;
  examples: VocabularyExample[];
  analysisNodes: AnalysisNode[];
  illustration: string | null;
  recent: RecentWord[];
  isSaved: boolean;
  onToggleSave: () => void;
  onSpeak: (text: string) => void;
  onOpenPractice: (kind: VocabularyPracticeKind) => void;
  onOpenRecent: (id: string) => void;
  onClearRecent: () => void;
}

export const DASHBOARD_PATH = "/student/student-dashboard";
export const VOCABULARY_HOME_PATH = "/vocabulary";

export function vocabularyDetailPath(id: string): string {
  return `${VOCABULARY_HOME_PATH}/${encodeURIComponent(id)}`;
}

function WordTypeTags({ types }: { types: string[] }) {
  return (
    <>
      {types.map((type, idx) => {
        const s = getWordTypeBadgeStyle(type);
        return (
          <span key={idx} className="vd-tag-type" style={{ backgroundColor: s.bg, color: s.color, border: s.border }}>
            {type}
          </span>
        );
      })}
    </>
  );
}

export function VocabularyDetailView({
  detail,
  displayPinyin,
  sinoVietnamese,
  wordTypes,
  primaryMeaning,
  examples,
  analysisNodes,
  illustration,
  recent,
  isSaved,
  onToggleSave,
  onSpeak,
  onOpenPractice,
  onOpenRecent,
  onClearRecent,
}: VocabularyDetailViewProps) {
  const [showAllExamples, setShowAllExamples] = useState(false);
  const visibleExamples = showAllExamples ? examples : examples.slice(0, 2);

  return (
    <div className="vd-page">
      {/* ── Breadcrumb ── */}
      <nav className="vd-breadcrumb" aria-label="Breadcrumb">
        <NextLink href={DASHBOARD_PATH} className="vd-crumb">
          <i className="isax isax-home-2" />
          <span>Trang chủ</span>
        </NextLink>
        <span className="vd-sep">/</span>
        <NextLink href={VOCABULARY_HOME_PATH} className="vd-crumb">
          Từ vựng
        </NextLink>
        <span className="vd-sep">/</span>
        <span className="vd-crumb">HSK 3.0</span>
        {detail.hskLevel && (
          <>
            <span className="vd-sep">/</span>
            <span className="vd-crumb">HSK{detail.hskLevel}</span>
          </>
        )}
        <span className="vd-sep">/</span>
        <span className="vd-crumb-active">Chi tiết từ vựng {detail.hanzi}</span>
      </nav>

      {/* ── Hero ── */}
      <section className="vd-hero">
        <div className="vd-hero__left">
          <h1 className="vd-hanzi">{detail.hanzi}</h1>

          <div className="vd-pinyin-row">
            <span className="vd-pinyin">{displayPinyin}</span>
            <button type="button" className="vd-speaker" onClick={() => onSpeak(detail.hanzi)} title="Nghe phát âm" aria-label="Nghe phát âm">
              <i className="isax isax-volume-high" />
            </button>
          </div>

          {primaryMeaning && <p className="vd-meaning">{primaryMeaning}</p>}
          {sinoVietnamese && <p className="vd-sino">Hán việt: {sinoVietnamese}</p>}
        </div>

        <div className="vd-hero__right">
          <div className="vd-tags">
            {detail.hskLevel && <span className="vd-tag-hsk">HSK{detail.hskLevel}</span>}
            <WordTypeTags types={wordTypes} />
          </div>

          <div className="vd-actions">
            <button type="button" className="vd-btn-primary" onClick={() => onOpenPractice("pronunciation")}>
              <i className="isax isax-microphone-2" />
              <span>Phát âm</span>
            </button>

            <button type="button" className="vd-btn-outline" onClick={() => onOpenPractice("conversation")}>
              <i className="isax isax-message-text" />
              <span>Hội thoại</span>
              <span className="vd-pro">
                Pro <i className="isax isax-star1" />
              </span>
            </button>

            <button
              type="button"
              className={`vd-btn-icon ${isSaved ? "is-saved" : ""}`}
              onClick={onToggleSave}
              title={isSaved ? "Bỏ lưu từ vựng" : "Lưu từ vựng"}
              aria-label={isSaved ? "Bỏ lưu từ vựng" : "Lưu từ vựng"}
              aria-pressed={isSaved}
            >
              {/* bookmark: viền khi chưa lưu, tô đầy đỏ khi đã lưu */}
              <svg
                className="vd-bookmark"
                viewBox="0 0 24 24"
                fill={isSaved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.2L6 21V4.5Z" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ── Phân tích thành phần ── */}
      <section className="vd-analysis">
        <h2 className="vd-analysis__title">
          <i className="isax isax-hierarchy-square-2" />
          <span>Phân tích thành phần</span>
        </h2>

        <div className="vd-analysis__body">
          <div className="vd-node vd-node--main">
            <span className="vd-node__hanzi">{detail.hanzi}</span>
            <span className="vd-node__pinyin">{displayPinyin}</span>
            {primaryMeaning && <span className="vd-node__gloss">{primaryMeaning}</span>}
          </div>

          {analysisNodes.length > 0 && (
            <>
              <span className="vd-connector" />
              <div className="vd-node-group" data-testid="vocabulary-analysis-nodes">
                {analysisNodes.map((node) => {
                  const body = (
                    <>
                      <span className="vd-node__hanzi vd-node__hanzi--sm">{node.hanzi}</span>
                      <div className="vd-node__text">
                        <span className="vd-node__title">{node.title}</span>
                        <span className="vd-node__desc">{node.desc}</span>
                      </div>
                    </>
                  );
                  return node.id ? (
                    <NextLink key={node.key} href={vocabularyDetailPath(node.id)} className="vd-node vd-node--sub">
                      {body}
                    </NextLink>
                  ) : (
                    <div key={node.key} className="vd-node vd-node--sub">
                      {body}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Grid: ảnh minh hoạ | nội dung ── */}
      <div className="vd-grid">
        <aside className="vd-illustration">
          <div className="vd-illustration__head">Hình ảnh minh họa</div>
          <div className="vd-illustration__body">
            {illustration ? (
              <AssetImage src={illustration} alt={detail.hanzi} />
            ) : (
              <div className="vd-illustration__empty">
                <i className="isax isax-gallery" />
                <span>Chưa có hình ảnh</span>
              </div>
            )}
          </div>
        </aside>

        <div className="vd-main">
          <div className="vd-tabs">
            <button type="button" className="vd-tab is-active">
              <i className="isax isax-info-circle" />
              <span>Chi tiết từ vựng</span>
            </button>
            <button type="button" className="vd-tab" onClick={() => onOpenPractice("stroke")}>
              <i className="isax isax-edit-2" />
              <span>Luyện viết</span>
            </button>
            <button type="button" className="vd-tab" onClick={() => onOpenPractice("practice")}>
              <i className="isax isax-teacher" />
              <span>Luyện tập</span>
            </button>
          </div>

          <section className="vd-panel">
            {wordTypes.length > 0 && (
              <div className="vd-panel__types">
                <WordTypeTags types={wordTypes} />
              </div>
            )}

            <div className="vd-panel__hanzi">{detail.hanzi}</div>

            {primaryMeaning && (
              <div className="vd-def">
                <span className="vd-def__label">Nghĩa chính:</span>
                <p className="vd-def__text">{primaryMeaning}</p>
              </div>
            )}

            <div className="vd-examples">
              <div className="vd-examples__head">
                <span className="vd-examples__title">
                  <i className="isax isax-message-2" />
                  Ví dụ ({examples.length})
                </span>
                {examples.length > 2 && (
                  <button type="button" className="vd-link" onClick={() => setShowAllExamples((v) => !v)}>
                    {showAllExamples ? "Thu gọn" : "Xem tất cả"}
                    <i className={`isax ${showAllExamples ? "isax-arrow-up-2" : "isax-arrow-right-3"}`} />
                  </button>
                )}
              </div>

              {visibleExamples.length === 0 && <p className="vd-empty">Chưa có ví dụ cho từ này.</p>}

              {visibleExamples.map((ex, i) => (
                <article className="vd-example" key={`example-${i}`}>
                  <button
                    type="button"
                    className="vd-speaker vd-speaker--sm"
                    onClick={() => onSpeak(ex.zh ?? "")}
                    title="Nghe câu ví dụ"
                    aria-label="Nghe câu ví dụ"
                  >
                    <i className="isax isax-volume-high" />
                  </button>

                  <div className="vd-example__body">
                    {ex.pinyin && (
                      <p className="vd-example__pinyin">
                        <VocabularyHighlight text={ex.pinyin} needle={displayPinyin} className="hl" />
                      </p>
                    )}
                    <p className="vd-example__cn">
                      <VocabularyHighlight text={ex.zh ?? ""} needle={detail.hanzi} className="hl" />
                    </p>
                    {ex.vi && <p className="vd-example__vi">{ex.vi}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── Từ đã xem ── */}
          <section className="vd-recent">
            <div className="vd-recent__head">
              <span className="vd-recent__title">
                <i className="isax isax-clock" />
                Từ đã xem
                <span className="vd-recent__count">{recent.length} từ</span>
              </span>
              {recent.length > 0 && (
                <button type="button" className="vd-link" onClick={onClearRecent}>
                  Xóa tất cả
                </button>
              )}
            </div>

            <div className="vd-recent__list">
              {recent.length === 0 && <p className="vd-empty">Chưa có từ nào.</p>}
              {recent.map((w) => (
                <button type="button" className="vd-recent__card" key={w.id} onClick={() => onOpenRecent(w.id)}>
                  <span className="vd-recent__hanzi">{w.hanzi}</span>
                  <span className="vd-recent__pinyin">{w.pinyin}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
