"use client";

import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { brandTheme } from "@/theme/brand-tokens";

// Modal.confirm/message/notification render ngoài cây React của ConfigProvider nên không tự nhận theme; đăng ký cùng theme ở đây để các popup gọi qua
// static method cũng ra đúng màu thương hiệu thay vì màu xanh mặc định của antd.
ConfigProvider.config({ theme: brandTheme });

export function AntdUiProvider({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={brandTheme}>{children}</ConfigProvider>;
}
