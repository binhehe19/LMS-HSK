"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/redux/store";

export function ReduxProvider({ children }: { children: ReactNode }) {
  // Khởi tạo một lần cho mỗi lần mount (lazy initial state), không đọc ref trong lúc render.
  const [store] = useState(() => makeStore());
  return <Provider store={store}>{children}</Provider>;
}
