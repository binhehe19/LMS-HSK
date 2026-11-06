"use client";

// Container màn Từ điển học viên (/vocabulary). URL là nguồn sự thật duy nhất cho bộ lọc/trang (đổi bằng router.replace như bản cũ dùng replace).
// Khác bản cũ có chủ đích: ô tra cứu chờ 400ms sau lần gõ cuối mới tìm (bản cũ gọi API mỗi phím, nặng với từ điển ~130 nghìn từ); Enter tìm ngay.
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import StudentShell from "@/components/student/dashboard/student-shell";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { searchPublishedVocabularies } from "@/lib/api/lms-dictionary-client";
import { readVocabularyListState, VOCABULARY_PAGE_SIZE, vocabularyListKey, vocabularyListQuery, type VocabularyListState } from "@/lib/dictionary/vocabulary-list-params";
import { VocabularyHomeView } from "./vocabulary-home-view";
import "./vocabulary-home.scss";

const SEARCH_DEBOUNCE_MS = 400;
/** Khung HSK 3.0: 9 cấp. */
const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function VocabularyHomePageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = readVocabularyListState(new URLSearchParams(params.toString()));
  const [draft, setDraft] = useState(state.keySearch);

  const navigate = (next: Partial<VocabularyListState>) => router.replace(`${pathname}${vocabularyListQuery({ ...state, ...next })}`, { scroll: false });

  // Gõ xong 400ms thì ghi từ khoá vào URL (về trang đầu). Chỉ gọi router trong hẹn giờ, không setState trong effect.
  const committed = state.keySearch;
  useEffect(() => {
    if (draft === committed) return;
    const timer = setTimeout(() => router.replace(`${pathname}${vocabularyListQuery({ ...readVocabularyListState(new URLSearchParams(window.location.search)), keySearch: draft, page: 0 })}`, { scroll: false }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, committed, pathname, router]);

  const list = useKeyedFetch(vocabularyListKey(state), () =>
    searchPublishedVocabularies({ keySearch: state.keySearch, hskLevel: state.hskLevel, radical: state.radical, page: state.page, size: VOCABULARY_PAGE_SIZE }),
  );

  return (
    <StudentShell fullWidth>
      <VocabularyHomeView
        keywordDraft={draft}
        onKeywordDraftChange={setDraft}
        onSubmitSearch={() => navigate({ keySearch: draft, page: 0 })}
        hskLevel={state.hskLevel}
        levels={HSK_LEVELS}
        onHskChange={(hskLevel) => navigate({ hskLevel, page: 0 })}
        radicalFilter={{ radical: state.radical, strokeFilter: state.strokeFilter }}
        onRadicalFilterChange={(next) => navigate({ radical: next.radical, strokeFilter: next.strokeFilter, page: next.radical === state.radical ? state.page : 0 })}
        state={list.state}
        onPageChange={(page) => {
          navigate({ page });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onRetry={list.reload}
      />
    </StudentShell>
  );
}
