// Phần dùng chung của các khung vẽ chữ Hán bằng Hanzi Writer ở màn quản lý từ điển.
// Thư viện đụng `window` nên chỉ nạp ở trình duyệt khi cần (import() động), và nạp một lần cho mọi chữ; nạp lỗi thì lần sau thử lại.

const MAX_CHARS = 12;
const HAN = /\p{Script=Han}/u;

/** Các chữ Hán khác nhau của từ theo thứ tự xuất hiện (bỏ chữ số, chữ Latin, dấu), tối đa MAX_CHARS. */
export function hanziCharsOf(word: string | undefined): string[] {
  return [...new Set(Array.from(word ?? "").filter((c) => HAN.test(c)))].slice(0, MAX_CHARS);
}

let writerModule: Promise<typeof import("hanzi-writer")> | null = null;
export function loadHanziWriter(): Promise<typeof import("hanzi-writer")> {
  writerModule ??= import("hanzi-writer").catch((error: unknown) => {
    writerModule = null;
    throw error;
  });
  return writerModule;
}
