import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

// jsdom không có matchMedia (antd dùng).
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom không cài scrollTo (ManagementShell gọi khi đổi route).
window.scrollTo = (() => {}) as typeof window.scrollTo;

// jsdom chưa hỗ trợ getComputedStyle(elt, pseudoElt): rc-util (antd Table/Modal) đo thanh cuộn bằng "::-webkit-scrollbar" => jsdom in lỗi
// "Not implemented" kèm stack rất dài ở mỗi lần render, làm test antd Table chậm gấp nhiều lần. Bỏ tham số pseudo (kết quả 0px như không có thanh cuộn).
const computedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((elt: Element) => computedStyle(elt)) as typeof window.getComputedStyle;
