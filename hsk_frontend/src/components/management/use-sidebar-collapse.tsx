"use client";

import { useSyncExternalStore } from "react";

// Hành vi như LMS_Frontend/src/core/common/sidebar/sidebar-collapse.tsx (cùng khóa localStorage),
// nhưng đọc localStorage qua useSyncExternalStore để tránh lệch hydration: server luôn render
// "mở rộng", client cập nhật ngay sau hydrate nếu người dùng đã thu gọn trước đó.
const COLLAPSED_KEY = "management-sidebar-collapsed";
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useSidebarCollapse() {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  const toggle = () => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(!readCollapsed()));
    } catch {
      // Sidebar vẫn dùng được khi storage không khả dụng (như bản cũ).
    }
    listeners.forEach((listener) => listener());
  };

  return { collapsed, toggle };
}
