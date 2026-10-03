"use client";

import { useSyncExternalStore } from "react";

// Mỗi lần tải trang bắt đầu ở trạng thái mở. Header và sidebar dùng chung trạng thái trong trang.
let sidebarCollapsed = false;
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  return sidebarCollapsed;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSidebarCollapse() {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  const toggle = () => {
    sidebarCollapsed = !sidebarCollapsed;
    listeners.forEach((listener) => listener());
  };

  return { collapsed, toggle };
}
