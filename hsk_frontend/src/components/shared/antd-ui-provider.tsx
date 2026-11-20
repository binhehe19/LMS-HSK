"use client";

import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { brandTheme } from "@/theme/brand-tokens";

// Các popup tĩnh có cây React riêng nên cần ConfigProvider riêng để nhận theme.
ConfigProvider.config({
  holderRender: (children) => <ConfigProvider theme={brandTheme}>{children}</ConfigProvider>,
});

export function AntdUiProvider({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={brandTheme}>{children}</ConfigProvider>;
}
