"use client";

import { useSyncExternalStore } from "react";
import { buildAuthFrontendUrl } from "@/lib/auth/auth-redirect";

const noopSubscribe = () => () => {};

/**
 * URL một trang của Authentication_Frontend (không kèm redirect), dùng khi render. Phía server và lúc hydrate trả `fallback`, sau đó là URL thật:
 * với cấu hình đường dẫn cùng origin (gateway) URL chỉ tính được khi đã có window, nên HTML server và lần render đầu của client phải giống nhau
 * để tránh lệch hydration. Với cấu hình tuyệt đối hành vi nhìn thấy được không đổi.
 */
export function useAuthFrontendUrl(path: string, fallback: string): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => buildAuthFrontendUrl(path, "") ?? fallback,
    () => fallback,
  );
}
