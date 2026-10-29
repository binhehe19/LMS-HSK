// "Từ đã xem" của trang Chi tiết từ vựng: cùng khoá localStorage `vocab_recent_viewed` và giới hạn 10 từ như HSK cũ, nhưng id là
// CHUỖI (ULID của repo-lms; bản cũ là số). Mục không đúng hình dạng (vd id số còn sót của bản cũ) bị bỏ qua khi đọc.
// Kho ngoài cho useSyncExternalStore: mọi truy cập storage bọc try/catch (chế độ riêng tư / bị chặn => coi như danh sách rỗng).

export const RECENT_VOCAB_KEY = "vocab_recent_viewed";
export const RECENT_VOCAB_MAX = 10;

export interface RecentWord {
  id: string;
  hanzi: string;
  pinyin: string;
}

function isRecentWord(value: unknown): value is RecentWord {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && v.id !== "" && typeof v.hanzi === "string" && typeof v.pinyin === "string";
}

export function parseRecentWords(raw: string | null): RecentWord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentWord).slice(0, RECENT_VOCAB_MAX) : [];
  } catch {
    return [];
  }
}

/** Đưa từ vừa xem lên đầu, bỏ bản trùng id, cắt còn tối đa 10. */
export function addRecentWord(list: RecentWord[], entry: RecentWord): RecentWord[] {
  return [entry, ...list.filter((w) => w.id !== entry.id)].slice(0, RECENT_VOCAB_MAX);
}

const EMPTY: RecentWord[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedList: RecentWord[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(RECENT_VOCAB_KEY);
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeRecentWords(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === RECENT_VOCAB_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Snapshot giữ nguyên tham chiếu khi chuỗi trong storage không đổi (yêu cầu của useSyncExternalStore). */
export function getRecentWordsSnapshot(): RecentWord[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parseRecentWords(raw);
  }
  return cachedList;
}

export function getRecentWordsServerSnapshot(): RecentWord[] {
  return EMPTY;
}

export function recordRecentWord(entry: RecentWord): void {
  const next = addRecentWord(getRecentWordsSnapshot(), entry);
  try {
    window.localStorage.setItem(RECENT_VOCAB_KEY, JSON.stringify(next));
  } catch {
    // Không ghi được (hết dung lượng / bị chặn): bỏ qua như một tiện ích, không báo lỗi.
  }
  notify();
}

export function clearRecentWords(): void {
  try {
    window.localStorage.removeItem(RECENT_VOCAB_KEY);
  } catch {
    // Như trên.
  }
  notify();
}
