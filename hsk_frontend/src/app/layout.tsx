import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ReduxProvider } from "@/components/auth/redux-provider";
import { AntdStaticRender } from "@/components/shared/antd-static-render";
import { AntdUiProvider } from "@/components/shared/antd-ui-provider";

// Thứ tự nạp CSS cố ý giống LMS_Frontend/src/index.tsx: iconsax -> CSS của từng trang -> bootstrap ->
// index.scss -> tabler -> fontawesome. Thứ tự này ảnh hưởng độ ưu tiên khi các rule cùng độ đặc hiệu
// (xem ghi chú trong page-styles.ts). Slick/MUI chưa cần ở M1 (xem docs/FEATURE-STATUS.md).
import "@/styles/css/iconsax.css";
import "@/styles/page-styles";
import "bootstrap/dist/css/bootstrap.min.css";
import "@/styles/index.scss";
import "@tabler/icons-webfont/dist/tabler-icons.css";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

export const metadata: Metadata = {
  // Cùng tiêu đề với index.html của LMS_Frontend cũ.
  title: "Học Bá - Bật mode Học Bá, cân mọi giao tiếp",
  icons: { icon: "/assets/hocba/LOGO01.png" },
  // Khu vực quản lý cần đăng nhập: không để công cụ tìm kiếm lập chỉ mục.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,200..1000;1,200..1000&display=swap"
        />
      </head>
      <body>
        <AntdRegistry>
          {/* antd 5 + React 19: trỏ các API tĩnh (Modal.confirm, message) sang createRoot — xem components/shared/antd-static-render.tsx */}
          <AntdStaticRender />
          <AntdUiProvider><ReduxProvider>{children}</ReduxProvider></AntdUiProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
