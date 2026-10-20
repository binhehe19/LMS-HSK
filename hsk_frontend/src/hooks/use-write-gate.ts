"use client";

import { useDemoMode } from "@/hooks/use-demo-mode";
import { getWriteAvailability, type WriteAvailability, type WriteFeature } from "@/lib/api/write-gate";

/** Trạng thái công tắc ghi của một miền cho component: "enabled" trong chế độ demo hoặc khi cờ NEXT_PUBLIC_WRITE_* đã mở; ngược lại "waiting". */
export function useWriteGate(feature: WriteFeature): { availability: WriteAvailability; enabled: boolean; demo: boolean } {
  const demo = useDemoMode();
  const availability = getWriteAvailability(feature, demo);
  return { availability, enabled: availability === "enabled", demo };
}
