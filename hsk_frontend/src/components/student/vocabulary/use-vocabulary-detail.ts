"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getPublishedVocabulary } from "@/lib/api/lms-dictionary-client";
import type { VocabularyDetail } from "@/types/dictionary";

/**
 * Trạng thái tải chi tiết một từ. Khác bản cũ (mọi lỗi => "Không tìm thấy từ vựng"): tách `not-found` (404 = không có / chưa xuất bản),
 * `waiting` (NEXT_PUBLIC_LMS_API_BASE_PATH trống — WAITING FOR BACKEND) và `error` (lỗi mạng/5xx, có "Thử lại") theo quy ước mục 5.
 */
export type VocabularyDetailState =
  | { kind: "loading" }
  | { kind: "ok"; data: VocabularyDetail }
  | { kind: "not-found" }
  | { kind: "waiting" }
  | { kind: "error"; message: string };

type Settled = { token: string } & Exclude<VocabularyDetailState, { kind: "loading" }>;

/** "Đang tải" được suy ra (chưa có kết quả cho id + lượt tải hiện tại) nên không setState đồng bộ trong effect. */
export function useVocabularyDetail(id: string): { state: VocabularyDetailState; reload: () => void } {
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const token = `${id}#${tick}`;

  useEffect(() => {
    let cancelled = false;
    getPublishedVocabulary(id).then(
      (data) => {
        if (!cancelled) setSettled({ token, kind: "ok", data });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiNotConfiguredError) setSettled({ token, kind: "waiting" });
        else if (error instanceof ApiError && error.status === 404) setSettled({ token, kind: "not-found" });
        else setSettled({ token, kind: "error", message: error instanceof ApiError ? error.message : "Không tải được từ vựng." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const state: VocabularyDetailState = settled !== null && settled.token === token ? settled : { kind: "loading" };
  return { state, reload };
}
