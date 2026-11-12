import type { ThemeConfig } from "antd";

// Bảng màu thương hiệu Học Bá, cùng giá trị với ERP/frontend và Exam_Frontend (src/theme/brandTokens.ts + GlobalThemeConfig.tsx của hai dự án đó).
// Biến SCSS tương ứng ($brand-*) nằm ở src/styles/scss/utils/_variables.scss: đổi một bên thì đổi cả bên kia.
export const BRAND_COLORS = {
  primary: "#B00D0E",
  primaryHover: "#860707",
  secondary: "#3A3A3A",
  neutral: "#D9D9D9",
  accent: "#FF3535",
  soft: "#FFD8D8",
  coral: "#FF6F69",
  surface: "#FFF4F4",
  white: "#FFFFFF",
} as const;

export const BRAND_STATUS_COLORS = {
  success: "#52c41a",
  warning: "#faad14",
  error: "#ff4d4f",
} as const;

/** Theme Ant Design dùng chung toàn app. */
export const brandTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND_COLORS.primary,
    colorPrimaryHover: BRAND_COLORS.primaryHover,
    colorInfo: BRAND_COLORS.primary,
    colorLink: BRAND_COLORS.primary,
    colorLinkHover: BRAND_COLORS.primaryHover,
    colorTextBase: BRAND_COLORS.secondary,
    colorBgBase: BRAND_COLORS.white,
    colorSuccess: BRAND_STATUS_COLORS.success,
    colorWarning: BRAND_STATUS_COLORS.warning,
    colorError: BRAND_STATUS_COLORS.error,
    fontFamily: "var(--hsk-font-ui)",
  },
  components: {
    Menu: { itemSelectedBg: BRAND_COLORS.surface, itemSelectedColor: BRAND_COLORS.primary },
    // Lựa chọn đang chọn tô nền đỏ thương hiệu thay vì viên trắng mặc định (giống ERP).
    Segmented: { itemSelectedBg: BRAND_COLORS.primary, itemSelectedColor: BRAND_COLORS.white },
    Table: { headerColor: "#667085", headerBg: "#F9FAFB" },
  },
};

export const UI_CONTROL_RADIUS = 10;

export const desktopTheme: ThemeConfig = {
  token: { ...brandTheme.token, borderRadius: UI_CONTROL_RADIUS },
  components: {
    ...brandTheme.components,
    Button: { primaryShadow: "none", fontWeight: 600 },
  },
};
