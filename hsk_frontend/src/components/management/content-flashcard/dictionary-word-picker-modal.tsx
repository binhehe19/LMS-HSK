"use client";

// Hộp chọn TỪ trong Từ điển (`/vocabulary/manage`) để thêm vào bộ từ vựng thay cho nhập tay từng thẻ: tìm theo chữ Hán, pinyin hoặc nghĩa, tick nhiều từ,
// mỗi từ thành một bản sao riêng của bộ (xem addDictionaryWordsToPackage). Từ chưa có trong từ điển thì thêm ở màn Từ điển rồi quay lại chọn.
import { Modal } from "antd";
import { useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { addDictionaryWordsToPackage } from "@/lib/api/lms-content-client";
import { searchVocabularies } from "@/lib/api/lms-dictionary-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import type { ItemPickerProps } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";
import type { Vocabulary, VocabularyPage } from "@/types/dictionary";

const PAGE_SIZE = 10;

function summaryOf(word: Vocabulary): { pinyin: string; meaning: string } {
  const pinyins = word.pinyins ?? [];
  const primary = pinyins.find((p) => p.isPrimary) ?? pinyins[0];
  return { pinyin: primary?.pinyin ?? "", meaning: primary?.meanings?.[0]?.meaning ?? "" };
}

export function DictionaryWordPickerModal({ open, pkg, items, demo, hasLock, onClose, onAdded, sessionNo = 1 }: ItemPickerProps<FlashcardCard>) {
  const [keyword, setKeyword] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Map<string, string>>(new Map()); // id từ điển => chữ Hán
  const [busy, setBusy] = useState(false);

  const results = useKeyedFetch<VocabularyPage>(open ? `dict-picker:${applied}:${page}` : null, () => searchVocabularies({ keySearch: applied, page, size: PAGE_SIZE }));
  const inSet = new Set(items.map((i) => i.term));
  const data = results.state.kind === "ok" ? results.state.data : null;

  const search = () => {
    setApplied(keyword.trim());
    setPage(0);
  };
  const toggle = (word: Vocabulary) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(word.id)) next.delete(word.id);
      else next.set(word.id, word.hanzi);
      return next;
    });
  const close = () => {
    if (busy) return;
    setSelected(new Map());
    onClose();
  };

  const submit = async () => {
    if (!pkg || selected.size === 0 || busy || hasLock?.() === false) return;
    setBusy(true);
    try {
      const result = await addDictionaryWordsToPackage(pkg.id, Array.from(selected, ([id, label]) => ({ id, label })), demo, sessionNo);
      if (result.added > 0) toast.success(`Đã thêm ${result.added} từ vào bộ`);
      result.failed.forEach((f) => toast.error(`Không thêm được "${f.label}": ${f.message}`));
      if (result.added > 0) onAdded();
      if (result.failed.length === 0) {
        setSelected(new Map());
        onClose();
      } else {
        // Giữ lại các từ lỗi để thử lại; bỏ các từ đã thêm được.
        const failedLabels = new Set(result.failed.map((f) => f.label));
        setSelected((prev) => new Map([...prev].filter(([, label]) => failedLabels.has(label))));
      }
    } catch (error) {
      toast.error(writeErrorMessage(error, "Không thể thêm từ vào bộ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      centered
      width={760}
      title={`Thêm từ từ Từ điển — ${pkg?.name ?? ""}`}
      onCancel={close}
      onOk={() => void submit()}
      okText={`Thêm${selected.size > 0 ? ` ${selected.size} từ` : ""} vào bộ`}
      cancelText="Đóng"
      okButtonProps={{ disabled: selected.size === 0 || busy || !pkg, loading: busy }}
      cancelButtonProps={{ disabled: busy }}
    >
      <div className="d-flex gap-2 mb-3">
        <input className="form-control" placeholder="Tìm theo chữ Hán, pinyin hoặc nghĩa tiếng Việt..." value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} disabled={busy} aria-label="Tìm từ trong từ điển" />
        <button type="button" className="btn btn-outline-primary" onClick={search} disabled={busy}>
          Tìm
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={results.reload} disabled={busy || results.state.kind === "loading"} title="Tải lại kết quả (vd sau khi thêm từ ở màn Từ điển)">
          <i className="isax isax-refresh me-1" />
          Tải lại
        </button>
      </div>

      {results.state.kind === "loading" && (
        <div className="text-muted small py-2">
          <span className="spinner-border spinner-border-sm me-2" />
          Đang tìm...
        </div>
      )}
      <FetchStateNotice state={results.state} waitingText="Từ điển chưa được kết nối API (WAITING FOR BACKEND)." onRetry={results.reload} testId="dict-picker-notice" />
      {data && data.items.length === 0 && <div className="text-muted small py-2">Không có từ nào khớp.</div>}
      {data && data.items.length > 0 && (
        <div className="list-group" data-testid="dict-picker-list" style={{ maxHeight: 340, overflowY: "auto" }}>
          {data.items.map((word) => {
            const already = inSet.has(word.hanzi);
            const { pinyin, meaning } = summaryOf(word);
            return (
              <button
                key={word.id}
                type="button"
                className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2${selected.has(word.id) ? " active" : ""}`}
                aria-pressed={selected.has(word.id)}
                onClick={() => toggle(word)}
                disabled={busy || already}
                data-testid="dict-picker-row"
              >
                <span>
                  <span className="fw-bold fs-5 me-2">{word.hanzi}</span>
                  <span className={selected.has(word.id) ? "" : "text-muted"}>{pinyin}</span>
                  {meaning && <span className={`d-block small${selected.has(word.id) ? "" : " text-muted"}`}>{meaning}</span>}
                </span>
                {already && <span className="badge bg-secondary flex-shrink-0">Đã có trong bộ</span>}
              </button>
            );
          })}
        </div>
      )}
      {data && (
        <div className="d-flex justify-content-between align-items-center mt-2 small" data-testid="dict-picker-pager">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={busy || page === 0}>
            Trước
          </button>
          <span className="text-muted">
            Trang {page + 1}/{Math.max(1, data.totalPages)} ({data.totalElements} từ)
          </span>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPage((p) => p + 1)} disabled={busy || page + 1 >= Math.max(1, data.totalPages)}>
            Sau
          </button>
        </div>
      )}
      <p className="text-muted small mt-3 mb-0">
        Chưa có từ cần dùng?{" "}
        <a href="/vocabulary/manage" target="_blank" rel="noreferrer noopener">
          Thêm vào Từ điển
        </a>{" "}
        rồi quay lại tìm. Từ thêm vào bộ là bản sao nên có thể chỉnh nghĩa riêng mà không đổi Từ điển.
      </p>
    </Modal>
  );
}
