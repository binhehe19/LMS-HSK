"use client";

import { useSyncExternalStore } from "react";
import { isDemoActive } from "@/lib/demo/demo-mode";

const noopSubscribe = () => () => {};

/**
 * true khi bản build demo đang chạy trên host được phép. Phía server và lúc hydrate luôn false (hostname chỉ biết ở trình duyệt) để HTML server và lần
 * render đầu của client giống nhau; băng-rôn demo/nút ghi vì thế xuất hiện ngay sau hydrate.
 */
export function useDemoMode(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => isDemoActive(window.location.hostname),
    () => false,
  );
}
