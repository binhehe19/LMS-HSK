"use client";

import { useSyncExternalStore } from "react";

const desktopQuery = "(min-width: 992px)";

function subscribe(listener: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function useStudentDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(desktopQuery).matches, () => false);
}
