// Nạp dữ liệu nét chữ cho hanzi-writer (nguyên logic core/utils/hanzi-writer-loader.ts của HSK cũ): gọi song song mọi nguồn, lấy nguồn
// trả về TRƯỚC, mỗi nguồn tối đa 2 giây; nhớ đệm chữ đã có, nhớ chữ mà MỌI nguồn đều 404, gộp các lời gọi trùng đang chạy.
// Khác bản cũ: danh sách nguồn đọc từ NEXT_PUBLIC_HANZI_WRITER_DATA_URLS (mẫu URL chứa "{char}", phân cách dấu phẩy) để tự host được;
// trống => hai nguồn jsdelivr của bản cũ. Chỉ import KIỂU từ hanzi-writer nên file này không kéo thư viện (đụng `window`) vào SSR.
import type { CharacterJson, CharDataLoaderFn } from "hanzi-writer";

const CHANIND = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1";
const YOUYIN_SHA = "59aa4a02a46c608c939ba790372bbd3a703a6899";
const YOUYIN = `https://cdn.jsdelivr.net/gh/MadLadSquad/hanzi-writer-data-youyin@${YOUYIN_SHA}/data`;
const FETCH_TIMEOUT_MS = 2000;

export const DEFAULT_HANZI_DATA_URL_TEMPLATES = [`${CHANIND}/{char}.json`, `${YOUYIN}/{char}.json`];

/** Mẫu không chứa "{char}" bị bỏ (cấu hình sai sẽ luôn trả cùng một chữ). Không còn mẫu hợp lệ => mặc định. */
export function parseHanziDataUrlTemplates(raw: string | undefined): string[] {
  const templates = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("{char}"));
  return templates.length > 0 ? templates : DEFAULT_HANZI_DATA_URL_TEMPLATES;
}

const cache = new Map<string, CharacterJson>();
const missing = new Set<string>();
const inflight = new Map<string, Promise<CharacterJson | null>>();

type FetchResult = { status: "found"; data: CharacterJson } | { status: "missing" } | { status: "error" };

async function tryFetch(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (r.ok) return { status: "found", data: (await r.json()) as CharacterJson };
    return r.status === 404 ? { status: "missing" } : { status: "error" };
  } catch {
    return { status: "error" };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFirstAvailable(char: string): Promise<CharacterJson | null> {
  const encodedChar = encodeURIComponent(char);
  const templates = parseHanziDataUrlTemplates(process.env.NEXT_PUBLIC_HANZI_WRITER_DATA_URLS);
  const pending = templates.map((template) => tryFetch(template.split("{char}").join(encodedChar)));
  const results: FetchResult[] = [];

  while (pending.length > 0) {
    const { index, result } = await Promise.race(pending.map((promise, i) => promise.then((r) => ({ index: i, result: r }))));
    pending.splice(index, 1);
    results.push(result);
    if (result.status === "found") return result.data;
  }

  if (results.every((result) => result.status === "missing")) missing.add(char);
  return null;
}

export function loadHanziChar(char: string): Promise<CharacterJson | null> {
  const hit = cache.get(char);
  if (hit) return Promise.resolve(hit);
  if (missing.has(char)) return Promise.resolve(null);
  const pending = inflight.get(char);
  if (pending) return pending;

  const p = (async () => {
    const data = await fetchFirstAvailable(char);
    if (data) cache.set(char, data);
    inflight.delete(char);
    return data;
  })();
  inflight.set(char, p);
  return p;
}

export const charDataLoader: CharDataLoaderFn = (char, onLoad, onError) => {
  loadHanziChar(char).then(
    (d) => (d ? onLoad(d) : onError(new Error(`No stroke data for ${char}`))),
    (e: unknown) => onError(e),
  );
};
